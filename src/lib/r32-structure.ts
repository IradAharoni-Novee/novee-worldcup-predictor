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

// slot -> FIFA match, kept in the comments so the mapping is auditable.
export const R32_STRUCTURE: readonly R32Slot[] = [
  { slot: 0, home: winner("E"), away: third("E", ["A", "B", "C", "D", "F"]) }, // M74
  { slot: 1, home: winner("I"), away: third("I", ["C", "D", "F", "G", "H"]) }, // M77
  { slot: 2, home: runnerUp("A"), away: runnerUp("B") }, // M73
  { slot: 3, home: winner("F"), away: runnerUp("C") }, // M75
  { slot: 4, home: runnerUp("K"), away: runnerUp("L") }, // M83
  { slot: 5, home: winner("H"), away: runnerUp("J") }, // M84
  { slot: 6, home: winner("D"), away: third("D", ["B", "E", "F", "I", "J"]) }, // M81
  { slot: 7, home: winner("G"), away: third("G", ["A", "E", "H", "I", "J"]) }, // M82
  { slot: 8, home: winner("C"), away: runnerUp("F") }, // M76
  { slot: 9, home: runnerUp("E"), away: runnerUp("I") }, // M78
  { slot: 10, home: winner("A"), away: third("A", ["C", "E", "F", "H", "I"]) }, // M79
  { slot: 11, home: winner("L"), away: third("L", ["E", "H", "I", "J", "K"]) }, // M80
  { slot: 12, home: winner("J"), away: runnerUp("H") }, // M86
  { slot: 13, home: runnerUp("D"), away: runnerUp("G") }, // M88
  { slot: 14, home: winner("B"), away: third("B", ["E", "F", "G", "I", "J"]) }, // M85
  { slot: 15, home: winner("K"), away: third("K", ["D", "E", "I", "J", "L"]) }, // M87
];

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
