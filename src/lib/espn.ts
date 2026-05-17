// Thin client for ESPN's public site API. Used by the venue sync to read
// stadium + city + country per match. ESPN's scoreboard is paged by UTC date
// (YYYYMMDD); each event includes venue and competitor info.

const BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export type EspnCompetitor = {
  homeAway: "home" | "away";
  team: { displayName: string; abbreviation: string };
};

export type EspnEvent = {
  id: string;
  date: string;
  competitions: Array<{
    venue?: {
      fullName?: string;
      address?: { city?: string; country?: string };
    };
    competitors: EspnCompetitor[];
  }>;
};

type EspnScoreboardResponse = {
  events?: EspnEvent[];
};

export async function fetchEspnDay(yyyymmddDate: string): Promise<EspnEvent[]> {
  const res = await fetch(`${BASE_URL}?dates=${yyyymmddDate}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `ESPN scoreboard ${yyyymmddDate} returned ${res.status} ${res.statusText}: ${await res.text()}`
    );
  }
  const data = (await res.json()) as EspnScoreboardResponse;
  return data.events ?? [];
}
