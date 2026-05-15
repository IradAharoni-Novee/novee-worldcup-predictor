import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCORING,
  scorePrediction,
  type ScoringConfig,
} from "@/lib/scoring";
import type { Stage } from "@prisma/client";
import { computeGroupStandings } from "@/lib/group-standings";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import { computeAdvancers, scoreBracketPicks } from "@/lib/scoring-bracket";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
  scoreAwards,
} from "@/lib/scoring-awards";

export type LeaderboardRow = {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  total: number;
  matchPoints: number;
  groupPoints: number;
  bracketPoints: number;
  awardsPoints: number;
  exact: number;
  outcome: number;
  predictions: number;
};

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
  };
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const config = await getScoringConfig();

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
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
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
    let matchPoints = 0;
    let exact = 0;
    let outcomeCount = 0;
    for (const p of user.predictions) {
      if (p.match.status !== "FINISHED") continue;
      const points = scorePrediction(
        { homeScore: p.homeScore, awayScore: p.awayScore },
        {
          stage: p.match.stage as Stage,
          homeScore: p.match.homeScore,
          awayScore: p.match.awayScore,
        },
        config
      );
      if (points === 0) continue;
      matchPoints += points;
      const multiplier =
        p.match.stage !== "GROUP" ? config.knockoutMultiplier : 1;
      if (points === config.exactScore * multiplier) exact++;
      else outcomeCount++;
    }

    let groupPoints = 0;
    for (const gp of user.groupPredictions) {
      const standings = standingsByGroup.get(gp.group);
      if (!standings) continue;
      const score = scoreGroupPrediction(gp, standings, config);
      groupPoints += score.total;
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
      groupPoints,
      bracketPoints: bracketScore.total,
      awardsPoints: awardsScore.total,
      total: matchPoints + groupPoints + bracketScore.total + awardsScore.total,
      exact,
      outcome: outcomeCount,
      predictions: user.predictions.length,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.exact - a.exact);
  return rows;
}
