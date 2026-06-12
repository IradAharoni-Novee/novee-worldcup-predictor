import { isLocked } from "@/lib/format";

/**
 * Reveal predicates for the public user profile. A prediction is visible to
 * other users only once its lock has passed, so nothing copyable leaks. All
 * predicates delegate to `isLocked` (a kickoff is locked once `kickoff <= now`).
 */

export function revealedMatchPredictions<T extends { match: { kickoff: Date } }>(
  predictions: T[],
  now: Date = new Date()
): T[] {
  return predictions.filter((p) => isLocked(p.match.kickoff, now));
}

export function revealedGroups<T extends { group: string }>(
  groupPredictions: T[],
  groupLockTimes: Map<string, Date>,
  now: Date = new Date()
): T[] {
  return groupPredictions.filter((gp) => {
    const lock = groupLockTimes.get(gp.group);
    return lock ? isLocked(lock, now) : false;
  });
}

export function isAwardsRevealed(
  tournamentLockTime: Date | null,
  now: Date = new Date()
): boolean {
  return tournamentLockTime ? isLocked(tournamentLockTime, now) : false;
}

export function isBracketRevealed(
  bracketLockTime: Date | null,
  now: Date = new Date()
): boolean {
  return bracketLockTime ? isLocked(bracketLockTime, now) : false;
}
