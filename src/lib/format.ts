import { format, formatDistanceToNowStrict, isAfter, isBefore } from "date-fns";

export function formatKickoff(date: Date): string {
  return format(date, "EEE d MMM • HH:mm");
}

export function relativeKickoff(date: Date, now: Date = new Date()): string {
  if (isBefore(date, now)) return formatDistanceToNowStrict(date, { addSuffix: true });
  return `in ${formatDistanceToNowStrict(date)}`;
}

export function isLocked(kickoff: Date, now: Date = new Date()): boolean {
  return !isAfter(kickoff, now);
}

// A match is "live" once it has kicked off and before it has finished. The FD
// sync only runs once a day, so a match that kicks off after the last sync is
// still SCHEDULED in the DB — kickoff time, not the stale status enum, is the
// source of truth for "in progress".
export function isMatchLive(
  status: "SCHEDULED" | "LIVE" | "FINISHED",
  kickoff: Date,
  now: Date = new Date()
): boolean {
  if (status === "FINISHED") return false;
  if (status === "LIVE") return true;
  return isLocked(kickoff, now);
}

export function stageLabel(
  stage: "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL",
  group: string | null
): string {
  switch (stage) {
    case "GROUP":
      return group ? `Group ${group}` : "Group stage";
    case "R32":
      return "Round of 32";
    case "R16":
      return "Round of 16";
    case "QF":
      return "Quarter-final";
    case "SF":
      return "Semi-final";
    case "THIRD":
      return "Third place";
    case "FINAL":
      return "Final";
  }
}
