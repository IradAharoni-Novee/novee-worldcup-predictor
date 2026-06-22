import { Stage } from "@prisma/client";
import { R32_FD_ID_TO_FIFA_MATCH } from "@/lib/r32-structure";
import type { ProjectedSlot } from "@/lib/r32-projection";

export type KnockoutSide = {
  // The team to show once it is known (official, or projected from group
  // standings for the Round of 32). Null when the side is still a label.
  teamId: string | null;
  // What to show when there is no single team yet: the Round of 32 position
  // ("2nd A"), the Round of 16 team options ("Germany / Scotland"), or a
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

// Abbreviation of the round that feeds a given round's matches.
const FEEDER_ROUND_LABEL: Partial<Record<Stage, string>> = {
  [Stage.QF]: "R16",
  [Stage.SF]: "QF",
  [Stage.FINAL]: "SF",
  [Stage.THIRD]: "SF",
};

// Resolve what to show for one knockout fixture whose teams aren't both set:
//   - Round of 32: the team projected into that slot, else its position label.
//   - Round of 16: the team options from each feeding R32 match ("A / B").
//   - QF and beyond: a reference to the feeding match ("Winner of R16 #1").
// Returns null for a finalised fixture, an unknown id, or a group match, so
// callers fall back to their normal rendering.
export function liveKnockoutMatchup(
  match: {
    fdId: number;
    stage: Stage;
    homeTeamId: string | null;
    awayTeamId: string | null;
  },
  r32Slots: ProjectedSlot[],
  resolveName: (teamId: string) => string | undefined
): KnockoutMatchup | null {
  if (match.homeTeamId && match.awayTeamId) return null;

  if (match.stage === Stage.R32) {
    const fifaMatch = R32_FD_ID_TO_FIFA_MATCH[match.fdId];
    const slot = r32Slots.find((s) => s.fifaMatch === fifaMatch);
    if (!slot) return null;
    const homeProjected = match.homeTeamId == null && slot.homeId != null;
    const awayProjected = match.awayTeamId == null && slot.awayId != null;
    return {
      home: { teamId: match.homeTeamId ?? slot.homeId, label: slot.homeLabel },
      away: { teamId: match.awayTeamId ?? slot.awayId, label: slot.awayLabel },
      provisional: homeProjected || awayProjected,
      matchNo: null,
    };
  }

  const pos = KNOCKOUT_FD_ID_TO_SLOT[match.fdId];
  if (!pos || pos.round !== match.stage) return null;

  if (pos.round === Stage.R16) {
    const feedHome = r32Slots[pos.slot * 2];
    const feedAway = r32Slots[pos.slot * 2 + 1];
    if (!feedHome || !feedAway) return null;
    return {
      home: {
        teamId: match.homeTeamId,
        label: teamOptions(feedHome, resolveName),
      },
      away: {
        teamId: match.awayTeamId,
        label: teamOptions(feedAway, resolveName),
      },
      provisional:
        (match.homeTeamId == null && hasProjectedTeam(feedHome)) ||
        (match.awayTeamId == null && hasProjectedTeam(feedAway)),
      matchNo: pos.slot + 1,
    };
  }

  const feeder = FEEDER_ROUND_LABEL[pos.round];
  if (!feeder) return null;
  const role = pos.round === Stage.THIRD ? "Loser" : "Winner";
  const terminal = pos.round === Stage.FINAL || pos.round === Stage.THIRD;
  return {
    home: {
      teamId: match.homeTeamId,
      label: `${role} of ${feeder} #${pos.slot * 2 + 1}`,
    },
    away: {
      teamId: match.awayTeamId,
      label: `${role} of ${feeder} #${pos.slot * 2 + 2}`,
    },
    provisional: false,
    matchNo: terminal ? null : pos.slot + 1,
  };
}

// "Germany / Scotland" — the two teams that could win a feeding R32 match,
// each resolved to its name when known, else its group-position label.
function teamOptions(
  slot: ProjectedSlot,
  resolveName: (teamId: string) => string | undefined
): string {
  const home = slot.homeId ? resolveName(slot.homeId) ?? slot.homeLabel : slot.homeLabel;
  const away = slot.awayId ? resolveName(slot.awayId) ?? slot.awayLabel : slot.awayLabel;
  return `${home} / ${away}`;
}

function hasProjectedTeam(slot: ProjectedSlot): boolean {
  return slot.homeId != null || slot.awayId != null;
}
