import { describe, expect, it } from "vitest";
import { Stage } from "@prisma/client";
import { DEFAULT_SCORING } from "@/lib/scoring";
import {
  deriveActualPodium,
  summarizeMatchPoints,
  type LeaderboardRow,
} from "@/lib/leaderboard";

const NOW = new Date("2026-06-14T18:00:00Z");
const KICKED_OFF = new Date("2026-06-14T17:00:00Z");
const FUTURE = new Date("2026-06-14T20:00:00Z");

type Pred = Parameters<typeof summarizeMatchPoints>[0][number];

const pred = (
  home: number,
  away: number,
  match: Partial<Pred["match"]> & {
    status: Pred["match"]["status"];
    kickoff: Date;
  }
): Pred => ({
  homeScore: home,
  awayScore: away,
  match: {
    stage: Stage.GROUP,
    homeScore: null,
    awayScore: null,
    ...match,
  },
});

describe("summarizeMatchPoints", () => {
  it("counts confirmed points and exact/outcome on finished matches", () => {
    const summary = summarizeMatchPoints(
      [
        pred(2, 1, {
          status: "FINISHED",
          kickoff: KICKED_OFF,
          homeScore: 2,
          awayScore: 1,
        }),
        pred(3, 0, {
          status: "FINISHED",
          kickoff: KICKED_OFF,
          homeScore: 1,
          awayScore: 0,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary).toEqual({
      matchPoints: DEFAULT_SCORING.exactScore + DEFAULT_SCORING.correctOutcome,
      livePoints: 0,
      exact: 1,
      outcome: 1,
    });
  });

  it("scores an in-progress match as live points, not confirmed", () => {
    const summary = summarizeMatchPoints(
      [
        pred(1, 0, {
          status: "LIVE",
          kickoff: KICKED_OFF,
          homeScore: 1,
          awayScore: 0,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.livePoints).toBe(DEFAULT_SCORING.exactScore);
    expect(summary.matchPoints).toBe(0);
    expect(summary.exact).toBe(0);
    expect(summary.outcome).toBe(0);
  });

  it("treats a kicked-off SCHEDULED match (pre-sync) as live", () => {
    const summary = summarizeMatchPoints(
      [
        pred(0, 0, {
          status: "SCHEDULED",
          kickoff: KICKED_OFF,
          homeScore: 0,
          awayScore: 0,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.livePoints).toBe(DEFAULT_SCORING.exactScore);
  });

  it("ignores matches that have not kicked off", () => {
    const summary = summarizeMatchPoints(
      [pred(1, 1, { status: "SCHEDULED", kickoff: FUTURE })],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary).toEqual({
      matchPoints: 0,
      livePoints: 0,
      exact: 0,
      outcome: 0,
    });
  });

  it("applies the knockout multiplier to live points", () => {
    const summary = summarizeMatchPoints(
      [
        pred(2, 1, {
          stage: Stage.FINAL,
          status: "LIVE",
          kickoff: KICKED_OFF,
          homeScore: 2,
          awayScore: 1,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.livePoints).toBe(
      DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier
    );
  });
});

const lbRow = (
  userId: string,
  email: string,
  total: number,
  podiumPoints: number,
  exact = 0
): LeaderboardRow => ({
  userId,
  name: userId,
  email,
  image: null,
  total,
  matchPoints: 0,
  livePoints: 0,
  groupPoints: 0,
  bracketPoints: 0,
  awardsPoints: 0,
  podiumPoints,
  exact,
  outcome: 0,
  predictions: 0,
});

describe("deriveActualPodium", () => {
  it("ranks humans by base points, ignoring podium points", () => {
    // a has the higher *total* but it's inflated by podium points; on the base
    // ranking (total - podiumPoints) b leads, so the meta-game can't self-grade.
    const rows = [
      lbRow("a", "a@novee.security", 50, 30), // base 20
      lbRow("b", "b@novee.security", 40, 0), // base 40
      lbRow("c", "c@novee.security", 35, 0), // base 35
      lbRow("d", "d@novee.security", 10, 0), // base 10
    ];
    expect(deriveActualPodium(rows)).toEqual(["b", "c", "a"]);
  });

  it("excludes AI shadow players from the podium", () => {
    const rows = [
      lbRow("bot", "opus-4.8@novee.security", 999, 0),
      lbRow("a", "a@novee.security", 30, 0),
      lbRow("b", "b@novee.security", 20, 0),
      lbRow("c", "c@novee.security", 10, 0),
    ];
    expect(deriveActualPodium(rows)).toEqual(["a", "b", "c"]);
  });

  it("breaks base-point ties by exact count", () => {
    const rows = [
      lbRow("a", "a@novee.security", 20, 0, 1),
      lbRow("b", "b@novee.security", 20, 0, 4),
      lbRow("c", "c@novee.security", 20, 0, 2),
    ];
    expect(deriveActualPodium(rows)).toEqual(["b", "c", "a"]);
  });

  it("returns fewer than three when there aren't enough humans", () => {
    const rows = [
      lbRow("bot", "gpt-5.5@novee.security", 100, 0),
      lbRow("a", "a@novee.security", 30, 0),
    ];
    expect(deriveActualPodium(rows)).toEqual(["a"]);
  });
});
