import { describe, expect, it } from "vitest";
import { MatchStatus } from "@prisma/client";
import { mapApiFootballStatus, pickFixture } from "@/lib/sync";
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
});
