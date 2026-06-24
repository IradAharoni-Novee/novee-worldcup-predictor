import { describe, expect, it } from "vitest";
import {
  buildBullseyeMessage,
  collectBullseyes,
  type BullseyeMatch,
  type ScoredMatch,
} from "@/lib/bullseye";
import { isExactScore } from "@/lib/scoring";

function user(over: Partial<ScoredMatch["predictions"][number]["user"]> = {}) {
  return {
    id: "u1",
    name: "Ada",
    email: "ada@novee.security",
    image: "https://img/ada.png",
    ...over,
  };
}

function scoredMatch(over: Partial<ScoredMatch> = {}): ScoredMatch {
  return {
    id: "m1",
    stage: "GROUP",
    group: "A",
    homeScore: 3,
    awayScore: 2,
    homeTeam: { name: "Brazil", flag: "https://flags/br.svg" },
    awayTeam: { name: "France", flag: "https://flags/fr.svg" },
    predictions: [],
    ...over,
  };
}

describe("isExactScore", () => {
  it("is true only when both scores match the final", () => {
    const match = { homeScore: 3, awayScore: 2 };
    expect(isExactScore({ homeScore: 3, awayScore: 2 }, match)).toBe(true);
    expect(isExactScore({ homeScore: 2, awayScore: 3 }, match)).toBe(false);
    expect(isExactScore({ homeScore: 3, awayScore: 1 }, match)).toBe(false);
  });

  it("matches a correct draw exactly", () => {
    expect(isExactScore({ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 1 })).toBe(true);
  });

  it("is false when the match has no final score", () => {
    expect(isExactScore({ homeScore: 0, awayScore: 0 }, { homeScore: null, awayScore: null })).toBe(false);
    expect(isExactScore({ homeScore: 1, awayScore: 0 }, { homeScore: 1, awayScore: null })).toBe(false);
  });
});

describe("collectBullseyes", () => {
  it("keeps only winners who nailed the exact score", () => {
    const match = scoredMatch({
      predictions: [
        { homeScore: 3, awayScore: 2, user: user({ id: "exact" }) },
        { homeScore: 1, awayScore: 0, user: user({ id: "outcome-only" }) },
        { homeScore: 0, awayScore: 0, user: user({ id: "miss" }) },
      ],
    });
    const [result] = collectBullseyes([match]);
    expect(result.winners.map((w) => w.userId)).toEqual(["exact"]);
    expect(result.homeTeamName).toBe("Brazil");
    expect(result.awayTeamName).toBe("France");
    expect(result.homeScore).toBe(3);
    expect(result.awayScore).toBe(2);
  });

  it("drops matches with no exact-score predictions", () => {
    const match = scoredMatch({
      predictions: [{ homeScore: 0, awayScore: 0, user: user() }],
    });
    expect(collectBullseyes([match])).toEqual([]);
  });

  it("drops matches that have no final score yet", () => {
    const match = scoredMatch({
      homeScore: null,
      awayScore: null,
      predictions: [{ homeScore: 3, awayScore: 2, user: user() }],
    });
    expect(collectBullseyes([match])).toEqual([]);
  });

  it("collects multiple winners across multiple matches", () => {
    const m1 = scoredMatch({
      id: "m1",
      predictions: [
        { homeScore: 3, awayScore: 2, user: user({ id: "a" }) },
        { homeScore: 3, awayScore: 2, user: user({ id: "b" }) },
      ],
    });
    const m2 = scoredMatch({
      id: "m2",
      homeScore: 0,
      awayScore: 1,
      predictions: [{ homeScore: 0, awayScore: 1, user: user({ id: "c" }) }],
    });
    const result = collectBullseyes([m1, m2]);
    expect(result.map((m) => m.matchId)).toEqual(["m1", "m2"]);
    expect(result[0].winners).toHaveLength(2);
    expect(result[1].winners).toHaveLength(1);
  });
});

describe("buildBullseyeMessage", () => {
  const opts = { appUrl: "https://app", imageUrl: "https://app/card" };

  it("returns null when there are no bull's eyes", () => {
    expect(buildBullseyeMessage([], opts)).toBeNull();
  });

  it("builds a section + image block and summarises winners", () => {
    const match: BullseyeMatch = {
      matchId: "m1",
      stage: "GROUP",
      group: "A",
      homeTeamName: "Brazil",
      awayTeamName: "France",
      homeFlag: null,
      awayFlag: null,
      homeScore: 3,
      awayScore: 2,
      winners: [
        { userId: "a", name: "Ada", email: "ada@novee.security", image: null },
        { userId: "b", name: null, email: "bao@novee.security", image: null },
      ],
    };
    const message = buildBullseyeMessage([match], opts);
    expect(message).not.toBeNull();
    expect(message!.blocks).toHaveLength(2);
    expect(message!.blocks[0]).toMatchObject({ type: "section" });
    expect(message!.blocks[1]).toMatchObject({
      type: "image",
      image_url: opts.imageUrl,
    });
    const section = message!.blocks[0] as { text: { text: string } };
    expect(section.text.text).toContain("2 exact-score predictions");
    expect(section.text.text).toContain("Brazil 3–2 France");
    expect(section.text.text).toContain("Group A");
    expect(section.text.text).toContain("Ada");
    expect(section.text.text).toContain("bao");
  });

  it("uses singular wording for a lone bull's eye", () => {
    const match: BullseyeMatch = {
      matchId: "m1",
      stage: "FINAL",
      group: null,
      homeTeamName: "Brazil",
      awayTeamName: "France",
      homeFlag: null,
      awayFlag: null,
      homeScore: 1,
      awayScore: 0,
      winners: [{ userId: "a", name: "Ada", email: "ada@novee.security", image: null }],
    };
    const message = buildBullseyeMessage([match], opts);
    const section = message!.blocks[0] as { text: { text: string } };
    expect(section.text.text).toContain("1 exact-score prediction nailed");
    expect(section.text.text).not.toContain("predictions");
  });
});
