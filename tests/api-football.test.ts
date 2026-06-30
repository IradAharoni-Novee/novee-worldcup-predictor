import { describe, expect, it } from "vitest";
import { normalise, type AfFixtureResponse } from "@/lib/api-football";

function rawFixture(
  overrides: Partial<AfFixtureResponse["response"][number]> = {}
): AfFixtureResponse["response"][number] {
  return {
    fixture: { id: 1, date: "2026-06-29T19:00:00+00:00", status: { short: "PEN" } },
    teams: {
      home: { name: "Germany", winner: false },
      away: { name: "Paraguay", winner: true },
    },
    goals: { home: 1, away: 1 },
    score: { penalty: { home: 3, away: 4 } },
    ...overrides,
  };
}

describe("normalise", () => {
  it("reads the shootout score from score.penalty, not goals", () => {
    const [f] = normalise({ errors: {}, response: [rawFixture()] });
    expect(f).toMatchObject({
      homeGoals: 1,
      awayGoals: 1,
      penaltyHome: 3,
      penaltyAway: 4,
      winnerSide: "AWAY",
    });
  });

  it("leaves penalties null for a match without a shootout", () => {
    const [f] = normalise({
      errors: {},
      response: [
        rawFixture({
          teams: {
            home: { name: "Spain", winner: true },
            away: { name: "Japan", winner: false },
          },
          goals: { home: 2, away: 0 },
          score: { penalty: { home: null, away: null } },
        }),
      ],
    });
    expect(f).toMatchObject({
      homeGoals: 2,
      awayGoals: 0,
      penaltyHome: null,
      penaltyAway: null,
      winnerSide: "HOME",
    });
  });
});
