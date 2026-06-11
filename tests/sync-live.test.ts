import { describe, expect, it } from "vitest";
import { MatchStatus } from "@prisma/client";
import { liveScoreWrites } from "@/lib/sync";
import type { FdMatch } from "@/lib/football-data";

function fd(overrides: Partial<FdMatch>): FdMatch {
  return {
    id: 1,
    utcDate: "2026-06-11T19:00:00Z",
    status: "TIMED",
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: { id: 10, name: "Mexico", shortName: "Mexico", tla: "MEX", crest: null },
    awayTeam: { id: 11, name: "South Africa", shortName: "RSA", tla: "RSA", crest: null },
    score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    ...overrides,
  };
}

describe("liveScoreWrites", () => {
  it("writes the current score and LIVE for an in-play match", () => {
    const writes = liveScoreWrites([
      fd({ id: 7, status: "IN_PLAY", score: { fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } } }),
    ]);
    expect(writes).toEqual([
      {
        fdId: 7,
        data: { homeScore: 2, awayScore: 1, status: MatchStatus.LIVE },
        requireUnfinished: false,
      },
    ]);
  });

  it("treats a paused (half-time) match as live", () => {
    const writes = liveScoreWrites([fd({ id: 8, status: "PAUSED" })]);
    expect(writes[0]?.data.status).toBe(MatchStatus.LIVE);
    expect(writes[0]?.requireUnfinished).toBe(false);
  });

  it("flips a finished match to FINISHED only if not already final", () => {
    const writes = liveScoreWrites([
      fd({ id: 9, status: "FINISHED", score: { fullTime: { home: 3, away: 0 }, halfTime: { home: 1, away: 0 } } }),
    ]);
    expect(writes).toEqual([
      {
        fdId: 9,
        data: { homeScore: 3, awayScore: 0, status: MatchStatus.FINISHED },
        requireUnfinished: true,
      },
    ]);
  });

  it("ignores matches that have not started", () => {
    const writes = liveScoreWrites([
      fd({ id: 1, status: "SCHEDULED" }),
      fd({ id: 2, status: "TIMED" }),
      fd({ id: 3, status: "POSTPONED" }),
    ]);
    expect(writes).toEqual([]);
  });
});
