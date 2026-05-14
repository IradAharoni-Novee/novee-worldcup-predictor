// Thin client for football-data.org v4. Free tier: 10 requests/min.
// Docs: https://www.football-data.org/documentation/api

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC";

type FdTeam = {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
};

type FdScore = {
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
};

export type FdMatch = {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "POSTPONED"
    | "SUSPENDED"
    | "CANCELLED";
  stage:
    | "GROUP_STAGE"
    | "LAST_16"
    | "LAST_32"
    | "ROUND_OF_16"
    | "QUARTER_FINALS"
    | "SEMI_FINALS"
    | "THIRD_PLACE"
    | "FINAL";
  group: string | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: FdScore;
};

type FdMatchesResponse = {
  matches: FdMatch[];
};

function token(): string {
  const t = process.env.FOOTBALL_DATA_TOKEN;
  if (!t) throw new Error("FOOTBALL_DATA_TOKEN env var is required");
  return t;
}

export async function fetchWorldCupMatches(): Promise<FdMatch[]> {
  const res = await fetch(`${BASE_URL}/competitions/${COMPETITION_CODE}/matches`, {
    headers: { "X-Auth-Token": token() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `football-data.org returned ${res.status} ${res.statusText}: ${await res.text()}`
    );
  }
  const data = (await res.json()) as FdMatchesResponse;
  return data.matches;
}
