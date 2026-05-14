import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCORING,
  scorePrediction,
  type ScoringConfig,
} from "@/lib/scoring";
import type { Stage } from "@prisma/client";

export type LeaderboardRow = {
  userId: string;
  name: string | null;
  email: string;
  total: number;
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
  };
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const config = await getScoringConfig();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
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
    },
  });

  const rows = users.map<LeaderboardRow>((user) => {
    let total = 0;
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
      total += points;
      const multiplier =
        p.match.stage !== "GROUP" ? config.knockoutMultiplier : 1;
      if (points === config.exactScore * multiplier) exact++;
      else outcomeCount++;
    }
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      total,
      exact,
      outcome: outcomeCount,
      predictions: user.predictions.length,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.exact - a.exact);
  return rows;
}
