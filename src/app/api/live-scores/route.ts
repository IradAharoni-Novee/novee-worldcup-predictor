import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncLiveScores } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hit football-data.org at most once per window across all viewers. The client
// polls every 60s; many concurrent viewers must not multiply API calls.
const THROTTLE_MS = 50_000;
const THROTTLE_KEY = "liveSyncAt";

// Best-effort throttle. A rare race lets two requests both sync in the same
// minute — harmless given FD's 10 req/min budget — so no row lock is needed.
async function claimSync(now: Date): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: THROTTLE_KEY } });
  const last = row ? new Date(String(row.value)).getTime() : 0;
  if (now.getTime() - last < THROTTLE_MS) return false;
  await prisma.setting.upsert({
    where: { key: THROTTLE_KEY },
    create: { key: THROTTLE_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });
  return true;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // "Live" is time-based: kicked off and not finished. A match that just
  // kicked off is still SCHEDULED in the DB until the sync flips it.
  const liveFilter = { status: { not: "FINISHED" as const }, kickoff: { lte: now } };
  const hasLive = await prisma.match.findFirst({ where: liveFilter, select: { id: true } });
  if (!hasLive) return NextResponse.json({ ok: true, live: 0, synced: false });

  let synced = false;
  if (await claimSync(now)) {
    try {
      await syncLiveScores();
      synced = true;
    } catch (err) {
      // A transient FD failure shouldn't break the poller; it retries next tick.
      const error = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json({ ok: false, live: 1, synced: false, error }, { status: 502 });
    }
  }

  const live = await prisma.match.count({ where: liveFilter });
  return NextResponse.json({ ok: true, live, synced });
}
