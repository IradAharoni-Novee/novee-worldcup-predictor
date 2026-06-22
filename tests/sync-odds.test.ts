import { describe, expect, it } from "vitest";
import { pickByTeamsAtMinute } from "@/lib/match-reconcile";
import type { OddsEvent } from "@/lib/odds-api";

// syncOddsFromOddsApi reconciles each upcoming DB match to a the-odds-api event
// via pickByTeamsAtMinute, then writes the averaged odds onto the match. The DB
// write needs Prisma, so these tests cover the pure matching/mapping step with
// OddsEvent-shaped candidates (homeName / awayName / date) — exactly the shape
// the sync hands to pickByTeamsAtMinute.

function event(overrides: Partial<OddsEvent>): OddsEvent {
  return {
    homeName: "Mexico",
    awayName: "South Africa",
    date: "2026-06-11T19:00:00Z",
    odds: { home: 1.8, draw: 3.4, away: 4.2 },
    ...overrides,
  };
}

describe("syncOddsFromOddsApi candidate matching", () => {
  const match = {
    homeName: "Mexico",
    awayName: "South Africa",
    kickoff: new Date("2026-06-11T19:00:00Z"),
  };

  it("matches an odds event by team names + kickoff minute and carries its odds", () => {
    const chosen = pickByTeamsAtMinute(match, [event({})]);
    expect(chosen?.odds).toEqual({ home: 1.8, draw: 3.4, away: 4.2 });
  });

  it("matches regardless of home/away orientation", () => {
    const chosen = pickByTeamsAtMinute(match, [
      event({ homeName: "South Africa", awayName: "Mexico", odds: { home: 4.2, draw: 3.4, away: 1.8 } }),
    ]);
    expect(chosen?.odds.home).toBe(4.2);
  });

  it("disambiguates two events at the same kickoff by team names", () => {
    const events = [
      event({ homeName: "Brazil", awayName: "Croatia", odds: { home: 1.5, draw: 4, away: 6 } }),
      event({ odds: { home: 1.8, draw: 3.4, away: 4.2 } }),
    ];
    expect(pickByTeamsAtMinute(match, events)?.odds.home).toBe(1.8);
  });

  it("ignores events at a different kickoff time", () => {
    const chosen = pickByTeamsAtMinute(match, [event({ date: "2026-06-12T02:00:00Z" })]);
    expect(chosen).toBeNull();
  });

  it("returns null when no team names match", () => {
    const chosen = pickByTeamsAtMinute(match, [
      event({ homeName: "Brazil", awayName: "Croatia" }),
    ]);
    expect(chosen).toBeNull();
  });
});
