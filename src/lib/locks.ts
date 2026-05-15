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

export async function isBracketLocked(now: Date = new Date()): Promise<boolean> {
  const earliest = await prisma.match.findFirst({
    where: { stage: "R32" },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  if (!earliest) {
    // Fall back to R16 if R32 isn't seeded yet (e.g. 16-team format)
    const fallback = await prisma.match.findFirst({
      where: { stage: "R16" },
      orderBy: { kickoff: "asc" },
      select: { kickoff: true },
    });
    if (!fallback) return false;
    return isLocked(fallback.kickoff, now);
  }
  return isLocked(earliest.kickoff, now);
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
