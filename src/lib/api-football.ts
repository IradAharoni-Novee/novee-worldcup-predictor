// Thin client for API-Football (api-sports.io v3). Powers the per-minute
// live-score sync: football-data.org's free tier lags real time by many
// minutes, while API-Football refreshes in-play fixtures every ~15 seconds.
// Docs: https://www.api-football.com/documentation-v3

const BASE_URL = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE = 1;
const WORLD_CUP_SEASON = 2026;

export type AfFixture = {
  fixtureId: number;
  // ISO 8601 kickoff, e.g. "2026-06-11T19:00:00+00:00".
  date: string;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  // API-Football status short code: NS, 1H, HT, 2H, ET, BT, P, FT, AET, PEN, …
  statusShort: string;
  // Which side won, including extra time and penalty shootouts (API-Football
  // sets `teams.{home,away}.winner`). null until the result is decided.
  winnerSide: "HOME" | "AWAY" | null;
};

type AfFixtureResponse = {
  errors: unknown;
  response: Array<{
    fixture: { id: number; date: string; status: { short: string } };
    teams: {
      home: { name: string; winner: boolean | null };
      away: { name: string; winner: boolean | null };
    };
    goals: { home: number | null; away: number | null };
  }>;
};

function key(): string {
  const k = process.env.API_FOOTBALL_KEY;
  if (!k) throw new Error("API_FOOTBALL_KEY env var is required");
  return k;
}

function normalise(res: AfFixtureResponse): AfFixture[] {
  return res.response.map((f) => ({
    fixtureId: f.fixture.id,
    date: f.fixture.date,
    homeName: f.teams.home.name,
    awayName: f.teams.away.name,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
    statusShort: f.fixture.status.short,
    winnerSide: f.teams.home.winner
      ? "HOME"
      : f.teams.away.winner
        ? "AWAY"
        : null,
  }));
}

// All World Cup fixtures on a given UTC date (YYYY-MM-DD), with current status
// and score. Unlike the live-only feed this also returns just-finished matches,
// so the sync can flip a match to its final score.
export async function fetchWorldCupFixturesByDate(date: string): Promise<AfFixture[]> {
  const url = `${BASE_URL}/fixtures?league=${WORLD_CUP_LEAGUE}&season=${WORLD_CUP_SEASON}&date=${date}&timezone=UTC`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": key() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `API-Football fixtures ${date} returned ${res.status} ${res.statusText}: ${await res.text()}`
    );
  }
  const data = (await res.json()) as AfFixtureResponse;
  // API-Football returns 200 with a populated `errors` object on quota/auth
  // problems, so surface those instead of silently syncing nothing.
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }
  return normalise(data);
}
