import { isAfter } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function formatKickoff(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "EEE d MMM • HH:mm");
}

export function isLocked(kickoff: Date, now: Date = new Date()): boolean {
  return !isAfter(kickoff, now);
}

/**
 * Format a net amount as whole-dollar currency with a leading sign for nonzero
 * values, e.g. `+$1,250`, `-$700`, `$0`. Used for the "estimated earnings" stat.
 */
export function formatMoney(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
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

/**
 * Short display label for a user: their name, falling back to the local part of
 * their email, truncated to fit a card. Shared by the OG card image routes.
 */
export function displayName(name: string | null, email: string): string {
  const label = name?.trim() || email.split("@")[0] || "—";
  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
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
