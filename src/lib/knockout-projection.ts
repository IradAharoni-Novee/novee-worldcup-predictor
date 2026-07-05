import { Stage } from "@prisma/client";
import { R32_FD_ID_TO_FIFA_MATCH, R32_STRUCTURE } from "@/lib/r32-structure";
import type { ProjectedSlot } from "@/lib/r32-projection";

export type KnockoutSide = {
  // The team to show once it is known: official, projected from group standings
  // (Round of 32), or the winner of a decided feeding match. Null when the side
  // is still a label.
  teamId: string | null;
  // What to show when there is no single team yet: the Round of 32 position
  // ("2nd A"), the feeding match's team options ("Germany / Scotland"), or a
  // reference to the feeding match ("Winner of R16 #1").
  label: string;
};

export type KnockoutMatchup = {
  home: KnockoutSide;
  away: KnockoutSide;
  // True when a side shows a real team projected from current group standings
  // that FIFA hasn't made official yet — i.e. the matchup can still change.
  provisional: boolean;
  // 1-based number within the round, shown on the card so deeper-round labels
  // ("Winner of R16 #1") point somewhere. Null for rounds nothing feeds from
  // (Round of 32, Final, third place).
  matchNo: number | null;
};

// football-data.org's match id -> bracket position for the Round of 16 and
// beyond. The Round of 32 is keyed separately via R32_FD_ID_TO_FIFA_MATCH.
// The slots follow the same feeder tree the bracket predictor uses: round slot
// i is fed by the two slots 2i and 2i+1 of the round below.
//
// Verified against the production schedule and FIFA's official fixture list
// (kickoff + venue) on 2026-06-22. Each row is `fdId: slot — FIFA match @ venue`.
export const KNOCKOUT_FD_ID_TO_SLOT: Readonly<
  Record<number, { round: Stage; slot: number }>
> = {
  // Round of 16
  537375: { round: Stage.R16, slot: 0 }, // M89 — Lincoln Financial Field, Philadelphia
  537376: { round: Stage.R16, slot: 1 }, // M90 — NRG Stadium, Houston
  537379: { round: Stage.R16, slot: 2 }, // M93 — AT&T Stadium, Arlington
  537380: { round: Stage.R16, slot: 3 }, // M94 — Lumen Field, Seattle
  537377: { round: Stage.R16, slot: 4 }, // M91 — MetLife Stadium, East Rutherford
  537378: { round: Stage.R16, slot: 5 }, // M92 — Estadio Banorte, Mexico City
  537381: { round: Stage.R16, slot: 6 }, // M95 — Mercedes-Benz Stadium, Atlanta
  537382: { round: Stage.R16, slot: 7 }, // M96 — BC Place, Vancouver
  // Quarter-finals
  537383: { round: Stage.QF, slot: 0 }, // M97 — Gillette Stadium, Foxborough
  537384: { round: Stage.QF, slot: 1 }, // M98 — SoFi Stadium, Inglewood
  537385: { round: Stage.QF, slot: 2 }, // M99 — Hard Rock Stadium, Miami Gardens
  537386: { round: Stage.QF, slot: 3 }, // M100 — GEHA Field at Arrowhead, Kansas City
  // Semi-finals
  537387: { round: Stage.SF, slot: 0 }, // M101 — AT&T Stadium, Arlington
  537388: { round: Stage.SF, slot: 1 }, // M102 — Mercedes-Benz Stadium, Atlanta
  // Final + third-place play-off
  537390: { round: Stage.FINAL, slot: 0 }, // M104 — MetLife Stadium, East Rutherford
  537389: { round: Stage.THIRD, slot: 0 }, // M103 — Hard Rock Stadium, Miami Gardens
};

// fdId -> Round of 32 bracket slot, derived from the FIFA-match map so a synced
// R32 fixture can be located in the feeder tree the same way R16+ ones are.
const R32_FD_ID_TO_SLOT: Readonly<Record<number, number>> = Object.fromEntries(
  Object.entries(R32_FD_ID_TO_FIFA_MATCH).map(([fdId, fifaMatch]) => [
    Number(fdId),
    R32_STRUCTURE.find((s) => s.fifaMatch === fifaMatch)?.slot ?? -1,
  ])
);

