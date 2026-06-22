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

export type PodiumConsensusEntry = { userId: string; count: number };

/**
 * Tally how the room called the leaderboard podium, one ranked list per slot
 * (1st/2nd/3rd). Surfaced after picks lock so it never leaks live picks. `total`
 * is the number of submitted podium predictions.
 */
export async function getPodiumConsensus(): Promise<{
  total: number;
  slots: PodiumConsensusEntry[][];
}> {
  const picks = await prisma.podiumPrediction.findMany({
    select: { firstId: true, secondId: true, thirdId: true },
  });

  const slots: Map<string, number>[] = [
    new Map(),
    new Map(),
    new Map(),
  ];
  for (const p of picks) {
    const ids = [p.firstId, p.secondId, p.thirdId];
    for (let i = 0; i < 3; i++) {
      const id = ids[i];
      const slot = slots[i];
      if (id === undefined || slot === undefined) continue;
      slot.set(id, (slot.get(id) ?? 0) + 1);
    }
  }

  return {
    total: picks.length,
    slots: slots.map((slot) =>
      [...slot.entries()]
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
    ),
  };
}
