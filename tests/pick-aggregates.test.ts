import { describe, expect, it } from "vitest";
import { bucketScores } from "@/lib/pick-aggregates";

describe("bucketScores", () => {
  it("returns an empty aggregate for no picks", () => {
    expect(bucketScores([])).toEqual({ total: 0, buckets: [] });
  });

  it("groups identical picks into one bucket with count and percent", () => {
    const { total, buckets } = bucketScores([
      { homeScore: 2, awayScore: 1 },
      { homeScore: 0, awayScore: 0 },
      { homeScore: 2, awayScore: 1 },
      { homeScore: 2, awayScore: 1 },
    ]);
    expect(total).toBe(4);
    expect(buckets).toEqual([
      { score: "2–1", homeScore: 2, awayScore: 1, count: 3, percent: 75 },
      { score: "0–0", homeScore: 0, awayScore: 0, count: 1, percent: 25 },
    ]);
  });

  it("sorts buckets by count descending so buckets[0] is the modal pick", () => {
    // The match page's consensus check reads buckets[0] — pin the ordering.
    const { buckets } = bucketScores([
      { homeScore: 1, awayScore: 0 },
      { homeScore: 1, awayScore: 1 },
      { homeScore: 1, awayScore: 1 },
    ]);
    expect(buckets.map((b) => b.score)).toEqual(["1–1", "1–0"]);
  });
});
