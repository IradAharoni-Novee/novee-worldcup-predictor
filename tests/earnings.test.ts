import { describe, expect, it } from "vitest";

import { outcomeOf, oddsForOutcome, settleBet, STAKE } from "@/lib/earnings";

describe("outcomeOf", () => {
  it("returns H when home beats away", () => {
    expect(outcomeOf(2, 1)).toBe("H");
  });

  it("returns A when away beats home", () => {
    expect(outcomeOf(0, 3)).toBe("A");
  });

  it("returns D on a level score", () => {
    expect(outcomeOf(1, 1)).toBe("D");
  });
});

describe("oddsForOutcome", () => {
  const odds = { oddsHome: 2.5, oddsDraw: 3.1, oddsAway: 2.9 };

  it("maps H to the home field", () => {
    expect(oddsForOutcome("H", odds)).toBe(2.5);
  });

  it("maps D to the draw field", () => {
    expect(oddsForOutcome("D", odds)).toBe(3.1);
  });

  it("maps A to the away field", () => {
    expect(oddsForOutcome("A", odds)).toBe(2.9);
  });

  it("returns null when the mapped field is null", () => {
    expect(
      oddsForOutcome("H", { oddsHome: null, oddsDraw: 3.1, oddsAway: 2.9 })
    ).toBeNull();
  });
});

describe("settleBet", () => {
  it("pays net profit on a correct bet", () => {
    expect(settleBet("H", "H", 2.5)).toBe(150);
  });

  it("pays net profit on a correct draw bet", () => {
    expect(settleBet("D", "D", 3.1)).toBeCloseTo(210);
  });

  it("loses the stake on a wrong bet", () => {
    expect(settleBet("H", "A", 2.5)).toBe(-STAKE);
  });

  it("skips the bet (0) when odds are null", () => {
    expect(settleBet("H", "H", null)).toBe(0);
  });
});
