import { MatchStatus, Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchWorldCupMatches,
  fetchWorldCupSquads,
  type FdMatch,
} from "@/lib/football-data";
import { fetchEspnDay, type EspnEvent } from "@/lib/espn";
import {
  fetchWorldCupFixturesByDate,
  type AfFixture,
} from "@/lib/api-football";
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

// Resolve football-data.org's winner code to one of our team ids. FD reports the
// shootout winner here for penalty-decided knockouts, so it captures advancement
// the (drawn) score can't. Returns null for draws or undecided matches.
function fdWinnerToTeamId(
  winner: FdMatch["score"]["winner"],
  homeTeamId: string | null,
  awayTeamId: string | null
): string | null {
  if (winner === "HOME_TEAM") return homeTeamId;
  if (winner === "AWAY_TEAM") return awayTeamId;
  return null;
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

  // Current score/status/teams per match, so a lagging FD feed can't overwrite
  // scores the per-minute live sync already wrote (see reconcileScore) or null
  // out knockout teams we already know (see reconcileTeamId).
  const existing = await prisma.match.findMany({
    where: { fdId: { in: matches.map((m) => m.id) } },
    select: {
      fdId: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeTeamId: true,
      awayTeamId: true,
      advancingTeamId: true,
    },
  });
  const existingByFd = new Map(existing.map((m) => [m.fdId, m]));

  for (const m of matches) {
    const homeId = m.homeTeam?.id ? teamIdByFd.get(m.homeTeam.id) ?? null : null;
    const awayId = m.awayTeam?.id ? teamIdByFd.get(m.awayTeam.id) ?? null : null;
    const prev = existingByFd.get(m.id);
    const score = reconcileScore(
      {
        status: mapStatus(m.status),
        home: m.score.fullTime.home,
        away: m.score.fullTime.away,
      },
      prev
        ? { status: prev.status, home: prev.homeScore, away: prev.awayScore }
        : null
    );
    const stage = mapStage(m.stage);
    const homeTeamId = reconcileTeamId(homeId, prev?.homeTeamId);
    const awayTeamId = reconcileTeamId(awayId, prev?.awayTeamId);
    // Advancement only applies to knockouts. As with score/team, a lagging FD
    // feed that hasn't reported a winner yet (null) must not wipe a value the
    // live sync already wrote — keep the existing one until FD carries a winner.
    const incomingAdvancing = isKnockout(stage)
      ? fdWinnerToTeamId(m.score.winner, homeTeamId, awayTeamId)
      : null;
    const fields = {
      stage,
      group: groupCode(m.group),
      kickoff: new Date(m.utcDate),
      homeTeamId,
      awayTeamId,
      homeScore: score.home,
      awayScore: score.away,
      advancingTeamId: incomingAdvancing ?? prev?.advancingTeamId ?? null,
      status: score.status,
    };
    await prisma.match.upsert({
      where: { fdId: m.id },
      create: { fdId: m.id, ...fields },
      update: fields,
    });
  }

  return { teamsUpserted: teamsById.size, matchesUpserted: matches.length };
}

// Map an API-Football fixture status short code to our MatchStatus. Returns
// null for statuses that carry no usable result (not started, postponed,
// cancelled, …) so the sync leaves those matches untouched.
export function mapApiFootballStatus(short: string): MatchStatus | null {
  switch (short) {
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "SUSP":
    case "INT":
    case "LIVE":
      return MatchStatus.LIVE;
    case "FT":
    case "AET":
    case "PEN":
      return MatchStatus.FINISHED;
    default:
      return null;
  }
}

type LiveMatch = {
  id: string;
  kickoff: Date;
  homeName: string;
  awayName: string;
  stage: Stage;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

// Pair a DB match with the API-Football fixture at the same kickoff minute,
// using the shared team/kickoff reconciliation rules (see match-reconcile.ts).
// Takes only the fields it reconciles on, so callers (and tests) needn't supply
// the rest of a LiveMatch.
export function pickFixture(
  match: { homeName: string; awayName: string; kickoff: Date },
  fixtures: AfFixture[]
): AfFixture | null {
  return pickByTeamsAtMinute(
    { homeName: match.homeName, awayName: match.awayName, kickoff: match.kickoff },
    fixtures
  );
}

type ScoreState = {
  status: MatchStatus;
  home: number | null;
  away: number | null;
};

// Decide which score/status the daily football-data.org sync should persist.
// FD's free tier can still report a match as not-started with no score long
// after kickoff (it reported the World Cup opener as TIMED a day later), while
// the per-minute API-Football live sync has already written the real result.
// Don't let the lagging feed clobber fresher data: keep what we have whenever FD
// brings nothing new. FD still wins once it carries a score or a non-scheduled
// status, so a genuine correction propagates.
export function reconcileScore(incoming: ScoreState, existing: ScoreState | null): ScoreState {
  if (!existing) return incoming;
  const incomingHasNothing =
    incoming.status === MatchStatus.SCHEDULED &&
    incoming.home === null &&
    incoming.away === null;
  const existingHasProgress =
    existing.status !== MatchStatus.SCHEDULED ||
    existing.home !== null ||
    existing.away !== null;
  return incomingHasNothing && existingHasProgress ? existing : incoming;
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

// Per-minute live-score sync. Pulls current scores + status from API-Football
// (which refreshes in-play fixtures every ~15s) for matches that have kicked
// off but aren't finished, and writes score + status. Querying by date — not
// the live-only feed — also captures the final score as a match ends. Unlike
// syncFromFootballData it touches no teams, kickoffs, venues, or squads.
export async function syncLiveScores(): Promise<{ updated: number }> {
  const now = new Date();
  const matches = await prisma.match.findMany({
    where: { status: { not: MatchStatus.FINISHED }, kickoff: { lte: now } },
    select: {
      id: true,
      kickoff: true,
      stage: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  if (matches.length === 0) return { updated: 0 };

  const live: LiveMatch[] = matches.map((m) => ({
    id: m.id,
    kickoff: m.kickoff,
    homeName: m.homeTeam?.name ?? "",
    awayName: m.awayTeam?.name ?? "",
    stage: m.stage,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
  }));

  // UTC date per kickoff (usually one); the date feed returns every match that
  // day with its current status, including matches that just ended.
  const dates = new Set(live.map((m) => m.kickoff.toISOString().slice(0, 10)));
  const fixtures = (await Promise.all([...dates].map(fetchWorldCupFixturesByDate))).flat();

  let updated = 0;
  for (const m of live) {
    const fixture = pickFixture(m, fixtures);
    if (!fixture) continue;
    const status = mapApiFootballStatus(fixture.statusShort);
    if (!status) continue;
    // Only knockouts have an advancer; leave it untouched (undefined → Prisma
    // skips it) until the fixture reports a winning side, including ET/penalties.
    const advancingTeamId =
      fixture.winnerSide && isKnockout(m.stage)
        ? fixture.winnerSide === "HOME"
          ? m.homeTeamId
          : m.awayTeamId
        : undefined;
    const res = await prisma.match.updateMany({
      where: { id: m.id },
      data: {
        homeScore: fixture.homeGoals,
        awayScore: fixture.awayGoals,
        status,
        advancingTeamId,
      },
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
