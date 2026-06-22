import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// syncOddsFromOddsApi loads upcoming matches, fetches current odds once, and
// writes the averaged 1/X/2 odds onto each match it can confidently reconcile.
// We mock only the boundaries — Prisma and the the-odds-api client — and let the
// real pickByTeamsAtMinute do the matching.

vi.mock("@/lib/prisma", () => ({
  prisma: { match: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/odds-api", () => ({ fetchCurrentOdds: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { fetchCurrentOdds } from "@/lib/odds-api";
import { syncOddsFromOddsApi } from "@/lib/sync";

const findMany = prisma.match.findMany as unknown as Mock;
const update = prisma.match.update as unknown as Mock;
const fetchOdds = fetchCurrentOdds as unknown as Mock;

const mexicoMatch = {
  id: "m1",
  kickoff: new Date("2026-06-11T19:00:00Z"),
  homeTeam: { name: "Mexico" },
  awayTeam: { name: "South Africa" },
};

const mexicoEvent = {
  homeName: "Mexico",
  awayName: "South Africa",
  date: "2026-06-11T19:00:00Z",
  odds: { home: 1.8, draw: 3.4, away: 4.2 },
};

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("syncOddsFromOddsApi", () => {
  it("only loads upcoming matches (kickoff in the future)", async () => {
    findMany.mockResolvedValue([]);
    await syncOddsFromOddsApi();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kickoff: { gt: expect.any(Date) } } })
    );
  });

  it("short-circuits without calling the odds API when no matches are upcoming", async () => {
    findMany.mockResolvedValue([]);
    const result = await syncOddsFromOddsApi();
    expect(result).toEqual({ oddsUpdated: 0 });
    expect(fetchOdds).not.toHaveBeenCalled();
  });

  it("writes the averaged odds for a reconciled match", async () => {
    findMany.mockResolvedValue([mexicoMatch]);
    fetchOdds.mockResolvedValue([mexicoEvent]);
    const result = await syncOddsFromOddsApi();
    expect(result).toEqual({ oddsUpdated: 1 });
    expect(update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: {
        oddsHome: 1.8,
        oddsDraw: 3.4,
        oddsAway: 4.2,
        oddsUpdatedAt: expect.any(Date),
      },
    });
  });

  it("skips matches no odds event reconciles to", async () => {
    findMany.mockResolvedValue([mexicoMatch]);
    fetchOdds.mockResolvedValue([
      { ...mexicoEvent, homeName: "Brazil", awayName: "Croatia" },
    ]);
    const result = await syncOddsFromOddsApi();
    expect(result).toEqual({ oddsUpdated: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it("prices only the matched subset when some matches are unmatched", async () => {
    findMany.mockResolvedValue([
      mexicoMatch,
      {
        id: "m2",
        kickoff: new Date("2026-06-12T16:00:00Z"),
        homeTeam: { name: "Spain" },
        awayTeam: { name: "Japan" },
      },
    ]);
    fetchOdds.mockResolvedValue([mexicoEvent]);
    const result = await syncOddsFromOddsApi();
    expect(result).toEqual({ oddsUpdated: 1 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" } })
    );
  });
});
