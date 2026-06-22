// Reconcile a DB Match against events from another provider (live-score
// fixtures, odds events, ESPN venues, …). Providers disagree on some country
// names — football-data.org says "Czechia" where API-Football says "Czech
// Republic", "IR Iran" vs "Iran" — so an exact two-name match isn't always
// possible. The rules here are shared so every surface pairs events the same
// way.

export function isoMinute(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 16);
}

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

type Candidate = { homeName: string; awayName: string; date: string | Date };
type Target = { homeName: string; awayName: string; kickoff: Date | string };

/**
 * Pair a target match with a provider candidate at the same kickoff minute.
 *
 * Prefer a candidate where both teams match (diacritic-insensitive, either
 * orientation); otherwise accept one that matches on a single team, but only
 * when it is the sole same-minute candidate sharing a team, so two matches
 * kicking off simultaneously are never confused.
 *
 * @param target The DB match to reconcile, identified by team names + kickoff.
 * @param candidates Provider events to choose from.
 * @returns The unique matching candidate, or `null` when ambiguous or absent.
 */
export function pickByTeamsAtMinute<T extends Candidate>(
  target: Target,
  candidates: T[]
): T | null {
  const minute = isoMinute(target.kickoff);
  const home = normaliseName(target.homeName);
  const away = normaliseName(target.awayName);

  const bothMatch: T[] = [];
  const oneMatches: T[] = [];
  for (const c of candidates) {
    if (isoMinute(c.date) !== minute) continue;
    const cHome = normaliseName(c.homeName);
    const cAway = normaliseName(c.awayName);
    const homeHit = home !== "" && (cHome === home || cAway === home);
    const awayHit = away !== "" && (cHome === away || cAway === away);
    if (homeHit && awayHit) bothMatch.push(c);
    else if (homeHit || awayHit) oneMatches.push(c);
  }

  if (bothMatch.length === 1) return bothMatch[0]!;
  if (bothMatch.length > 1) return null; // ambiguous — never guess
  return oneMatches.length === 1 ? oneMatches[0]! : null;
}
