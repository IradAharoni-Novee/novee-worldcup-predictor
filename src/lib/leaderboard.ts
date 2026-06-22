import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCORING,
  scorePrediction,
  type ScoringConfig,
} from "@/lib/scoring";
import type { MatchStatus, Stage } from "@prisma/client";
import { isMatchLive } from "@/lib/format";
import { computeGroupStandings } from "@/lib/group-standings";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import { computeAdvancers, scoreBracketPicks } from "@/lib/scoring-bracket";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
  scoreAwards,
} from "@/lib/scoring-awards";
import { scorePodiumPrediction } from "@/lib/scoring-podium";
import { isAiPlayer } from "@/lib/ai-players";

export type LeaderboardRow = {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  total: number;
  matchPoints: number;
  livePoints: number;
  groupPoints: number;
  bracketPoints: number;
  awardsPoints: number;
  podiumPoints: number;
  exact: number;
  outcome: number;
  predictions: number;
};

type MatchPointsPrediction = {
  homeScore: number;
  awayScore: number;
  match: {
    stage: Stage;
    homeScore: number | null;
    awayScore: number | null;
    status: MatchStatus;
    kickoff: Date;
  };
};

export type MatchPointsSummary = {
  matchPoints: number;
  livePoints: number;
  exact: number;
  outcome: number;
};

/**
 * Split a user's per-match prediction points into confirmed (finished matches)
 * and live (in-progress matches scored at their current scoreline — "if the
 * game ended now"). `exact`/`outcome` count confirmed hits only; live points
 * stay provisional until the match finishes.
 */
export function summarizeMatchPoints(
  predictions: MatchPointsPrediction[],
  config: ScoringConfig,
  now: Date
): MatchPointsSummary {
  let matchPoints = 0;
  let livePoints = 0;
  let exact = 0;
  let outcome = 0;
  for (const p of predictions) {
    const finished = p.match.status === "FINISHED";
    const live = !finished && isMatchLive(p.match.status, p.match.kickoff, now);
    if (!finished && !live) continue;
    const points = scorePrediction(
      { homeScore: p.homeScore, awayScore: p.awayScore },
      {
        stage: p.match.stage,
        homeScore: p.match.homeScore,
        awayScore: p.match.awayScore,
      },
      config
    );
    if (points === 0) continue;
    if (!finished) {
      livePoints += points;
      continue;
    }
    matchPoints += points;
    const multiplier = p.match.stage !== "GROUP" ? config.knockoutMultiplier : 1;
    if (points === config.exactScore * multiplier) exact++;
    else outcome++;
  }
  return { matchPoints, livePoints, exact, outcome };
}

