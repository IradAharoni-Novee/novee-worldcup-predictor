import { describe, expect, it } from "vitest";
import { MatchStatus } from "@prisma/client";
import { fdResult, mapFdStatus, reconcileTeamId } from "@/lib/sync";
import type { FdScore } from "@/lib/football-data";

function score(overrides: Partial<FdScore>): FdScore {
  return {
    winner: null,
    duration: "REGULAR",
    fullTime: { home: null, away: null },
    halfTime: { home: null, away: null },
    ...overrides,
  };
}

describe("mapFdStatus", () => {
  it("maps in-progress statuses to LIVE", () => {
    expect(mapFdStatus("IN_PLAY")).toBe(MatchStatus.LIVE);
    expect(mapFdStatus("PAUSED")).toBe(MatchStatus.LIVE);
  });

  it("maps FINISHED to FINISHED", () => {
    expect(mapFdStatus("FINISHED")).toBe(MatchStatus.FINISHED);
  });

  it("returns null for not-started / non-result statuses so they are left alone", () => {
    for (const s of ["SCHEDULED", "TIMED", "POSTPONED", "SUSPENDED", "CANCELLED"] as const) {
      expect(mapFdStatus(s)).toBeNull();
    }
  });
});

describe("fdResult", () => {
  it("uses fullTime for a regular-time result", () => {
    expect(fdResult(score({ fullTime: { home: 2, away: 1 } }))).toEqual({
      homeScore: 2,
      awayScore: 1,
      penaltyHome: null,
      penaltyAway: null,
    });
  });

  it("uses fullTime for an extra-time result — it is already the 120' line", () => {
    expect(
      fdResult(
        score({
          duration: "EXTRA_TIME",
          fullTime: { home: 3, away: 2 },
          regularTime: { home: 2, away: 2 },
          extraTime: { home: 1, away: 0 },
        })
      )
    ).toEqual({ homeScore: 3, awayScore: 2, penaltyHome: null, penaltyAway: null });
  });

  it("rebuilds the 120' line for a shootout — fullTime includes shootout goals", () => {
    // Real shape: Germany 1-1 Paraguay, pens 3-4 arrives as fullTime 4-5.
    expect(
      fdResult(
        score({
          duration: "PENALTY_SHOOTOUT",
          fullTime: { home: 4, away: 5 },
          regularTime: { home: 1, away: 1 },
          extraTime: { home: 0, away: 0 },
          penalties: { home: 3, away: 4 },
        })
      )
    ).toEqual({ homeScore: 1, awayScore: 1, penaltyHome: 3, penaltyAway: 4 });
  });

  it("returns null while fullTime is unpublished", () => {
    expect(fdResult(score({}))).toBeNull();
  });

  it("returns null for a shootout missing its breakdown fields", () => {
    expect(
      fdResult(score({ duration: "PENALTY_SHOOTOUT", fullTime: { home: 4, away: 5 } }))
    ).toBeNull();
  });
});

describe("reconcileTeamId", () => {
  it("takes the incoming team for a brand-new match", () => {
    expect(reconcileTeamId("team-a", undefined)).toBe("team-a");
  });

  it("keeps the known knockout team when FD reports none yet", () => {
    expect(reconcileTeamId(null, "team-a")).toBe("team-a");
  });

  it("accepts FD's team once it carries one", () => {
    expect(reconcileTeamId("team-b", "team-a")).toBe("team-b");
  });

  it("stays null when neither side has a team", () => {
    expect(reconcileTeamId(null, null)).toBeNull();
    expect(reconcileTeamId(null, undefined)).toBeNull();
  });
});
