export const STAKE = 100;

export type Outcome = "H" | "D" | "A";

/** The 1/X/2 outcome a scoreline implies: home win, draw, or away win. */
export function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

/** The decimal odds stored for a given outcome, or null when that price is absent. */
export function oddsForOutcome(
  o: Outcome,
  odds: { oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null }
): number | null {
  if (o === "H") return odds.oddsHome;
  if (o === "D") return odds.oddsDraw;
  return odds.oddsAway;
}

/**
 * Net profit/loss of a STAKE bet on `predicted` settled against `actual`.
 *
 * Returns 0 when odds are null (the bet is skipped, not counted as a loss),
 * `STAKE * (odds - 1)` on a correct bet, and `-STAKE` on a wrong one.
 */
export function settleBet(
  predicted: Outcome,
  actual: Outcome,
  odds: number | null
): number {
  if (odds == null) return 0;
  if (predicted === actual) return STAKE * (odds - 1);
  return -STAKE;
}
