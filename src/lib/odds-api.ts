// Thin client for the-odds-api.com v4. Powers the "Estimated Earnings" column:
// per-match score predictions are settled at the average EU-region decimal odds
// for the predicted 1/X/2 outcome. Docs: https://the-odds-api.com/liveapi/guides/v4/
//
// The standard /odds endpoint returns only upcoming/live games (forward
// capture); played matches require the paid /historical endpoint (backfill).

const BASE_URL = "https://api.the-odds-api.com/v4";
const SPORT_KEY = "soccer_fifa_world_cup";
const REGIONS = "eu";
const MARKETS = "h2h";
const ODDS_FORMAT = "decimal";
const DRAW_OUTCOME = "Draw";

export type OutcomeOdds = { home: number; draw: number; away: number };

export type OddsEvent = {
  homeName: string;
  awayName: string;
  date: string;
  odds: OutcomeOdds;
};

type RawOutcome = { name: string; price: number };
type RawMarket = { key: string; outcomes: RawOutcome[] };
type RawBookmaker = { key: string; title: string; markets: RawMarket[] };

type RawOddsEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: RawBookmaker[];
};

// The /historical endpoint wraps the event array in a snapshot envelope.
type HistoricalResponse = { data: RawOddsEvent[] };

function key(): string {
  const k = process.env.ODDS_API_KEY;
  if (!k) throw new Error("ODDS_API_KEY env var is required");
  return k;
}

function h2hOutcomes(event: RawOddsEvent): RawOutcome[][] {
  return event.bookmakers
    .map((b) => b.markets.find((m) => m.key === MARKETS)?.outcomes)
    .filter((o): o is RawOutcome[] => o !== undefined);
}

function averagePrice(books: RawOutcome[][], name: string): number | null {
  const prices = books
    .map((outcomes) => outcomes.find((o) => o.name === name)?.price)
    .filter((p): p is number => p !== undefined);
  if (prices.length === 0) return null;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

/**
 * Average each 1/X/2 outcome's decimal price across every bookmaker.
 *
 * Outcomes are matched by name: the event's `home_team` / `away_team` and the
 * literal `"Draw"` label — never by array position. Returns null if any of the
 * three outcomes is missing or no bookmaker priced the event.
 */
export function averageEventOdds(event: RawOddsEvent): OutcomeOdds | null {
  const books = h2hOutcomes(event);
  const home = averagePrice(books, event.home_team);
  const draw = averagePrice(books, DRAW_OUTCOME);
  const away = averagePrice(books, event.away_team);
  if (home === null || draw === null || away === null) return null;
  return { home, draw, away };
}

/**
 * Map a raw current-odds array to `OddsEvent[]`, dropping any event whose odds
 * cannot be fully averaged (see {@link averageEventOdds}).
 */
export function parseOddsEvents(raw: RawOddsEvent[]): OddsEvent[] {
  const events: OddsEvent[] = [];
  for (const event of raw) {
    const odds = averageEventOdds(event);
    if (odds === null) continue;
    events.push({
      homeName: event.home_team,
      awayName: event.away_team,
      date: event.commence_time,
      odds,
    });
  }
  return events;
}

async function get(url: string, label: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `the-odds-api ${label} returned ${res.status} ${res.statusText}: ${await res.text()}`
    );
  }
  return res.json();
}

function query(): string {
  return `regions=${REGIONS}&markets=${MARKETS}&oddsFormat=${ODDS_FORMAT}&apiKey=${key()}`;
}

// Current odds for all upcoming/live World Cup events — one call, all games.
export async function fetchCurrentOdds(): Promise<OddsEvent[]> {
  const url = `${BASE_URL}/sports/${SPORT_KEY}/odds?${query()}`;
  const data = (await get(url, "odds")) as RawOddsEvent[];
  return parseOddsEvents(data);
}

// Closing-odds snapshot at a historical instant, for backfilling played matches.
export async function fetchHistoricalOdds(snapshotIso: string): Promise<OddsEvent[]> {
  const url = `${BASE_URL}/historical/sports/${SPORT_KEY}/odds?date=${snapshotIso}&${query()}`;
  const data = (await get(url, "historical odds")) as HistoricalResponse;
  return parseOddsEvents(data.data);
}
