import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import type { Standing } from "@/lib/group-standings";

function standing(teamId: string): Standing {
  return {
    teamId,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  };
}

const actualOrder: Standing[] = [
  standing("A"),
  standing("B"),
  standing("C"),
  standing("D"),
];

describe("scoreGroupPrediction", () => {
  it("awards full credit for a perfect ranking", () => {
    const result = scoreGroupPrediction(
      { team1stId: "A", team2ndId: "B", team3rdId: "C", team4thId: "D" },
      actualOrder,
      DEFAULT_SCORING
    );
    expect(result).toEqual({ total: 12, exact: 4, halfRight: 0 });
  });

  it("awards 2 exact + 2 in correct half (top-2 swap, bottom-2 swap)", () => {
    const result = scoreGroupPrediction(
      { team1stId: "B", team2ndId: "A", team3rdId: "D", team4thId: "C" },
      actualOrder,
      DEFAULT_SCORING
    );
    // 0 exact, 4 in correct half → 0*3 + 4*1 = 4
    expect(result).toEqual({ total: 4, exact: 0, halfRight: 4 });
  });

  it("counts exact and half-right separately when mixed", () => {
    const result = scoreGroupPrediction(
      // A in 1st (exact), C in 2nd (correct top-half? no — C is in bottom half. wrong half)
      // B in 3rd (wrong half — top), D in 4th (exact)
      { team1stId: "A", team2ndId: "C", team3rdId: "B", team4thId: "D" },
      actualOrder,
      DEFAULT_SCORING
    );
    // exact: A (1st) and D (4th) = 2; halfRight: 0
    expect(result).toEqual({ total: 6, exact: 2, halfRight: 0 });
  });

  it("awards 0 for all picks in wrong half", () => {
    const result = scoreGroupPrediction(
      // Predicted top: C, D (actually bottom). Predicted bottom: A, B (actually top).
      { team1stId: "C", team2ndId: "D", team3rdId: "A", team4thId: "B" },
      actualOrder,
      DEFAULT_SCORING
    );
    expect(result).toEqual({ total: 0, exact: 0, halfRight: 0 });
  });

  it("returns zero when standings are not complete (only computed for finished groups)", () => {
    const result = scoreGroupPrediction(
      { team1stId: "A", team2ndId: "B", team3rdId: "C", team4thId: "D" },
      [standing("A"), standing("B")],
      DEFAULT_SCORING
    );
    expect(result.total).toBe(0);
  });

  it("respects custom scoring config", () => {
    const result = scoreGroupPrediction(
      { team1stId: "A", team2ndId: "B", team3rdId: "C", team4thId: "D" },
      actualOrder,
      { ...DEFAULT_SCORING, groupExactPosition: 5, groupQualifiedHalf: 2 }
    );
    expect(result.total).toBe(20); // 4 exact × 5
  });
});
