import { MatchStatus, Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchWorldCupMatches,
  fetchWorldCupSquads,
  type FdMatch,
} from "@/lib/football-data";
import { fetchEspnDay, type EspnEvent } from "@/lib/espn";

function mapStage(stage: FdMatch["stage"]): Stage {
  switch (stage) {
    case "GROUP_STAGE":
      return Stage.GROUP;
    case "LAST_32":
      return Stage.R32;
    case "LAST_16":
    case "ROUND_OF_16":
      return Stage.R16;
    case "QUARTER_FINALS":
      return Stage.QF;
    case "SEMI_FINALS":
      return Stage.SF;
    case "THIRD_PLACE":
      return Stage.THIRD;
    case "FINAL":
      return Stage.FINAL;
  }
}

function mapStatus(status: FdMatch["status"]): MatchStatus {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return MatchStatus.LIVE;
    case "FINISHED":
      return MatchStatus.FINISHED;
    default:
      return MatchStatus.SCHEDULED;
  }
}

function groupCode(group: string | null): string | null {
  if (!group) return null;
  // football-data.org returns "GROUP_A" (v4); older payloads use "Group A".
  // Normalise both to a single letter.
  const m = /^(?:Group\s+|GROUP_)([A-Z])$/.exec(group);
  return m?.[1] ?? group;
}

export type SyncResult = {
  teamsUpserted: number;
  matchesUpserted: number;
};

export async function syncFromFootballData(): Promise<SyncResult> {
  const matches = await fetchWorldCupMatches();

  // Dedupe teams across matches so we hit the DB once per team
  const teamsById = new Map<number, FdMatch["homeTeam"]>();
  for (const m of matches) {
    if (m.homeTeam?.id) teamsById.set(m.homeTeam.id, m.homeTeam);
    if (m.awayTeam?.id) teamsById.set(m.awayTeam.id, m.awayTeam);
  }

  for (const t of teamsById.values()) {
    await prisma.team.upsert({
      where: { fdId: t.id },
      create: {
        fdId: t.id,
        name: t.name,
        code: t.tla ?? t.shortName?.slice(0, 3).toUpperCase() ?? `T${t.id}`,
        flag: t.crest,
      },
      update: {
        name: t.name,
        code: t.tla ?? t.shortName?.slice(0, 3).toUpperCase() ?? `T${t.id}`,
        flag: t.crest,
      },
    });
  }

  // Build a map: fdTeamId -> our Team.id
  const allTeams = await prisma.team.findMany({
    where: { fdId: { in: Array.from(teamsById.keys()) } },
    select: { id: true, fdId: true },
  });
  const teamIdByFd = new Map(allTeams.map((t) => [t.fdId, t.id]));

  for (const m of matches) {
    const homeId = m.homeTeam?.id ? teamIdByFd.get(m.homeTeam.id) ?? null : null;
    const awayId = m.awayTeam?.id ? teamIdByFd.get(m.awayTeam.id) ?? null : null;
    await prisma.match.upsert({
      where: { fdId: m.id },
      create: {
        fdId: m.id,
        stage: mapStage(m.stage),
        group: groupCode(m.group),
        kickoff: new Date(m.utcDate),
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        status: mapStatus(m.status),
      },
      update: {
        stage: mapStage(m.stage),
        group: groupCode(m.group),
        kickoff: new Date(m.utcDate),
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        status: mapStatus(m.status),
      },
    });
  }

  return { teamsUpserted: teamsById.size, matchesUpserted: matches.length };
}

export type SyncVenuesResult = {
  matchesUpdated: number;
  matchesUnmatched: number;
};

function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

function isoMinute(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 16);
}

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

type MatchForVenueSync = {
  id: string;
  kickoff: Date;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
};

function pickEspnEvent(
  match: MatchForVenueSync,
  candidates: EspnEvent[]
): EspnEvent | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  // Disambiguate by team display name; diacritic-strip so Türkiye/Turkey
  // and similar match. Pure key match — strings shown to users come from
  // ESPN unmodified later.
  const fdHome = normaliseName(match.homeTeam?.name ?? "");
  const fdAway = normaliseName(match.awayTeam?.name ?? "");
  for (const e of candidates) {
    const home = e.competitions[0]?.competitors.find(
      (c) => c.homeAway === "home"
    );
    const away = e.competitions[0]?.competitors.find(
      (c) => c.homeAway === "away"
    );
    if (!home || !away) continue;
    const eHome = normaliseName(home.team.displayName);
    const eAway = normaliseName(away.team.displayName);
    if (
      (eHome === fdHome && eAway === fdAway) ||
      (eHome === fdAway && eAway === fdHome)
    ) {
      return e;
    }
  }
  return null;
}

