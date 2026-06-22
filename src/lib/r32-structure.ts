// The official FIFA World Cup 2026 Round of 32 layout (Article 12.6). The 16
// matches (FIFA's M73–M88) are ordered into bracket slots 0–15 so that adjacent
// pairs feed the next round exactly as bracket-predictor-form wires them:
// R16 slot i = winner(R32 2i) v winner(R32 2i+1), and likewise up to the final.
//
// Each side of a match is a SlotSource:
//   { kind: "winner" | "runnerUp", group }      — 1st/2nd of a group
//   { kind: "third", winnerGroup, anyOf }        — best third-placed team that
//        Annex C allocates to this group winner's match (one of `anyOf` groups)
//
// Unlike the previous prediction-seeded approximation, this is the real bracket:
// it is filled from actual group results, not from any user's picks.

export type SlotSource =
  | { kind: "winner"; group: string }
  | { kind: "runnerUp"; group: string }
  | { kind: "third"; winnerGroup: string; anyOf: readonly string[] };

export type R32Slot = {
  slot: number;
  // FIFA's match number (M73–M88), the stable handle for this fixture in the
  // official schedule. Used to tie a synced Match row back to its bracket slot.
  fifaMatch: number;
  home: SlotSource;
  away: SlotSource;
};

const winner = (group: string): SlotSource => ({ kind: "winner", group });
const runnerUp = (group: string): SlotSource => ({ kind: "runnerUp", group });
const third = (winnerGroup: string, anyOf: readonly string[]): SlotSource => ({
  kind: "third",
  winnerGroup,
  anyOf,
});

export const R32_STRUCTURE: readonly R32Slot[] = [
  { slot: 0, fifaMatch: 74, home: winner("E"), away: third("E", ["A", "B", "C", "D", "F"]) },
  { slot: 1, fifaMatch: 77, home: winner("I"), away: third("I", ["C", "D", "F", "G", "H"]) },
  { slot: 2, fifaMatch: 73, home: runnerUp("A"), away: runnerUp("B") },
  { slot: 3, fifaMatch: 75, home: winner("F"), away: runnerUp("C") },
  { slot: 4, fifaMatch: 83, home: runnerUp("K"), away: runnerUp("L") },
  { slot: 5, fifaMatch: 84, home: winner("H"), away: runnerUp("J") },
  { slot: 6, fifaMatch: 81, home: winner("D"), away: third("D", ["B", "E", "F", "I", "J"]) },
  { slot: 7, fifaMatch: 82, home: winner("G"), away: third("G", ["A", "E", "H", "I", "J"]) },
  { slot: 8, fifaMatch: 76, home: winner("C"), away: runnerUp("F") },
  { slot: 9, fifaMatch: 78, home: runnerUp("E"), away: runnerUp("I") },
  { slot: 10, fifaMatch: 79, home: winner("A"), away: third("A", ["C", "E", "F", "H", "I"]) },
  { slot: 11, fifaMatch: 80, home: winner("L"), away: third("L", ["E", "H", "I", "J", "K"]) },
  { slot: 12, fifaMatch: 86, home: winner("J"), away: runnerUp("H") },
  { slot: 13, fifaMatch: 88, home: runnerUp("D"), away: runnerUp("G") },
  { slot: 14, fifaMatch: 85, home: winner("B"), away: third("B", ["E", "F", "G", "I", "J"]) },
  { slot: 15, fifaMatch: 87, home: winner("K"), away: third("K", ["D", "E", "I", "J", "L"]) },
];

// football-data.org's match id -> FIFA match number for the Round of 32. Our
// Match rows carry only football-data's opaque `fdId`; this is the bridge back
// to a bracket slot (via R32_STRUCTURE.fifaMatch), so the matches list can show
// the live projected matchup on a fixture whose teams aren't decided yet.
//
// Verified against the production schedule and FIFA's official fixture list
// (kickoff + venue) on 2026-06-22. Each row is `fdId: FIFA match — matchup @ venue`.
export const R32_FD_ID_TO_FIFA_MATCH: Readonly<Record<number, number>> = {
  537415: 74, // 1E v 3rd(A/B/C/D/F) — Gillette Stadium, Foxborough
  537416: 77, // 1I v 3rd(C/D/F/G/H) — MetLife Stadium, East Rutherford
  537417: 73, // 2A v 2B — SoFi Stadium, Inglewood
  537418: 75, // 1F v 2C — Estadio BBVA, Monterrey
  537419: 83, // 2K v 2L — BMO Field, Toronto
  537420: 84, // 1H v 2J — SoFi Stadium, Inglewood
  537421: 81, // 1D v 3rd(B/E/F/I/J) — Levi's Stadium, Santa Clara
  537422: 82, // 1G v 3rd(A/E/H/I/J) — Lumen Field, Seattle
  537423: 76, // 1C v 2F — NRG Stadium, Houston
  537424: 78, // 2E v 2I — AT&T Stadium, Arlington
  537425: 79, // 1A v 3rd(C/E/F/H/I) — Estadio Banorte, Mexico City
  537426: 80, // 1L v 3rd(E/H/I/J/K) — Mercedes-Benz Stadium, Atlanta
  537427: 86, // 1J v 2H — Hard Rock Stadium, Miami Gardens
  537428: 88, // 2D v 2G — AT&T Stadium, Arlington
  537429: 85, // 1B v 3rd(E/F/G/I/J) — BC Place, Vancouver
  537430: 87, // 1K v 3rd(D/E/I/J/L) — GEHA Field at Arrowhead, Kansas City
};

export function slotSourceLabel(source: SlotSource): string {
  switch (source.kind) {
    case "winner":
      return `1st ${source.group}`;
    case "runnerUp":
      return `2nd ${source.group}`;
    case "third":
      return `3rd ${source.anyOf.join("/")}`;
  }
}
