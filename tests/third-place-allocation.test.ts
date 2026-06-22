import { describe, expect, it } from "vitest";
import {
  allocateThirdPlaces,
  THIRD_PLACE_WINNER_COLUMNS,
} from "@/lib/third-place-allocation";
import { R32_STRUCTURE } from "@/lib/r32-structure";

const GROUPS = "ABCDEFGHIJKL".split("");

// winnerGroup -> the groups its third-place opponent may come from, taken from
// the real R32 structure. The Annex C table must never assign outside these.
const ALLOWED = new Map<string, readonly string[]>();
for (const slot of R32_STRUCTURE) {
  for (const side of [slot.home, slot.away]) {
    if (side.kind === "third") ALLOWED.set(side.winnerGroup, side.anyOf);
  }
}

function combinations(items: string[], k: number): string[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const [head, ...rest] = items;
  return [
    ...combinations(rest, k - 1).map((c) => [head!, ...c]),
    ...combinations(rest, k),
  ];
}

describe("allocateThirdPlaces — Annex C", () => {
  it("only allocates for a complete set of eight groups", () => {
    expect(allocateThirdPlaces([]).size).toBe(0);
    expect(allocateThirdPlaces(["A", "B", "C"]).size).toBe(0);
    expect(allocateThirdPlaces(GROUPS.slice(0, 7)).size).toBe(0);
  });

  it("matches the published row for {E,F,G,H,I,J,K,L}", () => {
    const a = allocateThirdPlaces(["E", "F", "G", "H", "I", "J", "K", "L"]);
    expect(Object.fromEntries(a)).toEqual({
      A: "E",
      B: "J",
      D: "I",
      E: "F",
      G: "H",
      I: "G",
      K: "L",
      L: "K",
    });
  });

  it("resolves every one of the 495 combinations into a valid, constraint-respecting bijection", () => {
    const combos = combinations(GROUPS, 8);
    expect(combos).toHaveLength(495);

    for (const combo of combos) {
      const allocation = allocateThirdPlaces(combo);
      // every winner column is assigned exactly once
      expect([...allocation.keys()].sort()).toEqual(
        [...THIRD_PLACE_WINNER_COLUMNS].sort()
      );
      // the eight assigned thirds are exactly the combination (a bijection)
      expect([...allocation.values()].sort()).toEqual([...combo].sort());
      // each assignment respects the match's allowed group set
      for (const [winnerGroup, thirdGroup] of allocation) {
        expect(ALLOWED.get(winnerGroup)).toContain(thirdGroup);
      }
    }
  });

  it("never sends a third-placed team to a winner from outside its allowed groups", () => {
    // A team can only ever face the winners whose allowed set includes its group.
    for (const combo of combinations(GROUPS, 8)) {
      const allocation = allocateThirdPlaces(combo);
      for (const [winnerGroup, thirdGroup] of allocation) {
        // structurally a winner never faces its own group's third
        expect(thirdGroup).not.toBe(winnerGroup);
      }
    }
  });
});