// A knockout match's live result, keyed by bracket position so the projection
// can walk the feeder tree (who won R32 slot 3, who occupies R16 slot 1, …).
export type KnockoutSlotResult = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  advancingTeamId: string | null;
};

export type KnockoutResults = ReadonlyMap<string, KnockoutSlotResult>;

export type KnockoutMatchInput = {
  fdId: number;
  stage: Stage;
  homeTeamId: string | null;
  awayTeamId: string | null;
  advancingTeamId: string | null;
};

function slotOf(match: { fdId: number; stage: Stage }): { round: Stage; slot: number } | null {
  if (match.stage === Stage.R32) {
    const slot = R32_FD_ID_TO_SLOT[match.fdId];
    return slot == null || slot < 0 ? null : { round: Stage.R32, slot };
  }
  return KNOCKOUT_FD_ID_TO_SLOT[match.fdId] ?? null;
}

function slotKey(round: Stage, slot: number): string {
  return `${round}:${slot}`;
}

// Index every knockout fixture by its bracket position, so the projection can
// resolve a slot from the winners feeding it.
export function buildKnockoutResults(matches: KnockoutMatchInput[]): KnockoutResults {
  const map = new Map<string, KnockoutSlotResult>();
  for (const m of matches) {
    const pos = slotOf(m);
    if (!pos) continue;
    map.set(slotKey(pos.round, pos.slot), {
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      advancingTeamId: m.advancingTeamId,
    });
  }
  return map;
}

// The round whose winners feed `round`.
const FEEDER_ROUND: Partial<Record<Stage, Stage>> = {
  [Stage.R16]: Stage.R32,
  [Stage.QF]: Stage.R16,
  [Stage.SF]: Stage.QF,
  [Stage.FINAL]: Stage.SF,
  [Stage.THIRD]: Stage.SF,
};

const ROUND_ABBR: Partial<Record<Stage, string>> = {
  [Stage.R32]: "R32",
  [Stage.R16]: "R16",
  [Stage.QF]: "QF",
  [Stage.SF]: "SF",
};

type ResolvedSide = { teamId: string | null; label: string; projected: boolean };

// A side resolves, in order: an official team for that slot; the winner of its
// decided feeding match (advancingTeamId); the feeding match's two options when
// both are concrete teams; otherwise a reference label. The Round of 32 seeds
// from group standings (projected, hence provisional). The cascade means each
// round rolls forward off the round below as results land — no waiting on the
// feed to report the matchup.
function makeResolver(
  r32Slots: ProjectedSlot[],
  results: KnockoutResults,
  resolveName: (teamId: string) => string | undefined
): (round: Stage, slot: number, side: 0 | 1) => ResolvedSide {
  const nameOf = (teamId: string, fallback: string): string =>
    resolveName(teamId) ?? fallback;

  // A short token for one feeder side inside an "A / B" options label: the team
  // name when known, the Round of 32 position label when that's all we have, or
  // null when the side itself isn't yet a single concrete team (so the caller
  // falls back to a "Winner of …" reference instead of nesting options).
  function optionToken(
    round: Stage,
    slot: number,
    side: 0 | 1
  ): { text: string; projected: boolean } | null {
    const r = resolve(round, slot, side);
    if (r.teamId) return { text: resolveName(r.teamId) ?? r.label, projected: r.projected };
    if (round === Stage.R32) return { text: r.label, projected: false };
    return null;
  }

  function semiFinalLoser(sfSlot: number): string | null {
    const sf = results.get(slotKey(Stage.SF, sfSlot));
    if (!sf?.advancingTeamId) return null;
    for (const side of [0, 1] as const) {
      const s = resolve(Stage.SF, sfSlot, side);
      if (s.teamId && s.teamId !== sf.advancingTeamId) return s.teamId;
    }
    return null;
  }

  function resolve(round: Stage, slot: number, side: 0 | 1): ResolvedSide {
    if (round === Stage.R32) {
      const result = results.get(slotKey(Stage.R32, slot));
      const official = side === 0 ? result?.homeTeamId : result?.awayTeamId;
      const projected = r32Slots[slot];
      const projId = side === 0 ? projected?.homeId : projected?.awayId;
      const label = (side === 0 ? projected?.homeLabel : projected?.awayLabel) ?? "TBD";
      if (official) return { teamId: official, label: nameOf(official, label), projected: false };
      if (projId) return { teamId: projId, label, projected: true };
      return { teamId: null, label, projected: false };
    }

    const result = results.get(slotKey(round, slot));
    const official = side === 0 ? result?.homeTeamId : result?.awayTeamId;
    if (official) return { teamId: official, label: nameOf(official, official), projected: false };

    const feederRound = FEEDER_ROUND[round];
    if (!feederRound) return { teamId: null, label: "TBD", projected: false };
    const feederSlot = round === Stage.THIRD ? side : slot * 2 + side;

    if (round === Stage.THIRD) {
      const loserId = semiFinalLoser(feederSlot);
      if (loserId) return { teamId: loserId, label: nameOf(loserId, loserId), projected: false };
      return { teamId: null, label: `Loser of SF #${feederSlot + 1}`, projected: false };
    }

    const feeder = results.get(slotKey(feederRound, feederSlot));
    if (feeder?.advancingTeamId) {
      const winner = feeder.advancingTeamId;
      return { teamId: winner, label: nameOf(winner, winner), projected: false };
    }

    const home = optionToken(feederRound, feederSlot, 0);
    const away = optionToken(feederRound, feederSlot, 1);
    if (home && away) {
      return {
        teamId: null,
        label: `${home.text} / ${away.text}`,
        projected: home.projected || away.projected,
      };
    }
    return {
      teamId: null,
      label: `Winner of ${ROUND_ABBR[feederRound]} #${feederSlot + 1}`,
      projected: false,
    };
  }

  return resolve;
}

