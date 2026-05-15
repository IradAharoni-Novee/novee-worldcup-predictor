import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { scoreAwards } from "@/lib/scoring-awards";

describe("scoreAwards", () => {
  it("awards full points when both picks match the actuals", () => {
    const result = scoreAwards(
      { winnerTeamId: "team-A", goldenBootPlayerId: "player-1" },
      { actualWinnerTeamId: "team-A", actualGoldenBootPlayerId: "player-1" },
      DEFAULT_SCORING
    );
    expect(result).toEqual({
      total: DEFAULT_SCORING.tournamentWinnerPoints + DEFAULT_SCORING.goldenBootPoints,
      winnerPoints: DEFAULT_SCORING.tournamentWinnerPoints,
      goldenBootPoints: DEFAULT_SCORING.goldenBootPoints,
    });
  });

  it("awards only the winner points when the golden boot is wrong", () => {
    const result = scoreAwards(
      { winnerTeamId: "team-A", goldenBootPlayerId: "player-99" },
      { actualWinnerTeamId: "team-A", actualGoldenBootPlayerId: "player-1" },
      DEFAULT_SCORING
    );
    expect(result.winnerPoints).toBe(DEFAULT_SCORING.tournamentWinnerPoints);
    expect(result.goldenBootPoints).toBe(0);
  });

  it("awards nothing when picks are missing", () => {
    const result = scoreAwards(
      { winnerTeamId: null, goldenBootPlayerId: null },
      { actualWinnerTeamId: "team-A", actualGoldenBootPlayerId: "player-1" },
      DEFAULT_SCORING
    );
    expect(result.total).toBe(0);
  });

  it("awards nothing when actuals are not yet decided", () => {
    const result = scoreAwards(
      { winnerTeamId: "team-A", goldenBootPlayerId: "player-1" },
      { actualWinnerTeamId: null, actualGoldenBootPlayerId: null },
      DEFAULT_SCORING
    );
    expect(result.total).toBe(0);
  });

  it("respects custom scoring config", () => {
    const result = scoreAwards(
      { winnerTeamId: "team-A", goldenBootPlayerId: "player-1" },
      { actualWinnerTeamId: "team-A", actualGoldenBootPlayerId: "player-1" },
      { ...DEFAULT_SCORING, tournamentWinnerPoints: 100, goldenBootPoints: 50 }
    );
    expect(result).toEqual({ total: 150, winnerPoints: 100, goldenBootPoints: 50 });
  });
});
