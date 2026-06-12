import { prisma } from "@/lib/prisma";
import { getLeaderboard, type LeaderboardRow } from "@/lib/leaderboard";

// "YYYY-MM-DD" — the shape the reminder cron stamps into the ?d= URL.
const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a well-formed snapshot date key (YYYY-MM-DD). */
export function isSnapshotDateParam(value: string | null): value is string {
  return value != null && DATE_PARAM.test(value);
}

/**
 * Compute the current leaderboard and store it as the snapshot for `dateKey`.
 *
 * Idempotent: the date is the primary key, so a re-run (cron retry, manual
 * re-trigger) overwrites the day's row with the latest standings.
 */
export async function captureLeaderboardSnapshot(
  dateKey: string
): Promise<void> {
  const data = await getLeaderboard();
  await prisma.leaderboardSnapshot.upsert({
    where: { date: dateKey },
    update: { data },
    create: { date: dateKey, data },
  });
}

/** The stored standings for `dateKey`, or null if no snapshot was taken. */
export async function getLeaderboardSnapshot(
  dateKey: string
): Promise<LeaderboardRow[] | null> {
  const row = await prisma.leaderboardSnapshot.findUnique({
    where: { date: dateKey },
  });
  return row ? (row.data as unknown as LeaderboardRow[]) : null;
}
