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

export function computeGroupStandings(matches: GroupMatch[]): Standing[] {
  const byTeam = new Map<string, Standing>();
  const get = (id: string): Standing => {
    const existing = byTeam.get(id);
    if (existing) return existing;
    const fresh = emptyStanding(id);
    byTeam.set(id, fresh);
    return fresh;
  };

  for (const m of matches) {
    if (
      m.homeTeamId == null ||
      m.awayTeamId == null ||
      m.homeScore == null ||
      m.awayScore == null
    ) {
      continue;
    }
    const home = get(m.homeTeamId);
    const away = get(m.awayTeamId);
    home.played += 1;
    away.played += 1;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (m.homeScore < m.awayScore) {
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

  for (const s of byTeam.values()) {
    s.gd = s.gf - s.ga;
  }

  return [...byTeam.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamId.localeCompare(b.teamId);
  });
}