export async function getScoringConfig(): Promise<ScoringConfig> {
  const row = await prisma.setting.findUnique({ where: { key: "scoring" } });
  if (!row) return DEFAULT_SCORING;
  const v = row.value as Partial<ScoringConfig>;
  return {
    exactScore: v.exactScore ?? DEFAULT_SCORING.exactScore,
    correctOutcome: v.correctOutcome ?? DEFAULT_SCORING.correctOutcome,
    knockoutMultiplier:
      v.knockoutMultiplier ?? DEFAULT_SCORING.knockoutMultiplier,
    groupExactPosition:
      v.groupExactPosition ?? DEFAULT_SCORING.groupExactPosition,
    groupQualifiedHalf:
      v.groupQualifiedHalf ?? DEFAULT_SCORING.groupQualifiedHalf,
    bracketRoundPoints: {
      ...DEFAULT_SCORING.bracketRoundPoints,
      ...(v.bracketRoundPoints ?? {}),
    },
    tournamentWinnerPoints:
      v.tournamentWinnerPoints ?? DEFAULT_SCORING.tournamentWinnerPoints,
    goldenBootPoints: v.goldenBootPoints ?? DEFAULT_SCORING.goldenBootPoints,
    podiumExactPosition:
      v.podiumExactPosition ?? DEFAULT_SCORING.podiumExactPosition,
    podiumInTop3: v.podiumInTop3 ?? DEFAULT_SCORING.podiumInTop3,
  };
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const config = await getScoringConfig();
  const now = new Date();

  const [users, allGroupMatches, knockoutMatches, actualWinnerSetting, actualGbSetting] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          predictions: {
            select: {
              homeScore: true,
              awayScore: true,
              match: {
                select: {
                  stage: true,
                  homeScore: true,
                  awayScore: true,
                  status: true,
                  kickoff: true,
                },
              },
            },
          },
          groupPredictions: {
            select: {
              group: true,
              team1stId: true,
              team2ndId: true,
              team3rdId: true,
              team4thId: true,
            },
          },
          bracketPicks: {
            select: { round: true, slot: true, teamId: true },
          },
          winnerPrediction: { select: { teamId: true } },
          goldenBootPrediction: { select: { playerId: true } },
          podiumPrediction: {
            select: { firstId: true, secondId: true, thirdId: true },
          },
        },
      }),
      prisma.match.findMany({
        where: { stage: "GROUP" },
        select: {
          group: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      }),
      prisma.match.findMany({
        where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] } },
        select: {
          stage: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      }),
      prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_WINNER } }),
      prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_GOLDEN_BOOT } }),
    ]);

  const actualWinnerTeamId =
    typeof actualWinnerSetting?.value === "string" ? actualWinnerSetting.value : null;
  const actualGoldenBootPlayerId =
    typeof actualGbSetting?.value === "string" ? actualGbSetting.value : null;

  const standingsByGroup = new Map<
    string,
    ReturnType<typeof computeGroupStandings>
  >();
  const matchesByGroup = new Map<string, typeof allGroupMatches>();
  for (const m of allGroupMatches) {
    if (!m.group) continue;
    const list = matchesByGroup.get(m.group) ?? [];
    list.push(m);
    matchesByGroup.set(m.group, list);
  }
  for (const [group, matches] of matchesByGroup) {
    const allFinished = matches.every((m) => m.status === "FINISHED");
    if (!allFinished) continue;
    standingsByGroup.set(group, computeGroupStandings(matches));
  }

  const advancers = computeAdvancers(knockoutMatches);

  const finals = knockoutMatches.filter((m) => m.stage === "FINAL");
  const podiumSettled =
    finals.length > 0 && finals.every((m) => m.status === "FINISHED");

  // First pass: every surface except the podium meta-prediction. The podium is
  // graded against this base ranking so the meta-prediction never grades itself.
  const baseRows = users.map((user) => {
    const { matchPoints, livePoints, exact, outcome } = summarizeMatchPoints(
      user.predictions,
      config,
      now
    );

    let groupPoints = 0;
    for (const gp of user.groupPredictions) {
      const standings = standingsByGroup.get(gp.group);
      if (!standings) continue;
      groupPoints += scoreGroupPrediction(gp, standings, config).total;
    }

    const bracketScore = scoreBracketPicks(
      user.bracketPicks.map((p) => ({
        round: p.round,
        slot: p.slot,
        teamId: p.teamId,
      })),
      advancers,
      config
    );

    const awardsScore = scoreAwards(
      {
        winnerTeamId: user.winnerPrediction?.teamId ?? null,
        goldenBootPlayerId: user.goldenBootPrediction?.playerId ?? null,
      },
      { actualWinnerTeamId, actualGoldenBootPlayerId },
      config
    );

    const baseTotal =
      matchPoints + groupPoints + bracketScore.total + awardsScore.total;

    return {
      user,
      matchPoints,
      livePoints,
      exact,
      outcome,
      groupPoints,
      bracketPoints: bracketScore.total,
      awardsPoints: awardsScore.total,
      baseTotal,
    };
  });

  const actualPodium = podiumSettled
    ? [...baseRows]
        .filter((r) => !isAiPlayer(r.user.email))
        .sort((a, b) => b.baseTotal - a.baseTotal || b.exact - a.exact)
        .slice(0, 3)
        .map((r) => r.user.id)
    : [];

  // Second pass: add podium points on top of the frozen base ranking.
  const rows = baseRows.map<LeaderboardRow>((r) => {
    const podiumPoints = r.user.podiumPrediction
      ? scorePodiumPrediction(r.user.podiumPrediction, actualPodium, config)
          .total
      : 0;
    return {
      userId: r.user.id,
      name: r.user.name,
      email: r.user.email,
      image: r.user.image,
      matchPoints: r.matchPoints,
      livePoints: r.livePoints,
      groupPoints: r.groupPoints,
      bracketPoints: r.bracketPoints,
      awardsPoints: r.awardsPoints,
      podiumPoints,
      total: r.baseTotal + podiumPoints,
      exact: r.exact,
      outcome: r.outcome,
      predictions: r.user.predictions.length,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.exact - a.exact);
  return rows;
}

/**
 * The ordered top-3 human user ids once the tournament is over, or `null` while
 * the podium is unsettled. The ranking deliberately excludes podium points
 * (`total - podiumPoints`) so the meta-prediction can't grade itself, and
 * filters out AI shadow players. Pass the rows from `getLeaderboard()`.
 */
export function deriveActualPodium(rows: LeaderboardRow[]): string[] {
  return [...rows]
    .filter((r) => !isAiPlayer(r.email))
    .sort(
      (a, b) =>
        b.total - b.podiumPoints - (a.total - a.podiumPoints) ||
        b.exact - a.exact
    )
    .slice(0, 3)
    .map((r) => r.userId);
}

/** True once the FINAL match (and any final there is) has finished. */
export async function isPodiumSettled(): Promise<boolean> {
  const finals = await prisma.match.findMany({
    where: { stage: "FINAL" },
    select: { status: true },
  });
  return finals.length > 0 && finals.every((m) => m.status === "FINISHED");
}
