import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { scorePodiumPrediction } from "@/lib/scoring-podium";

const actual = ["A", "B", "C"];

describe("scorePodiumPrediction", () => {
  it("awards full credit for a perfect podium", () => {
    const result = scorePodiumPrediction(
      { firstId: "A", secondId: "B", thirdId: "C" },
      actual,
      DEFAULT_SCORING
    );
    // 3 exact × 10
    expect(result).toEqual({ total: 30, exact: 3, inTop3: 0 });
  });

  it("gives partial credit for right people in the wrong slots", () => {
    const result = scorePodiumPrediction(
      { firstId: "B", secondId: "A", thirdId: "C" },
      actual,
      DEFAULT_SCORING
    );
    // C exact (10), A and B on podium wrong slot (2 × 4)
    expect(result).toEqual({ total: 18, exact: 1, inTop3: 2 });
  });

  it("scores a name that misses the podium as zero", () => {
    const result = scorePodiumPrediction(
      { firstId: "A", secondId: "B", thirdId: "Z" },
      actual,
      DEFAULT_SCORING
    );
    // A and B exact (2 × 10), Z not on podium
    expect(result).toEqual({ total: 20, exact: 2, inTop3: 0 });
  });

  it("awards 0 when none of the picks land on the podium", () => {
    const result = scorePodiumPrediction(
      { firstId: "X", secondId: "Y", thirdId: "Z" },
      actual,
      DEFAULT_SCORING
    );
    expect(result).toEqual({ total: 0, exact: 0, inTop3: 0 });
  });

  it("returns zero before the podium is settled (fewer than 3 finishers)", () => {
    const result = scorePodiumPrediction(
      { firstId: "A", secondId: "B", thirdId: "C" },
      ["A", "B"],
      DEFAULT_SCORING
    );
    expect(result).toEqual({ total: 0, exact: 0, inTop3: 0 });
  });

  it("respects custom scoring config", () => {
    const result = scorePodiumPrediction(
      { firstId: "A", secondId: "B", thirdId: "C" },
      actual,
      { ...DEFAULT_SCORING, podiumExactPosition: 5, podiumInTop3: 2 }
    );
    expect(result.total).toBe(15); // 3 exact × 5
  });

  it("only counts the first three actual finishers", () => {
    const result = scorePodiumPrediction(
      { firstId: "A", secondId: "B", thirdId: "D" },
      ["A", "B", "C", "D"],
      DEFAULT_SCORING
    );
    // A, B exact; D is 4th, not on the podium
    expect(result).toEqual({ total: 20, exact: 2, inTop3: 0 });
  });
});