// Resolve what to show for one knockout fixture whose teams aren't both official
// yet, walking the feeder tree from live results so each round rolls forward as
// the round below is decided. Returns null for a finalised fixture (both teams
// official — the caller renders them directly), an unknown id, or a group match.
export function liveKnockoutMatchup(
  match: {
    fdId: number;
    stage: Stage;
    homeTeamId: string | null;
    awayTeamId: string | null;
  },
  r32Slots: ProjectedSlot[],
  resolveName: (teamId: string) => string | undefined,
  results: KnockoutResults = new Map()
): KnockoutMatchup | null {
  const pos = slotOf(match);
  if (!pos) return null;
  if (match.homeTeamId && match.awayTeamId) return null;

  // The fixture's own official teams (one side may already be set) take
  // precedence over anything the feeder tree would project.
  const merged = new Map(results);
  const key = slotKey(pos.round, pos.slot);
  merged.set(key, {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    advancingTeamId: results.get(key)?.advancingTeamId ?? null,
  });

  const resolve = makeResolver(r32Slots, merged, resolveName);
  const home = resolve(pos.round, pos.slot, 0);
  const away = resolve(pos.round, pos.slot, 1);
  const numbered =
    pos.round === Stage.R16 || pos.round === Stage.QF || pos.round === Stage.SF;
  return {
    home: { teamId: home.teamId, label: home.label },
    away: { teamId: away.teamId, label: away.label },
    provisional: home.projected || away.projected,
    matchNo: numbered ? pos.slot + 1 : null,
  };
}

// The two teams a knockout fixture is actually contested between, or null while
// the matchup can still change. A matchup rolled forward from decided prior
// rounds is determined — its teams are real — whereas one still projected from
// live group standings (provisional) or only partly resolved is not. Used to
// decide when a shootout-winner pick can be offered and stored for a fixture the
// feed hasn't formally populated yet.
export function determinedMatchupTeams(
  matchup: KnockoutMatchup | null
): { homeTeamId: string; awayTeamId: string } | null {
  if (!matchup || matchup.provisional) return null;
  if (matchup.home.teamId == null || matchup.away.teamId == null) return null;
  return { homeTeamId: matchup.home.teamId, awayTeamId: matchup.away.teamId };
}
