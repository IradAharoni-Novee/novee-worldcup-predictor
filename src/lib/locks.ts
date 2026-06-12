import { prisma } from "@/lib/prisma";
import { isLocked } from "@/lib/format";

export async function isGroupLocked(group: string, now: Date = new Date()): Promise<boolean> {
  const earliest = await prisma.match.findFirst({
    where: { stage: "GROUP", group },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  if (!earliest) return false;
  return isLocked(earliest.kickoff, now);
}

export async function getBracketLockTime(): Promise<Date | null> {
  const earliest = await prisma.match.findFirst({
    where: { stage: "R32" },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  if (earliest) return earliest.kickoff;
  // Fall back to R16 if R32 isn't seeded yet (e.g. 16-team format)
  const fallback = await prisma.match.findFirst({
    where: { stage: "R16" },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  return fallback?.kickoff ?? null;
}

export async function isBracketLocked(now: Date = new Date()): Promise<boolean> {
  const lock = await getBracketLockTime();
  if (!lock) return false;
  return isLocked(lock, now);
}

export async function isTournamentLocked(now: Date = new Date()): Promise<boolean> {
  const earliest = await prisma.match.findFirst({
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  if (!earliest) return false;
  return isLocked(earliest.kickoff, now);
}

export async function getTournamentLockTime(): Promise<Date | null> {
  const earliest = await prisma.match.findFirst({
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  return earliest?.kickoff ?? null;
}

export const SETTING_KEY_AWARDS_DEADLINE = "awardsDeadline";

// Resolve the awards (tournament winner + golden boot) lock time. By default it
// matches the tournament's first kickoff, but an admin can extend or shorten it
// by storing an ISO timestamp in the `awardsDeadline` Setting — when present and
// valid, it replaces the default. Pure so it can be unit-tested without the DB.
export function resolveAwardsLockTime(
  overrideValue: unknown,
  tournamentLockTime: Date | null
): Date | null {
  if (typeof overrideValue === "string") {
    const override = new Date(overrideValue);
    if (!Number.isNaN(override.getTime())) return override;
  }
  return tournamentLockTime;
}

export async function getAwardsLockTime(): Promise<Date | null> {
  const [override, tournamentLockTime] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SETTING_KEY_AWARDS_DEADLINE } }),
    getTournamentLockTime(),
  ]);
  return resolveAwardsLockTime(override?.value, tournamentLockTime);
}

export async function isAwardsLocked(now: Date = new Date()): Promise<boolean> {
  const lock = await getAwardsLockTime();
  if (!lock) return false;
  return isLocked(lock, now);
}

export async function getGroupLockTimes(): Promise<Map<string, Date>> {
  const rows = await prisma.match.groupBy({
    by: ["group"],
    where: { stage: "GROUP", group: { not: null } },
    _min: { kickoff: true },
  });
  const map = new Map<string, Date>();
  for (const r of rows) {
    if (r.group && r._min.kickoff) map.set(r.group, r._min.kickoff);
  }
  return map;
}
