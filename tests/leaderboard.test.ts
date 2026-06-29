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
  },
  shootoutWinnerTeamId: string | null = null
): Pred => ({
  homeScore: home,
  awayScore: away,
  shootoutWinnerTeamId,
  match: {
    stage: Stage.GROUP,
    homeTeamId: null,
    awayTeamId: null,
    homeScore: null,
    awayScore: null,
    advancingTeamId: null,
    oddsHome: null,
    oddsDraw: null,
    oddsAway: null,
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
      earnings: 0,
      liveEarnings: 0,
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
      earnings: 0,
      liveEarnings: 0,
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

describe("summarizeMatchPoints shootout bonus", () => {
  const penaltyMatch = {
    stage: Stage.R32,
    status: "FINISHED" as const,
    kickoff: KICKED_OFF,
    homeScore: 1,
    awayScore: 1,
    homeTeamId: "A",
    awayTeamId: "B",
    advancingTeamId: "A",
  };

  it("awards the bonus for the correct side via a decisive prediction, not counting exact/outcome", () => {
    // Predicted A to win 2–1; match was 1–1 and A advanced on penalties.
    const summary = summarizeMatchPoints([pred(2, 1, penaltyMatch)], DEFAULT_SCORING, NOW);
    expect(summary.matchPoints).toBe(DEFAULT_SCORING.shootoutBonus);
    expect(summary.exact).toBe(0);
    expect(summary.outcome).toBe(0);
  });

  it("stacks the bonus on top of a correct draw prediction", () => {
    // Predicted 1–1 with A to win the shootout; exact 1–1 ×2 plus the bonus.
    const summary = summarizeMatchPoints([pred(1, 1, penaltyMatch, "A")], DEFAULT_SCORING, NOW);
    expect(summary.matchPoints).toBe(
      DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier +
        DEFAULT_SCORING.shootoutBonus
    );
    expect(summary.exact).toBe(1);
  });

  it("withholds the bonus when the predicted side lost the shootout", () => {
    // Predicted 0–0 + B on pens, but it was 1–1 and A advanced: a correct draw
    // outcome (×2) but not exact, and no bonus for the wrong shootout side.
    const summary = summarizeMatchPoints([pred(0, 0, penaltyMatch, "B")], DEFAULT_SCORING, NOW);
    expect(summary.matchPoints).toBe(
      DEFAULT_SCORING.correctOutcome * DEFAULT_SCORING.knockoutMultiplier
    );
    expect(summary.outcome).toBe(1);
  });

  it("gives no bonus for an extra-time (non-penalty) knockout result", () => {
    // 2–1 after ET, A advanced — decisive score, so the normal outcome points
    // already cover the side and there's no separate bonus.
    const summary = summarizeMatchPoints(
      [
        pred(2, 1, {
          stage: Stage.R32,
          status: "FINISHED",
          kickoff: KICKED_OFF,
          homeScore: 2,
          awayScore: 1,
          homeTeamId: "A",
          awayTeamId: "B",
          advancingTeamId: "A",
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.matchPoints).toBe(
      DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier
    );
  });
});

describe("summarizeMatchPoints earnings", () => {
  it("pays out a correct outcome on a finished match at the stored odds", () => {
    const summary = summarizeMatchPoints(
      [
        pred(1, 0, {
          status: "FINISHED",
          kickoff: KICKED_OFF,
          homeScore: 2,
          awayScore: 1,
          oddsHome: 2.5,
          oddsDraw: 3.2,
          oddsAway: 2.8,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.earnings).toBe(150);
    expect(summary.liveEarnings).toBe(0);
  });

  it("loses the full stake on a wrong finished prediction, before the points skip", () => {
    const summary = summarizeMatchPoints(
      [
        pred(2, 0, {
          status: "FINISHED",
          kickoff: KICKED_OFF,
          homeScore: 0,
          awayScore: 1,
          oddsHome: 2.5,
          oddsDraw: 3.2,
          oddsAway: 2.8,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.matchPoints).toBe(0);
    expect(summary.earnings).toBe(-100);
    expect(summary.liveEarnings).toBe(0);
  });

  it("settles a live match into liveEarnings, not earnings", () => {
    const summary = summarizeMatchPoints(
      [
        pred(0, 0, {
          status: "LIVE",
          kickoff: KICKED_OFF,
          homeScore: 0,
          awayScore: 0,
          oddsHome: 2.5,
          oddsDraw: 3.0,
          oddsAway: 2.8,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.earnings).toBe(0);
    expect(summary.liveEarnings).toBe(200);
  });

  it("contributes 0 when the finished match has no stored odds", () => {
    const summary = summarizeMatchPoints(
      [
        pred(1, 0, {
          status: "FINISHED",
          kickoff: KICKED_OFF,
          homeScore: 2,
          awayScore: 1,
        }),
      ],
      DEFAULT_SCORING,
      NOW
    );
    expect(summary.earnings).toBe(0);
    expect(summary.liveEarnings).toBe(0);
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
  earnings: 0,
  liveEarnings: 0,
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
