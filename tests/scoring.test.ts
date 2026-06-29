import { describe, expect, it } from "vitest";
import { Stage } from "@prisma/client";
import {
  DEFAULT_SCORING,
  scoreMatchTotal,
  scorePrediction,
  scoreShootoutBonus,
  summarize,
} from "@/lib/scoring";

const groupMatch = (home: number, away: number) => ({
  stage: Stage.GROUP,
  homeScore: home,
  awayScore: away,
});

const koMatch = (stage: Stage, home: number, away: number) => ({
  stage,
  homeScore: home,
  awayScore: away,
});

describe("scorePrediction", () => {
  it("awards 3 for an exact group-stage prediction", () => {
    expect(
      scorePrediction({ homeScore: 2, awayScore: 1 }, groupMatch(2, 1))
    ).toBe(3);
  });

  it("awards 1 for correct outcome (home win) on a group match", () => {
    expect(
      scorePrediction({ homeScore: 3, awayScore: 0 }, groupMatch(2, 1))
    ).toBe(1);
  });

  it("awards 1 for predicting a draw when the match was a draw", () => {
    expect(
      scorePrediction({ homeScore: 0, awayScore: 0 }, groupMatch(1, 1))
    ).toBe(1);
  });

  it("awards 0 when outcome is wrong", () => {
    expect(
      scorePrediction({ homeScore: 1, awayScore: 0 }, groupMatch(0, 2))
    ).toBe(0);
  });

  it("awards 0 when prediction is null (not submitted)", () => {
    expect(scorePrediction(null, groupMatch(1, 0))).toBe(0);
  });

  it("awards 0 when the match has no score yet", () => {
    expect(
      scorePrediction(
        { homeScore: 1, awayScore: 0 },
        { stage: Stage.GROUP, homeScore: null, awayScore: null }
      )
    ).toBe(0);
  });

  it("predicted draw vs actual win earns 0", () => {
    expect(
      scorePrediction({ homeScore: 1, awayScore: 1 }, groupMatch(2, 1))
    ).toBe(0);
  });

  it("doubles points for knockout stages", () => {
    expect(
      scorePrediction({ homeScore: 1, awayScore: 0 }, koMatch(Stage.R16, 1, 0))
    ).toBe(6); // exact * 2
    expect(
      scorePrediction({ homeScore: 3, awayScore: 0 }, koMatch(Stage.FINAL, 1, 0))
    ).toBe(2); // outcome * 2
  });

  it("respects a custom scoring config", () => {
    const config = {
      ...DEFAULT_SCORING,
      exactScore: 5,
      correctOutcome: 2,
      knockoutMultiplier: 3,
    };
    expect(
      scorePrediction({ homeScore: 2, awayScore: 1 }, koMatch(Stage.QF, 2, 1), config)
    ).toBe(15);
  });
});

describe("summarize", () => {
  it("aggregates totals across many matches", () => {
    const items = [
      {
        prediction: { homeScore: 2, awayScore: 1 },
        match: groupMatch(2, 1),
      }, // exact: +3
      {
        prediction: { homeScore: 1, awayScore: 0 },
        match: groupMatch(3, 1),
      }, // outcome: +1
      {
        prediction: { homeScore: 0, awayScore: 0 },
        match: groupMatch(1, 0),
      }, // wrong: 0
      {
        prediction: { homeScore: 1, awayScore: 1 },
        match: koMatch(Stage.SF, 1, 1),
      }, // exact knockout: +6
      {
        prediction: null,
        match: groupMatch(0, 0),
      }, // unsubmitted: 0, not counted
    ];
    const result = summarize(items, DEFAULT_SCORING);
    expect(result).toEqual({
      total: 10,
      exact: 2,
      outcome: 1,
      predictions: 4,
    });
  });
});

describe("scoreShootoutBonus", () => {
  // A knockout decided on penalties: 1–1 after 120', team A (home) advanced.
  const penaltyMatch = {
    stage: Stage.R32,
    homeTeamId: "A",
    awayTeamId: "B",
    homeScore: 1,
    awayScore: 1,
    advancingTeamId: "A",
  };

  it("awards the bonus for a decisive prediction of the side that advanced", () => {
    // Predicted A to win 2–1 → implied advancer A → correct.
    expect(
      scoreShootoutBonus(
        { homeScore: 2, awayScore: 1, shootoutWinnerTeamId: null },
        penaltyMatch
      )
    ).toBe(DEFAULT_SCORING.shootoutBonus);
  });

  it("awards the bonus for a drawn prediction with the correct shootout pick", () => {
    expect(
      scoreShootoutBonus(
        { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "A" },
        penaltyMatch
      )
    ).toBe(DEFAULT_SCORING.shootoutBonus);
  });

  it("gives nothing for a drawn prediction with the wrong (or no) shootout pick", () => {
    expect(
      scoreShootoutBonus(
        { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "B" },
        penaltyMatch
      )
    ).toBe(0);
    expect(
      scoreShootoutBonus(
        { homeScore: 0, awayScore: 0, shootoutWinnerTeamId: null },
        penaltyMatch
      )
    ).toBe(0);
  });

  it("gives nothing for a decisive prediction of the losing side", () => {
    // Predicted B to win 2–1 → implied advancer B → A advanced → no bonus.
    expect(
      scoreShootoutBonus(
        { homeScore: 1, awayScore: 2, shootoutWinnerTeamId: null },
        penaltyMatch
      )
    ).toBe(0);
  });

  it("gives nothing for a knockout decided in 90'/extra time (decisive score)", () => {
    // 2–1, A advanced — not a shootout, so the outcome points already cover it.
    expect(
      scoreShootoutBonus(
        { homeScore: 2, awayScore: 1, shootoutWinnerTeamId: null },
        {
          stage: Stage.R32,
          homeTeamId: "A",
          awayTeamId: "B",
          homeScore: 2,
          awayScore: 1,
          advancingTeamId: "A",
        }
      )
    ).toBe(0);
  });

  it("gives nothing for a group match", () => {
    expect(
      scoreShootoutBonus(
        { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "A" },
        {
          stage: Stage.GROUP,
          homeTeamId: "A",
          awayTeamId: "B",
          homeScore: 1,
          awayScore: 1,
          advancingTeamId: null,
        }
      )
    ).toBe(0);
  });

  it("respects a custom bonus value", () => {
    expect(
      scoreShootoutBonus(
        { homeScore: 2, awayScore: 1, shootoutWinnerTeamId: null },
        penaltyMatch,
        { ...DEFAULT_SCORING, shootoutBonus: 5 }
      )
    ).toBe(5);
  });
});

describe("scoreMatchTotal", () => {
  it("adds the scoreline points and the shootout bonus", () => {
    // Exact 1–1 knockout (3×2=6) plus the correct shootout pick.
    expect(
      scoreMatchTotal(
        { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "A" },
        {
          stage: Stage.R32,
          homeTeamId: "A",
          awayTeamId: "B",
          homeScore: 1,
          awayScore: 1,
          advancingTeamId: "A",
        }
      )
    ).toBe(
      DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier +
        DEFAULT_SCORING.shootoutBonus
    );
  });

  it("is just the scoreline points when no bonus applies", () => {
    expect(
      scoreMatchTotal(
        { homeScore: 2, awayScore: 1, shootoutWinnerTeamId: null },
        {
          stage: Stage.GROUP,
          homeTeamId: "A",
          awayTeamId: "B",
          homeScore: 2,
          awayScore: 1,
          advancingTeamId: null,
        }
      )
    ).toBe(DEFAULT_SCORING.exactScore);
  });
});
