import { describe, expect, it } from "vitest";
import { Stage } from "@prisma/client";
import { DEFAULT_SCORING } from "@/lib/scoring";
import {
  computeAdvancers,
  scoreBracketPicks,
  type KnockoutMatch,
} from "@/lib/scoring-bracket";

describe("computeAdvancers", () => {
  it("records the advancing team under its own stage", () => {
    const matches: KnockoutMatch[] = [
      { stage: Stage.R32, advancingTeamId: "A" },
      { stage: Stage.R32, advancingTeamId: "D" },
    ];
    const a = computeAdvancers(matches);
    expect([...a.R32].sort()).toEqual(["A", "D"]);
    expect(a.R16.size).toBe(0);
  });

  it("propagates advancers through rounds", () => {
    const matches: KnockoutMatch[] = [
      { stage: Stage.R32, advancingTeamId: "A" },
      { stage: Stage.R32, advancingTeamId: "D" },
      { stage: Stage.R16, advancingTeamId: "A" },
    ];
    const a = computeAdvancers(matches);
    expect([...a.R32].sort()).toEqual(["A", "D"]);
    expect([...a.R16]).toEqual(["A"]);
  });

  it("credits a penalty-shootout winner whose score stayed a draw", () => {
    // 1–1 after 120', A won on penalties: advancingTeamId is the only signal of
    // who went through — the score alone would (wrongly) credit nobody.
    const matches: KnockoutMatch[] = [{ stage: Stage.R32, advancingTeamId: "A" }];
    const a = computeAdvancers(matches);
    expect([...a.R32]).toEqual(["A"]);
  });

  it("ignores matches with no advancer yet", () => {
    const matches: KnockoutMatch[] = [{ stage: Stage.R32, advancingTeamId: null }];
    const a = computeAdvancers(matches);
    expect(a.R32.size).toBe(0);
  });
});

describe("scoreBracketPicks", () => {
  const advancers = {
    R32: new Set(["A", "B"]),    // A and B won their R32 matches
    R16: new Set(["A"]),         // A won its R16 match
    QF: new Set<string>(),
    SF: new Set<string>(),
    THIRD: new Set<string>(),
    FINAL: new Set<string>(),
  };

  it("awards round points when the predicted team actually won at that round", () => {
    const result = scoreBracketPicks(
      [
        { round: Stage.R32, slot: 0, teamId: "A" }, // correct
        { round: Stage.R32, slot: 1, teamId: "B" }, // correct
        { round: Stage.R16, slot: 0, teamId: "A" }, // correct
      ],
      advancers,
      DEFAULT_SCORING
    );
    expect(result.perRound.R32).toBe(2);
    expect(result.perRound.R16).toBe(2);
    expect(result.total).toBe(4);
  });

  it("awards zero for picks that didn't win at that round", () => {
    const result = scoreBracketPicks(
      [
        { round: Stage.R32, slot: 0, teamId: "C" }, // C didn't win R32
        { round: Stage.R16, slot: 0, teamId: "B" }, // B didn't win R16
      ],
      advancers,
      DEFAULT_SCORING
    );
    expect(result.total).toBe(0);
  });

  it("scores a partial bracket where only some R32 picks were right", () => {
    const result = scoreBracketPicks(
      [
        { round: Stage.R32, slot: 0, teamId: "A" }, // correct
        { round: Stage.R32, slot: 1, teamId: "Z" }, // not in advancers
      ],
      advancers,
      DEFAULT_SCORING
    );
    expect(result.perRound.R32).toBe(1);
    expect(result.total).toBe(1);
  });

  it("respects custom round point overrides", () => {
    const result = scoreBracketPicks(
      [{ round: Stage.FINAL, slot: 0, teamId: "A" }],
      { ...advancers, FINAL: new Set(["A"]) },
      { ...DEFAULT_SCORING, bracketRoundPoints: { ...DEFAULT_SCORING.bracketRoundPoints, FINAL: 50 } }
    );
    expect(result.perRound.FINAL).toBe(50);
  });
});
