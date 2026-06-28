import { describe, expect, it } from "vitest";
import { MatchStatus } from "@prisma/client";
import {
  mapApiFootballStatus,
  pickFixture,
  reconcileScore,
  reconcileTeamId,
} from "@/lib/sync";
import type { AfFixture } from "@/lib/api-football";

function fixture(overrides: Partial<AfFixture>): AfFixture {
  return {
    fixtureId: 1,
    date: "2026-06-11T19:00:00+00:00",
    homeName: "Mexico",
    awayName: "South Africa",
    homeGoals: 1,
    awayGoals: 0,
    statusShort: "1H",
    ...overrides,
  };
}

describe("mapApiFootballStatus", () => {
  it("maps in-progress codes to LIVE", () => {
    for (const s of ["1H", "HT", "2H", "ET", "BT", "P"]) {
      expect(mapApiFootballStatus(s)).toBe(MatchStatus.LIVE);
    }
  });

  it("maps finished codes (incl. extra time / penalties) to FINISHED", () => {
    for (const s of ["FT", "AET", "PEN"]) {
      expect(mapApiFootballStatus(s)).toBe(MatchStatus.FINISHED);
    }
  });

  it("returns null for not-started / non-result codes so they are left alone", () => {
    for (const s of ["NS", "TBD", "PST", "CANC", "ABD"]) {
      expect(mapApiFootballStatus(s)).toBeNull();
    }
  });
});

describe("pickFixture", () => {
  const match = {
    id: "m1",
    kickoff: new Date("2026-06-11T19:00:00Z"),
    homeName: "Mexico",
    awayName: "South Africa",
  };

  it("matches on kickoff minute and team names", () => {
    const f = pickFixture(match, [fixture({ fixtureId: 42 })]);
    expect(f?.fixtureId).toBe(42);
  });

  it("matches regardless of home/away orientation", () => {
    const f = pickFixture(match, [
      fixture({ fixtureId: 7, homeName: "South Africa", awayName: "Mexico" }),
    ]);
    expect(f?.fixtureId).toBe(7);
  });

  it("disambiguates two matches at the same kickoff by team names", () => {
    const fixtures = [
      fixture({ fixtureId: 1, homeName: "Brazil", awayName: "Croatia" }),
      fixture({ fixtureId: 2, homeName: "Mexico", awayName: "South Africa" }),
    ];
    expect(pickFixture(match, fixtures)?.fixtureId).toBe(2);
  });

  it("ignores fixtures at a different kickoff time", () => {
    const f = pickFixture(match, [fixture({ date: "2026-06-12T02:00:00+00:00" })]);
    expect(f).toBeNull();
  });

  it("returns null when no team names match", () => {
    const f = pickFixture(match, [fixture({ homeName: "Brazil", awayName: "Croatia" })]);
    expect(f).toBeNull();
  });

  it("matches when one team's name differs between providers", () => {
    // football-data.org says "Czechia"; API-Football says "Czech Republic".
    const korea = {
      id: "m2",
      kickoff: new Date("2026-06-12T02:00:00Z"),
      homeName: "South Korea",
      awayName: "Czechia",
    };
    const f = pickFixture(korea, [
      fixture({
        fixtureId: 99,
        date: "2026-06-12T02:00:00+00:00",
        homeName: "South Korea",
        awayName: "Czech Republic",
      }),
    ]);
    expect(f?.fixtureId).toBe(99);
  });

  it("does not single-team-match when two fixtures share the same kickoff", () => {
    // Both names differ and two matches kick off together: refuse to guess.
    const f = pickFixture(match, [
      fixture({ fixtureId: 1, homeName: "Mexico", awayName: "Korea Republic" }),
      fixture({ fixtureId: 2, homeName: "Brazil", awayName: "South Africa" }),
    ]);
    expect(f).toBeNull();
  });
});

describe("reconcileScore", () => {
  const live = { status: MatchStatus.LIVE, home: 1, away: 1 };
  const finished = { status: MatchStatus.FINISHED, home: 2, away: 0 };
  const fdNothing = { status: MatchStatus.SCHEDULED, home: null, away: null };

  it("takes the incoming value for a brand-new match", () => {
    expect(reconcileScore(finished, null)).toEqual(finished);
  });

  it("keeps the existing live score when FD still reports nothing", () => {
    expect(reconcileScore(fdNothing, live)).toEqual(live);
  });

  it("keeps a finished result when FD still reports nothing", () => {
    expect(reconcileScore(fdNothing, finished)).toEqual(finished);
  });

  it("accepts FD once it carries a score", () => {
    expect(reconcileScore(finished, live)).toEqual(finished);
  });

  it("does not block a fresh scheduled match with no progress yet", () => {
    expect(reconcileScore(fdNothing, fdNothing)).toEqual(fdNothing);
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