// Pull venue/city/country from ESPN for every Match in the DB and write the
// values back. One ESPN call per unique UTC day. ESPN populates venue even
// for knockout matches with TBD competitors, so this works for the full
// tournament. Matches that can't be paired with an ESPN event are skipped.
export async function syncVenuesFromEspn(): Promise<SyncVenuesResult> {
  const matches = await prisma.match.findMany({
    select: {
      id: true,
      kickoff: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  if (matches.length === 0) return { matchesUpdated: 0, matchesUnmatched: 0 };

  // Unique UTC days padded ±1 to cover local-time skew between APIs.
  const days = new Set<string>();
  for (const m of matches) {
    const ms = m.kickoff.getTime();
    for (const offset of [-1, 0, 1]) {
      days.add(yyyymmdd(new Date(ms + offset * 86_400_000)));
    }
  }

  const dayResults = await Promise.all([...days].map(fetchEspnDay));
  const byMinute = new Map<string, EspnEvent[]>();
  for (const events of dayResults) {
    for (const e of events) {
      const key = isoMinute(e.date);
      const list = byMinute.get(key) ?? [];
      list.push(e);
      byMinute.set(key, list);
    }
  }

  // Two-pass: exact team-name match first, then pair up the unique leftover
  // at the same timestamp. The second pass handles spelling variants the
  // normaliser doesn't equate (e.g., Türkiye / Turkey).
  const claimed = new Map<string, Set<string>>();
  function claim(minute: string, espnId: string) {
    const set = claimed.get(minute) ?? new Set<string>();
    set.add(espnId);
    claimed.set(minute, set);
  }
  function unclaimedAt(minute: string): EspnEvent[] {
    const all = byMinute.get(minute) ?? [];
    const taken = claimed.get(minute) ?? new Set<string>();
    return all.filter((e) => !taken.has(e.id));
  }

  const resolved = new Map<string, EspnEvent>(); // matchId → event
  const deferred: MatchForVenueSync[] = [];

  for (const m of matches) {
    const minute = isoMinute(m.kickoff);
    const candidates = byMinute.get(minute) ?? [];
    const chosen = pickEspnEvent(m, candidates);
    if (chosen) {
      claim(minute, chosen.id);
      resolved.set(m.id, chosen);
    } else {
      deferred.push(m);
    }
  }
  for (const m of deferred) {
    const minute = isoMinute(m.kickoff);
    const leftovers = unclaimedAt(minute);
    if (leftovers.length === 1) {
      const chosen = leftovers[0]!;
      claim(minute, chosen.id);
      resolved.set(m.id, chosen);
    }
  }

  let matchesUpdated = 0;
  let matchesUnmatched = 0;
  for (const m of matches) {
    const e = resolved.get(m.id);
    if (!e) {
      matchesUnmatched += 1;
      continue;
    }
    const venue = e.competitions[0]?.venue;
    if (!venue?.fullName) {
      matchesUnmatched += 1;
      continue;
    }
    await prisma.match.update({
      where: { id: m.id },
      data: {
        venue: venue.fullName,
        city: venue.address?.city ?? null,
        country: venue.address?.country ?? null,
      },
    });
    matchesUpdated += 1;
  }

  return { matchesUpdated, matchesUnmatched };
}

export type SyncSquadsResult = {
  playersUpserted: number;
  teamsFound: number;
};

export async function syncSquadsFromFootballData(): Promise<SyncSquadsResult> {
  const teams = await fetchWorldCupSquads();

  const allTeams = await prisma.team.findMany({ select: { id: true, fdId: true } });
  const teamIdByFd = new Map(allTeams.map((t) => [t.fdId, t.id]));

  let playersUpserted = 0;
  for (const t of teams) {
    const localTeamId = teamIdByFd.get(t.id) ?? null;
    for (const p of t.squad ?? []) {
      await prisma.player.upsert({
        where: { fdId: p.id },
        create: {
          fdId: p.id,
          name: p.name,
          position: p.position,
          dateOfBirth: p.dateOfBirth,
          nationality: p.nationality,
          teamId: localTeamId,
        },
        update: {
          name: p.name,
          position: p.position,
          dateOfBirth: p.dateOfBirth,
          nationality: p.nationality,
          teamId: localTeamId,
        },
      });
      playersUpserted += 1;
    }
  }

  return { playersUpserted, teamsFound: teams.length };
}
