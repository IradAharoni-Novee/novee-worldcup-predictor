import { prisma } from "@/lib/prisma";

export type ScoreBucket = {
  score: string;
  homeScore: number;
  awayScore: number;
  count: number;
  percent: number;
};

/**
 * Aggregate all predictions for a single match into a sorted list of score
 * buckets. Used by the post-kickoff "what did the room pick" histogram.
 */
export async function getPickAggregates(matchId: string): Promise<{
  total: number;
  buckets: ScoreBucket[];
}> {
  const picks = await prisma.prediction.findMany({
    where: { matchId },
    select: { homeScore: true, awayScore: true },
  });

  if (picks.length === 0) return { total: 0, buckets: [] };

  const counts = new Map<string, ScoreBucket>();
  for (const p of picks) {
    const key = `${p.homeScore}-${p.awayScore}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        score: `${p.homeScore}–${p.awayScore}`,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        count: 1,
        percent: 0,
      });
    }
  }
  const total = picks.length;
  const buckets = [...counts.values()]
    .map((b) => ({ ...b, percent: (b.count / total) * 100 }))
    .sort((a, b) => b.count - a.count);

  return { total, buckets };
}
