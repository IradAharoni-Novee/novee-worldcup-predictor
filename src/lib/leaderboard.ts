import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCORING,
  scorePrediction,
  scoreShootoutBonus,
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
import { oddsForOutcome, outcomeOf, settleBet } from "@/lib/earnings";

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
  exact: number;
  outcome: number;
  predictions: number;
  earnings: number;
  liveEarnings: number;
};

type MatchPointsPrediction = {
  homeScore: number;
  awayScore: number;
  shootoutWinnerTeamId: string | null;
  match: {
    stage: Stage;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeScore: number | null;
    awayScore: number | null;
    advancingTeamId: string | null;
    status: MatchStatus;
    kickoff: Date;
    oddsHome: number | null;
    oddsDraw: number | null;
    oddsAway: number | null;
  };
};

export type MatchPointsSummary = {
  matchPoints: number;
  livePoints: number;
  exact: number;
  outcome: number;
  earnings: number;
  liveEarnings: number;
};

/**
 * Split a user's per-match prediction points into confirmed (finished matches)
 * and live (in-progress matches scored at their current scoreline — "if the
 * game ended now"). `exact`/`outcome` count confirmed hits only; live points
 * stay provisional until the match finishes.
 *
 * `earnings`/`liveEarnings` treat each prediction as a $100 bet on its implied
 * 1/X/2 outcome, settled at the match's stored average odds — a wrong bet loses
 * the full stake, so the bet is settled before the zero-points fast path. Bets
 * settle on the stored regulation/ET scoreline, so a knockout decided on
 * penalties settles as a draw — matching both the h2h odds market and
 * `scorePrediction`'s points logic.
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
  let earnings = 0;
  let liveEarnings = 0;
  for (const p of predictions) {
    const finished = p.match.status === "FINISHED";
    const live = !finished && isMatchLive(p.match.status, p.match.kickoff, now);
    if (!finished && !live) continue;
    if (p.match.homeScore != null && p.match.awayScore != null) {
      const predicted = outcomeOf(p.homeScore, p.awayScore);
      const actual = outcomeOf(p.match.homeScore, p.match.awayScore);
      const pnl = settleBet(predicted, actual, oddsForOutcome(predicted, p.match));
      if (finished) earnings += pnl;
      else liveEarnings += pnl;
    }
    const scoreline = scorePrediction(
      { homeScore: p.homeScore, awayScore: p.awayScore },
      {
        stage: p.match.stage,
        homeScore: p.match.homeScore,
        awayScore: p.match.awayScore,
      },
      config
    );
    if (!finished) {
      livePoints += scoreline;
      continue;
    }
    // The shootout bonus can apply even when the scoreline scored nothing (a
    // decisive prediction of the side that advanced on penalties), so it's added
    // independently of the scoreline points and never counts as exact/outcome.
    const bonus = scoreShootoutBonus(
      {
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        shootoutWinnerTeamId: p.shootoutWinnerTeamId,
      },
      {
        stage: p.match.stage,
        homeTeamId: p.match.homeTeamId,
        awayTeamId: p.match.awayTeamId,
        homeScore: p.match.homeScore,
        awayScore: p.match.awayScore,
        advancingTeamId: p.match.advancingTeamId,
      },
      config
    );
    matchPoints += scoreline + bonus;
    if (scoreline > 0) {
      const multiplier =
        p.match.stage !== "GROUP" ? config.knockoutMultiplier : 1;
      if (scoreline === config.exactScore * multiplier) exact++;
      else outcome++;
    }
  }
  return { matchPoints, livePoints, exact, outcome, earnings, liveEarnings };
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
    shootoutBonus: v.shootoutBonus ?? DEFAULT_SCORING.shootoutBonus,
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
              shootoutWinnerTeamId: true,
              match: {
                select: {
                  stage: true,
                  homeTeamId: true,
                  awayTeamId: true,
                  homeScore: true,
                  awayScore: true,
                  advancingTeamId: true,
                  status: true,
                  kickoff: true,
                  oddsHome: true,
                  oddsDraw: true,
                  oddsAway: true,
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
          advancingTeamId: true,
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

  const rows = users.map<LeaderboardRow>((user) => {
    const { matchPoints, livePoints, exact, outcome, earnings, liveEarnings } =
      summarizeMatchPoints(user.predictions, config, now);

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

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      matchPoints,
      livePoints,
      groupPoints,
      bracketPoints: bracketScore.total,
      awardsPoints: awardsScore.total,
      total:
        matchPoints + groupPoints + bracketScore.total + awardsScore.total,
      exact,
      outcome,
      predictions: user.predictions.length,
      earnings,
      liveEarnings,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.exact - a.exact);
  return rows;
}
