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

type FdSide = { home: number | null; away: number | null };

export type FdScore = {
  // For a finished knockout this reflects who went through, including extra time
  // and penalty shootouts (the shootout winner). "DRAW" only occurs for group
  // matches; null while the match is unplayed or in progress.
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  // REGULAR until a knockout goes past 90'. Beyond that the breakdown fields
  // appear alongside fullTime — and for PENALTY_SHOOTOUT, fullTime includes
  // the shootout goals themselves (e.g. 1-1 + pens 3-4 shows as 4-5).
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: FdSide;
  halfTime: FdSide;
  regularTime?: FdSide;
  extraTime?: FdSide;
  penalties?: FdSide;
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

export type FdPlayer = {
  id: number;
  name: string;
  position: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
};

type FdTeamWithSquad = {
  id: number;
  name: string;
  squad: FdPlayer[];
};

type FdTeamsResponse = {
  teams: FdTeamWithSquad[];
};

export async function fetchWorldCupSquads(): Promise<FdTeamWithSquad[]> {
  const res = await fetch(`${BASE_URL}/competitions/${COMPETITION_CODE}/teams`, {
    headers: { "X-Auth-Token": token() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `football-data.org returned ${res.status} ${res.statusText}: ${await res.text()}`
    );
  }
  const data = (await res.json()) as FdTeamsResponse;
  return data.teams;
}
