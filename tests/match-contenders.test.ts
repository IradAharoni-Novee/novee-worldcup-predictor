import { describe, expect, it } from "vitest";
import { Stage } from "@prisma/client";
import { DEFAULT_SCORING } from "@/lib/scoring";
import {
  rankContenders,
  type ContenderMatch,
  type ContenderPrediction,
  type ContenderUser,
} from "@/lib/match-contenders";

const user = (id: string, name: string | null = null): ContenderUser => ({
  id,
  name,
  email: `${id}@novee.security`,
  image: null,
});

const pick = (
  u: ContenderUser,
  home: number,
  away: number,
  shootoutWinnerTeamId: string | null = null
): ContenderPrediction => ({
  homeScore: home,
  awayScore: away,
  shootoutWinnerTeamId,
  user: u,
});

const match = (overrides: Partial<ContenderMatch> = {}): ContenderMatch => ({
  stage: Stage.GROUP,
  status: "FINISHED",
  homeTeamId: "h",
  awayTeamId: "a",
  homeScore: null,
  awayScore: null,
  advancingTeamId: null,
  ...overrides,
});

describe("rankContenders", () => {
  it("returns an empty list for no predictions", () => {
    expect(rankContenders([], match(), DEFAULT_SCORING)).toEqual([]);
  });

  it("ranks a finished group match: exact above outcome above miss", () => {
    const rows = rankContenders(
      [
        pick(user("miss", "Miss"), 0, 2),
        pick(user("exact", "Exact"), 2, 1),
        pick(user("outcome", "Outcome"), 1, 0),
      ],
      match({ homeScore: 2, awayScore: 1 }),
      DEFAULT_SCORING
    );
    expect(rows.map((r) => [r.user.id, r.points, r.rank])).toEqual([
      ["exact", DEFAULT_SCORING.exactScore, 1],
      ["outcome", DEFAULT_SCORING.correctOutcome, 2],
      ["miss", 0, 3],
    ]);
  });

  it("applies the knockout multiplier on finished knockout matches", () => {
    const rows = rankContenders(
      [pick(user("u1"), 2, 0)],
      match({ stage: Stage.R16, homeScore: 2, awayScore: 0 }),
      DEFAULT_SCORING
    );
    expect(rows[0]?.points).toBe(
      DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier
    );
  });

  it("adds the shootout bonus on a finished knockout decided on penalties", () => {
    const m = match({
      stage: Stage.QF,
      homeScore: 1,
      awayScore: 1,
      advancingTeamId: "h",
    });
    const rows = rankContenders(
      [
        // Nailed the 120' score and called the shootout winner: exact ×2 + bonus.
        pick(user("caller", "Caller"), 1, 1, "h"),
        // Decisive pick of the advancing side: bonus only, no scoreline points.
        pick(user("decisive", "Decisive"), 1, 0),
      ],
      m,
      DEFAULT_SCORING
    );
    expect(rows.map((r) => [r.user.id, r.points])).toEqual([
      [
        "caller",
        DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier +
          DEFAULT_SCORING.shootoutBonus,
      ],
      ["decisive", DEFAULT_SCORING.shootoutBonus],
    ]);
  });

  it("awards the shootout bonus when the away side advances", () => {
    const m = match({
      stage: Stage.QF,
      homeScore: 1,
      awayScore: 1,
      advancingTeamId: "a",
    });
    const rows = rankContenders(
      [
        pick(user("caller", "Caller"), 1, 1, "a"),
        pick(user("decisive", "Decisive"), 0, 1),
        pick(user("homer", "Homer"), 2, 1),
      ],
      m,
      DEFAULT_SCORING
    );
    expect(rows.map((r) => [r.user.id, r.points])).toEqual([
      [
        "caller",
        DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier +
          DEFAULT_SCORING.shootoutBonus,
      ],
      ["decisive", DEFAULT_SCORING.shootoutBonus],
      ["homer", 0],
    ]);
  });

  it("uses the provided scoring config, not DEFAULT_SCORING", () => {
    const custom = {
      ...DEFAULT_SCORING,
      exactScore: 10,
      knockoutMultiplier: 3,
      shootoutBonus: 5,
    };
    const m = match({
      stage: Stage.QF,
      homeScore: 1,
      awayScore: 1,
      advancingTeamId: "h",
    });
    const finished = rankContenders([pick(user("u1"), 1, 1, "h")], m, custom);
    expect(finished[0]?.points).toBe(10 * 3 + 5);
    const live = rankContenders(
      [pick(user("u1"), 1, 1, "h")],
      { ...m, status: "LIVE" },
      custom
    );
    expect(live[0]?.points).toBe(10 * 3);
  });

  it("never awards the shootout bonus while the match is live", () => {
    // The live sync writes advancingTeamId mid-shootout; a live knockout level
    // at 1-1 must score the current scoreline only (exact ×2, no +1 bonus).
    const rows = rankContenders(
      [pick(user("u1"), 1, 1, "h")],
      match({
        stage: Stage.SF,
        status: "LIVE",
        homeScore: 1,
        awayScore: 1,
        advancingTeamId: "h",
      }),
      DEFAULT_SCORING
    );
    expect(rows[0]?.points).toBe(
      DEFAULT_SCORING.exactScore * DEFAULT_SCORING.knockoutMultiplier
    );
  });

  it("scores everyone at zero while a live match has no synced score", () => {
    const rows = rankContenders(
      [pick(user("draw", "Draw"), 0, 0), pick(user("bold", "Bold"), 3, 2)],
      match({ status: "LIVE" }),
      DEFAULT_SCORING
    );
    expect(rows.every((r) => r.points === 0)).toBe(true);
  });

  it("shares ranks on ties and skips past the tied block", () => {
    const rows = rankContenders(
      [
        pick(user("c", "Cara"), 1, 0),
        pick(user("a", "Anna"), 2, 0),
        pick(user("b", "Ben"), 1, 0),
        pick(user("d", "Dan"), 0, 1),
      ],
      match({ status: "LIVE", homeScore: 1, awayScore: 0 }),
      DEFAULT_SCORING
    );
    // Ben and Cara both hit the exact score and share rank 1 (sorted by
    // display name for a stable order between live refreshes); Anna's correct
    // outcome lands at rank 3, past the tied block.
    expect(rows.map((r) => [r.user.id, r.points, r.rank])).toEqual([
      ["b", DEFAULT_SCORING.exactScore, 1],
      ["c", DEFAULT_SCORING.exactScore, 1],
      ["a", DEFAULT_SCORING.correctOutcome, 3],
      ["d", 0, 4],
    ]);
  });

  it("breaks ties between identical display labels by user id", () => {
    const rows = rankContenders(
      [pick(user("u2", "Sam"), 1, 0), pick(user("u1", "Sam"), 1, 0)],
      match({ homeScore: 1, awayScore: 0 }),
      DEFAULT_SCORING
    );
    // Input order is [u2, u1]; without the id tiebreak a stable sort would
    // keep it, shuffling same-named users between live refreshes.
    expect(rows.map((r) => r.user.id)).toEqual(["u1", "u2"]);
  });

  it("falls back to the email local part when a user has no name", () => {
    const rows = rankContenders(
      [pick(user("zed"), 1, 0), pick(user("abe"), 1, 0)],
      match({ homeScore: 1, awayScore: 0 }),
      DEFAULT_SCORING
    );
    expect(rows.map((r) => r.user.id)).toEqual(["abe", "zed"]);
  });
});
