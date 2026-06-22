# Estimated Earnings — design

**Status:** approved, ready for implementation plan
**Date:** 2026-06-22

## Summary

Add an "Estimated Earnings" column to the leaderboard. Treat every per-match
score `Prediction` as a $100 bet on the outcome it implies (home / draw / away),
settle each bet at the average bookmaker odds for that outcome, and show each
player's net profit/loss across all their settled predictions.

The column is **display-only** — it never changes the ranking, which stays on
points.

## Bet model

A per-match prediction implies exactly one 1/X/2 outcome:

- `homeScore > awayScore` → home win (1)
- `homeScore < awayScore` → away win (2)
- `homeScore == awayScore` → draw (X)

That outcome is a $100 bet, settled against the match's actual outcome at the
average decimal odds for the predicted outcome. **Net profit/loss** per bet:

- correct → `+100 × (odds − 1)`
- wrong   → `−100`
- no stored odds for that match → `0` (the bet is skipped, not counted as a loss)

Only `Prediction` rows are bet. Group, bracket, awards, and podium predictions
are not 1/X/2 markets and are excluded.

Settlement mirrors the existing confirmed-vs-live points split:

- **earnings** — bets on `FINISHED` matches (final).
- **liveEarnings** — bets on in-progress matches, settled provisionally at the
  current scoreline, exactly like `livePoints`.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Odds source | Paid the-odds-api plan: historical backfill for played matches + forward capture for upcoming |
| Earnings definition | Net profit/loss (can go negative) |
| Which predictions settle | Finished **and** live (provisional), mirroring `matchPoints`/`livePoints` |
| Odds value | Average of the predicted outcome's decimal price across all EU-region bookmakers |
| Region | `eu` (quotes 3-way 1/X/2) |
| Ranking impact | None — display-only column |
| AI shadow players | Included (they have predictions) |
| Match with no odds | Contributes $0; player/row still shown |

## Validation (smoke-tested 2026-06-22)

- Configured key resolves to a **paid plan with 20,000 credits**. The one-time
  backfill (~50 played matches × 10 credits ≈ 500) fits comfortably.
- `soccer_fifa_world_cup` is **active**; `/odds?regions=eu&markets=h2h` returned
  32 upcoming events, each with ~24 bookmakers, for **1 credit**.
- `h2h` outcomes are labeled by **team name** and the literal `"Draw"`. Match
  home/away by team name, draw by the `"Draw"` label — never by array position.
- `commence_time` (ISO 8601) aligns with our stored `kickoff`, so the existing
  diacritic-insensitive name + kickoff-minute reconciliation maps the-odds-api
  events to our `Match` rows.
- The standard `/odds` endpoint only returns upcoming/live games. Played matches
  drop off and require the **historical** endpoint (paid; 10 × markets × regions
  per snapshot).

## Architecture

### 1. Data model

Three nullable odds columns plus a capture timestamp on `Match` (new Prisma
migration):

```prisma
oddsHome      Float?
oddsDraw      Float?
oddsAway      Float?
oddsUpdatedAt DateTime?
```

*Alternative considered — a separate `MatchOdds` table.* Rejected: we store one
frozen number per outcome, and scores already live as denormalized columns on
`Match`. Adding columns matches the existing pattern (YAGNI).

### 2. Odds client — `src/lib/odds-api.ts`

Thin wrapper mirroring `football-data.ts` / `api-football.ts`. Reads
`ODDS_API_KEY`; throws a clear error if unset. Base
`https://api.the-odds-api.com/v4`, sport `soccer_fifa_world_cup`,
`markets=h2h`, `regions=eu`, `oddsFormat=decimal`.

```ts
type OutcomeOdds = { home: number; draw: number; away: number };
type OddsEvent = { homeName: string; awayName: string; commenceTime: string; odds: OutcomeOdds };

fetchCurrentOdds(): Promise<OddsEvent[]>                       // GET /odds — forward capture
fetchHistoricalOdds(snapshotIso: string): Promise<OddsEvent[]> // GET /historical/.../odds?date= — backfill
```

Both average each outcome's `price` across all bookmakers in the response,
matching outcomes by team name and the `"Draw"` label. Surface non-OK HTTP and
any populated error envelope (same defensive pattern as `api-football.ts`).

### 3. Getting odds into the DB

Reuse the reconciliation idea from `pickFixture` (`src/lib/sync.ts`): match an
odds event to a DB match by diacritic-insensitive team names (either
orientation) at the same kickoff minute; never guess when ambiguous.

- **Backfill (one-off)** — `prisma/backfill-odds.ts`, run with `pnpm exec tsx`.
  For each match missing odds, fetch the historical snapshot at `kickoff − 5min`
  (closing odds), reconcile, average, and write the columns + `oddsUpdatedAt`.
  Dedupe snapshot calls by timestamp so simultaneous kickoffs share one call.

- **Forward capture (ongoing)** — extend the daily `/api/cron/sync` to call
  `fetchCurrentOdds()` once (all upcoming games in a single 1-credit call) and
  upsert odds for matches that have not yet kicked off. Re-running daily
  overwrites until kickoff freezes the last pre-match value. This captures
  morning-of (not exact closing) odds for upcoming matches — a documented,
  deliberate looseness versus the backfill's exact close.

### 4. Earnings computation — `src/lib/earnings.ts`

Pure, unit-tested:

```ts
type Outcome = "H" | "D" | "A";
function outcomeOf(home: number, away: number): Outcome;
function oddsForOutcome(o: Outcome, odds: { home: number|null; draw: number|null; away: number|null }): number | null;
function settleBet(predicted: Outcome, actual: Outcome, odds: number | null): number; // net P&L; 0 if odds null
```

`summarizeMatchPoints` in `src/lib/leaderboard.ts` already classifies each
prediction as finished vs. live in one loop; extend it to also accumulate
`earnings` and `liveEarnings` via `settleBet`. The prediction `select` gains
`oddsHome`, `oddsDraw`, `oddsAway`.

### 5. Leaderboard surface

- `LeaderboardRow` gains `earnings: number` and `liveEarnings: number`.
- The table gets an **"Earnings"** column: right-aligned, `tabular-nums`,
  currency-formatted, green for positive / red for negative, hidden on small
  screens like the other secondary columns. The live portion renders as a chip
  (`+$X` / `−$X`), consistent with how `livePoints` is shown.
- Ranking is unchanged (points only).

### 6. Config

- New env var `ODDS_API_KEY`. Add a documented empty placeholder to
  `.env.example`; the real value lives in `.env` / Vercel env (never committed).

## Testing

Vitest, no live API calls:

- `settleBet` / `outcomeOf` / `oddsForOutcome` — win, loss, draw win, draw loss,
  null odds → 0, fractional payouts.
- Extended `summarizeMatchPoints` — confirmed vs. live split, predictions on
  un-priced matches contribute 0, mixed sets.
- Odds-client parsing — averaging across bookmakers and outcome-name matching,
  asserted against a captured sample `/odds` response fixture.

## Rollout

1. Migration + `ODDS_API_KEY` in env (local, then Vercel).
2. Ship client + earnings + leaderboard changes.
3. Run `backfill-odds.ts` once against the DB to price played matches.
4. Daily cron captures upcoming matches from then on.

## Out of scope

- Per-match earnings breakdown on `/me` or match detail (could follow later).
- Letting earnings affect ranking or unlock achievements.
- Multiple regions / per-bookmaker views / best-price line shopping.
