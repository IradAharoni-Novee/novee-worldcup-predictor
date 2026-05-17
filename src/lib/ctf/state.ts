// Server-component helper for loading CTF state. NOT a server action — only
// callable from server code. Splits "what I have" (private to me) from "the
// leaderboard" (visible to all players) so per-user captured flag slugs don't
// leak via the leaderboard payload.

import { prisma } from "@/lib/prisma";

export type CtfFlagView = {
  id: string;
  slug: string;
  points: number;
  hint: string;
  discoveryHint: string;
  captured: boolean;
  capturedAt: Date | null;
};

export type CtfLeaderboardRow = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  count: number;
  points: number;
};

export type CtfState = {
  flags: CtfFlagView[];
  leaderboard: CtfLeaderboardRow[];
};

export async function loadCtfState(userId: string): Promise<CtfState> {
  const [flags, myCaptures, allCaptures] = await Promise.all([
    prisma.ctfFlag.findMany({ orderBy: { points: "asc" } }),
    prisma.ctfCapture.findMany({
      where: { userId },
      select: { flagId: true, capturedAt: true },
    }),
    prisma.ctfCapture.findMany({
      select: { userId: true, flag: { select: { points: true } } },
    }),
  ]);

  const capturedFlagIds = new Set(myCaptures.map((c) => c.flagId));
  const capturedAtBy = new Map(myCaptures.map((c) => [c.flagId, c.capturedAt]));

  const byUser = new Map<string, { count: number; points: number }>();
  for (const c of allCaptures) {
    const cur = byUser.get(c.userId) ?? { count: 0, points: 0 };
    cur.count += 1;
    cur.points += c.flag.points;
    byUser.set(c.userId, cur);
  }

  const userIds = [...byUser.keys()];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, image: true },
      })
    : [];
  const usersById = new Map(users.map((u) => [u.id, u]));

  const leaderboard: CtfLeaderboardRow[] = userIds
    .map((id) => {
      const totals = byUser.get(id)!;
      const u = usersById.get(id);
      return {
        userId: id,
        name: u?.name ?? u?.email ?? "Unknown",
        email: u?.email ?? "",
        image: u?.image ?? null,
        count: totals.count,
        points: totals.points,
      };
    })
    .sort((a, b) => b.points - a.points || b.count - a.count);

  return {
    flags: flags.map((f) => ({
      id: f.id,
      slug: f.slug,
      points: f.points,
      hint: f.hint,
      discoveryHint: f.discoveryHint,
      captured: capturedFlagIds.has(f.id),
      capturedAt: capturedAtBy.get(f.id) ?? null,
    })),
    leaderboard,
  };
}
