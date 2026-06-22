export type GroupMatch = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type Standing = {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

function emptyStanding(teamId: string): Standing {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  };
}

function isPlayed(
  m: GroupMatch
): m is GroupMatch & {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
} {
  return (
    m.homeTeamId != null &&
    m.awayTeamId != null &&
    m.homeScore != null &&
    m.awayScore != null
  );
}

// Overall ranking criteria (FIFA Article 12.4 a–c): points, then goal
// difference, then goals scored. Falls back to teamId so the order is stable.
// Head-to-head (12.4 d–f) is applied separately to teams that tie on a–c.
export function compareStandings(a: Standing, b: Standing): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.teamId.localeCompare(b.teamId);
}

function tiedOnOverall(a: Standing, b: Standing): boolean {
  return a.points === b.points && a.gd === b.gd && a.gf === b.gf;
}

// FIFA Article 12.4 d–f: rank teams still level on points/GD/GF by the results
// of the matches between those teams only. Mutates `run` in place. Conduct
// score (12.4 g) and FIFA ranking (12.4 h) need data we don't ingest, so teamId
// is the deterministic final fallback via compareStandings.
function applyHeadToHead(run: Standing[], matches: GroupMatch[]): void {
  const ids = new Set(run.map((s) => s.teamId));
  const mini = new Map<string, Standing>(
    run.map((s) => [s.teamId, emptyStanding(s.teamId)])
  );
  for (const m of matches) {
    if (!isPlayed(m)) continue;
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
    accumulate(mini, m.homeTeamId, m.awayTeamId, m.homeScore, m.awayScore);
  }
  for (const s of mini.values()) s.gd = s.gf - s.ga;
  run.sort((a, b) => compareStandings(mini.get(a.teamId)!, mini.get(b.teamId)!));
}

function accumulate(
  byTeam: Map<string, Standing>,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number
): void {
  const home = byTeam.get(homeId)!;
  const away = byTeam.get(awayId)!;
  home.played += 1;
  away.played += 1;
  home.gf += homeScore;
  home.ga += awayScore;
  away.gf += awayScore;
  away.ga += homeScore;
  if (homeScore > awayScore) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (homeScore < awayScore) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

// Compute a group table from its matches. `seedTeamIds` ensures every group
// member appears even before it has a finished match, so the projected bracket
// can read a provisional 1st–4th from the first kickoff onward. Unfinished
// matches (null scores) are ignored.
export function computeGroupStandings(
  matches: GroupMatch[],
  seedTeamIds: readonly string[] = []
): Standing[] {
  const byTeam = new Map<string, Standing>();
  const ensure = (id: string): Standing => {
    const existing = byTeam.get(id);
    if (existing) return existing;
    const fresh = emptyStanding(id);
    byTeam.set(id, fresh);
    return fresh;
  };

  for (const id of seedTeamIds) ensure(id);
  for (const m of matches) {
    if (!isPlayed(m)) continue;
    ensure(m.homeTeamId);
    ensure(m.awayTeamId);
    accumulate(byTeam, m.homeTeamId, m.awayTeamId, m.homeScore, m.awayScore);
  }

  for (const s of byTeam.values()) s.gd = s.gf - s.ga;

  const sorted = [...byTeam.values()].sort(compareStandings);

  // Layer head-to-head over the overall order: walk the sorted list and, for
  // each maximal run of teams tied on points/GD/GF, re-rank that run in place.
  const out: Standing[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && tiedOnOverall(sorted[i]!, sorted[j]!)) j += 1;
    const run = sorted.slice(i, j);
    if (run.length > 1) applyHeadToHead(run, matches);
    out.push(...run);
    i = j;
  }
  return out;
}
