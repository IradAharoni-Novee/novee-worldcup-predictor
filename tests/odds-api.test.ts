import { describe, expect, it } from "vitest";
import {
  averageEventOdds,
  parseOddsEvents,
  toHistoricalTimestamp,
} from "@/lib/odds-api";

describe("toHistoricalTimestamp", () => {
  it("strips milliseconds (the-odds-api rejects them with a 422)", () => {
    expect(toHistoricalTimestamp("2026-06-11T18:55:00.000Z")).toBe(
      "2026-06-11T18:55:00Z"
    );
  });

  it("leaves a second-precision timestamp untouched", () => {
    expect(toHistoricalTimestamp("2026-06-11T18:55:00Z")).toBe(
      "2026-06-11T18:55:00Z"
    );
  });
});

// Two bookmakers per event so averaging is non-trivial:
// home 1.50 & 1.60 -> 1.55, draw 4.00 & 4.40 -> 4.20, away 6.00 & 7.00 -> 6.50.
const pricedEvent = {
  id: "evt-1",
  sport_key: "soccer_fifa_world_cup",
  commence_time: "2026-06-11T19:00:00Z",
  home_team: "Mexico",
  away_team: "Poland",
  bookmakers: [
    {
      key: "pinnacle",
      title: "Pinnacle",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Mexico", price: 1.5 },
            { name: "Draw", price: 4.0 },
            { name: "Poland", price: 6.0 },
          ],
        },
      ],
    },
    {
      key: "betfair",
      title: "Betfair",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Mexico", price: 1.6 },
            { name: "Draw", price: 4.4 },
            { name: "Poland", price: 7.0 },
          ],
        },
      ],
    },
  ],
};

// Same as priced, but every bookmaker is missing the "Draw" outcome.
const noDrawEvent = {
  id: "evt-2",
  sport_key: "soccer_fifa_world_cup",
  commence_time: "2026-06-12T16:00:00Z",
  home_team: "France",
  away_team: "Australia",
  bookmakers: [
    {
      key: "pinnacle",
      title: "Pinnacle",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "France", price: 1.2 },
            { name: "Australia", price: 12.0 },
          ],
        },
      ],
    },
  ],
};

describe("averageEventOdds", () => {
  it("averages each outcome's decimal price across bookmakers", () => {
    expect(averageEventOdds(pricedEvent)).toEqual({
      home: 1.55,
      draw: 4.2,
      away: 6.5,
    });
  });

  it("returns null when the draw outcome is missing", () => {
    expect(averageEventOdds(noDrawEvent)).toBeNull();
  });

  it("returns null when no bookmaker priced the event", () => {
    expect(averageEventOdds({ ...pricedEvent, bookmakers: [] })).toBeNull();
  });
});

describe("parseOddsEvents", () => {
  it("maps priced events and drops events missing an outcome", () => {
    expect(parseOddsEvents([pricedEvent, noDrawEvent])).toEqual([
      {
        homeName: "Mexico",
        awayName: "Poland",
        date: "2026-06-11T19:00:00Z",
        odds: { home: 1.55, draw: 4.2, away: 6.5 },
      },
    ]);
  });

  it("returns an empty array when given no events", () => {
    expect(parseOddsEvents([])).toEqual([]);
  });
});
