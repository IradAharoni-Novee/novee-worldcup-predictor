import { MatchStatus, Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchWorldCupMatches,
  fetchWorldCupSquads,
  type FdMatch,
  type FdScore,
} from "@/lib/football-data";
import { fetchEspnDay, type EspnEvent } from "@/lib/espn";
import { fetchCurrentOdds } from "@/lib/odds-api";
import { isKnockout } from "@/lib/scoring";
import {
  isoMinute,
  normaliseName,
  pickByTeamsAtMinute,
} from "@/lib/match-reconcile";

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

  // Existing teams per match. FD's free tier reports knockout matchups as null
  // long after they're set, so keep the teams we already know (see
  // reconcileTeamId). Scores, status, penalties, and advancement are owned by
  // the per-minute API-Football sync (syncLiveScores) — this feed writes only
  // structure (stage, group, kickoff, teams), so a lagging or quirky FD result
  // can never clobber the real one.
  const existing = await prisma.match.findMany({
    where: { fdId: { in: matches.map((m) => m.id) } },
    select: { fdId: true, homeTeamId: true, awayTeamId: true },
  });
  const existingByFd = new Map(existing.map((m) => [m.fdId, m]));

  for (const m of matches) {
    const homeId = m.homeTeam?.id ? teamIdByFd.get(m.homeTeam.id) ?? null : null;
    const awayId = m.awayTeam?.id ? teamIdByFd.get(m.awayTeam.id) ?? null : null;
    const prev = existingByFd.get(m.id);
    // A freshly-created row defaults to status SCHEDULED with null scores; the
    // live sync fills the result once the match kicks off.
    const fields = {
      stage: mapStage(m.stage),
      group: groupCode(m.group),
      kickoff: new Date(m.utcDate),
      homeTeamId: reconcileTeamId(homeId, prev?.homeTeamId),
      awayTeamId: reconcileTeamId(awayId, prev?.awayTeamId),
    };
    await prisma.match.upsert({
      where: { fdId: m.id },
      create: { fdId: m.id, ...fields },
      update: fields,
    });
  }

  return { teamsUpserted: teamsById.size, matchesUpserted: matches.length };
}

// Map a football-data.org match status to ours. Returns null for statuses
// that carry no usable result (not started, postponed, cancelled, suspended,
// …) so the sync leaves those matches untouched.
export function mapFdStatus(status: FdMatch["status"]): MatchStatus | null {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return MatchStatus.LIVE;
    case "FINISHED":
      return MatchStatus.FINISHED;
    default:
      return null;
  }
}

// The score line the app stores: goals after at most 120', shootout separate.
// FD's fullTime includes shootout goals when duration is PENALTY_SHOOTOUT, so
// the 120' line there is regularTime + extraTime; for REGULAR and EXTRA_TIME
// durations fullTime is already that line (the current score while in play).
// Returns null while FD hasn't published the needed fields, so the sync skips
// the match until the next tick.
export function fdResult(score: FdScore): {
  homeScore: number;
  awayScore: number;
  penaltyHome: number | null;
  penaltyAway: number | null;
} | null {
  if (score.duration === "PENALTY_SHOOTOUT") {
    const { regularTime: rt, extraTime: et, penalties: p } = score;
    if (rt?.home == null || rt.away == null) return null;
    if (et?.home == null || et.away == null) return null;
    if (p?.home == null || p.away == null) return null;
    return {
      homeScore: rt.home + et.home,
      awayScore: rt.away + et.away,
      penaltyHome: p.home,
      penaltyAway: p.away,
    };
  }
  const ft = score.fullTime;
  if (ft.home == null || ft.away == null) return null;
  return { homeScore: ft.home, awayScore: ft.away, penaltyHome: null, penaltyAway: null };
}

// Decide which team to keep for a fixture's side. football-data.org's free tier
// reports knockout fixtures with null teams long after the matchup is decided —
// the same lag reconcileScore guards against for scores. Once a knockout match
// has its real teams (from a later FD payload or written directly), a stale feed
// must not wipe them back to "TBD". So keep the existing team whenever the
// incoming side is null; a non-null incoming value still wins, letting the first
// real assignment — or a genuine correction — propagate.
export function reconcileTeamId(
  incoming: string | null,
  existing: string | null | undefined
): string | null {
  return incoming ?? existing ?? null;
}

// Per-minute live-score sync. Pulls current scores + status from
// football-data.org for matches that have kicked off but aren't finished, and
// writes score, penalties, status, and knockout advancer. The free tier lags
// in-play matches by a few minutes — API-Football refreshes every ~15s, but
// its free plan can't serve the current season at all. One request covers the
// whole competition and matches are joined by fdId. Unlike
// syncFromFootballData it touches no teams, kickoffs, venues, or squads.
export async function syncLiveScores(): Promise<{ updated: number }> {
  const now = new Date();
  const matches = await prisma.match.findMany({
    where: { status: { not: MatchStatus.FINISHED }, kickoff: { lte: now } },
    select: {
      id: true,
      fdId: true,
      stage: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  if (matches.length === 0) return { updated: 0 };

  const fdById = new Map((await fetchWorldCupMatches()).map((m) => [m.id, m]));

  let updated = 0;
  for (const m of matches) {
    const fd = fdById.get(m.fdId);
    if (!fd) continue;
    const status = mapFdStatus(fd.status);
    if (!status) continue;
    const result = fdResult(fd.score);
    if (!result) continue;
    // Only knockouts have an advancer; leave it untouched (undefined → Prisma
    // skips it) until FD names a winner, which it only does once the match is
    // decided, including extra time and shootouts.
    const advancingTeamId =
      isKnockout(m.stage) && fd.score.winner && fd.score.winner !== "DRAW"
        ? fd.score.winner === "HOME_TEAM"
          ? m.homeTeamId
          : m.awayTeamId
        : undefined;
    const res = await prisma.match.updateMany({
      where: { id: m.id },
      data: { ...result, status, advancingTeamId },
    });
    updated += res.count;
  }
  return { updated };
}

/**
 * Capture pre-match odds for every upcoming game in the daily cron.
 *
 * Fetches the-odds-api current board once (all upcoming/live games, one credit),
 * reconciles each not-yet-kicked-off DB match to an event via the shared
 * team/kickoff rules (see match-reconcile.ts), and writes the averaged 1/X/2
 * decimal odds plus `oddsUpdatedAt`. Re-running daily overwrites until kickoff
 * freezes the last pre-match value. Matches with no confident event match are
 * left untouched.
 *
 * @returns The number of matches whose odds were written.
 */
export async function syncOddsFromOddsApi(): Promise<{ oddsUpdated: number }> {
  const now = new Date();
  const matches = await prisma.match.findMany({
    where: { kickoff: { gt: now } },
    select: {
      id: true,
      kickoff: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  if (matches.length === 0) return { oddsUpdated: 0 };

  const oddsEvents = await fetchCurrentOdds();
  const candidates = oddsEvents.map((e) => ({
    homeName: e.homeName,
    awayName: e.awayName,
    date: e.date,
    odds: e.odds,
  }));

  let oddsUpdated = 0;
  for (const m of matches) {
    const chosen = pickByTeamsAtMinute(
      {
        homeName: m.homeTeam?.name ?? "",
        awayName: m.awayTeam?.name ?? "",
        kickoff: m.kickoff,
      },
      candidates
    );
    if (!chosen) continue;
    await prisma.match.update({
      where: { id: m.id },
      data: {
        oddsHome: chosen.odds.home,
        oddsDraw: chosen.odds.draw,
        oddsAway: chosen.odds.away,
        oddsUpdatedAt: new Date(),
      },
    });
    oddsUpdated += 1;
  }
  return { oddsUpdated };
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
