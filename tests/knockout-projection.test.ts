import { describe, expect, it } from "vitest";
import { Stage } from "@prisma/client";
import { projectR32Slots, type ProjectedGroupMatch } from "@/lib/r32-projection";
import {
  liveKnockoutMatchup,
  buildKnockoutResults,
  determinedMatchupTeams,
  KNOCKOUT_FD_ID_TO_SLOT,
} from "@/lib/knockout-projection";

// Six 1-0 results that force a strict 9/6/3/0 finish order for [a,b,c,d].
function strictGroup(
  group: string,
  order: [string, string, string, string]
): ProjectedGroupMatch[] {
  const [a, b, c, d] = order;
  const win = (h: string, aw: string): ProjectedGroupMatch => ({
    group,
    homeTeamId: h,
    awayTeamId: aw,
    homeScore: 1,
    awayScore: 0,
  });
  return [win(a, b), win(a, c), win(a, d), win(b, c), win(b, d), win(c, d)];
}

const completeSlots = projectR32Slots(
  "ABCDEFGHIJKL"
    .split("")
    .flatMap((g) => strictGroup(g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]))
);
const emptySlots = projectR32Slots([]);
// Only group A has played: 1A/2A are known, every third-place slot is still a label.
const groupAOnlySlots = projectR32Slots(strictGroup("A", ["A1", "A2", "A3", "A4"]));
const id = (teamId: string) => teamId; // resolveName: show the id verbatim

const ko = (
  fdId: number,
  stage: Stage,
  official: { homeTeamId: string | null; awayTeamId: string | null },
  slots = completeSlots,
  results = buildKnockoutResults([])
) => liveKnockoutMatchup({ fdId, stage, ...official }, slots, id, results);

// A decided knockout result feeding the cascade.
const won = (fdId: number, stage: Stage, advancingTeamId: string) => ({
  fdId,
  stage,
  homeTeamId: null,
  awayTeamId: null,
  advancingTeamId,
});
const results = (...ms: ReturnType<typeof won>[]) => buildKnockoutResults(ms);

const NONE = { homeTeamId: null, awayTeamId: null };

describe("KNOCKOUT_FD_ID_TO_SLOT", () => {
  it("maps the 16 R16+ fixtures to distinct (round, slot) positions", () => {
    const entries = Object.values(KNOCKOUT_FD_ID_TO_SLOT);
    expect(entries).toHaveLength(16);
    const byRound = (round: Stage) =>
      entries.filter((e) => e.round === round).map((e) => e.slot).sort();
    expect(byRound(Stage.R16)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(byRound(Stage.QF)).toEqual([0, 1, 2, 3]);
    expect(byRound(Stage.SF)).toEqual([0, 1]);
    expect(byRound(Stage.FINAL)).toEqual([0]);
    expect(byRound(Stage.THIRD)).toEqual([0]);
  });
});

describe("liveKnockoutMatchup — Round of 32", () => {
  it("projects the matchup from group standings (fd 537417 = 2A v 2B)", () => {
    const m = ko(537417, Stage.R32, NONE)!;
    expect(m.home.teamId).toBe("A2");
    expect(m.away.teamId).toBe("B2");
    expect(m.home.label).toBe("2nd A");
    expect(m.matchNo).toBeNull();
    expect(m.provisional).toBe(true);
  });

  it("returns null once both teams are official", () => {
    expect(ko(537417, Stage.R32, { homeTeamId: "A2", awayTeamId: "B2" })).toBeNull();
  });

  it("is provisional when one side resolves and the other is still a label", () => {
    // fd 537425 = M79 = 1A v 3rd(C/E/F/H/I); only group A has played.
    const m = ko(537425, Stage.R32, NONE, groupAOnlySlots)!;
    expect(m.home.teamId).toBe("A1");
    expect(m.away.teamId).toBeNull();
    expect(m.away.label).toBe("3rd C/E/F/H/I");
    expect(m.provisional).toBe(true);
  });
});

describe("liveKnockoutMatchup — Round of 16 shows the feeding team options", () => {
  // fd 537376 = R16 slot 1, fed by R32 slot 2 (2A v 2B) and slot 3 (1F v 2C).
  it("joins each feeder's two teams and flags it provisional", () => {
    const m = ko(537376, Stage.R16, NONE)!;
    expect(m.home.teamId).toBeNull();
    expect(m.home.label).toBe("A2 / B2");
    expect(m.away.label).toBe("F1 / C2");
    expect(m.matchNo).toBe(2);
    expect(m.provisional).toBe(true);
  });

  it("falls back to position labels and is not provisional before results", () => {
    const m = ko(537376, Stage.R16, NONE, emptySlots)!;
    expect(m.home.label).toBe("2nd A / 2nd B");
    expect(m.away.label).toBe("1st F / 2nd C");
    expect(m.provisional).toBe(false);
  });
});

describe("liveKnockoutMatchup — QF/SF/Final/Third reference the feeding match", () => {
  it("QF slot 0 (fd 537383) reads 'Winner of R16 #1/#2'", () => {
    const m = ko(537383, Stage.QF, NONE)!;
    expect(m.home.label).toBe("Winner of R16 #1");
    expect(m.away.label).toBe("Winner of R16 #2");
    expect(m.matchNo).toBe(1);
    expect(m.provisional).toBe(false);
  });

  it("SF slot 1 (fd 537388) reads 'Winner of QF #3/#4'", () => {
    const m = ko(537388, Stage.SF, NONE)!;
    expect(m.home.label).toBe("Winner of QF #3");
    expect(m.away.label).toBe("Winner of QF #4");
    expect(m.matchNo).toBe(2);
  });

  it("Final (fd 537390) reads 'Winner of SF #1/#2' with no match number", () => {
    const m = ko(537390, Stage.FINAL, NONE)!;
    expect(m.home.label).toBe("Winner of SF #1");
    expect(m.away.label).toBe("Winner of SF #2");
    expect(m.matchNo).toBeNull();
  });

  it("Third place (fd 537389) reads 'Loser of SF #1/#2'", () => {
    const m = ko(537389, Stage.THIRD, NONE)!;
    expect(m.home.label).toBe("Loser of SF #1");
    expect(m.away.label).toBe("Loser of SF #2");
    expect(m.matchNo).toBeNull();
  });
});

describe("liveKnockoutMatchup — the cascade rolls winners forward", () => {
  // R16 slot 1 (537376) is fed by R32 slot 2 (537417 = 2A v 2B) and slot 3
  // (537418 = 1F v 2C).
  it("resolves a Round of 16 side to the Round of 32 winner once decided", () => {
    const m = ko(
      537376,
      Stage.R16,
      NONE,
      completeSlots,
      results(won(537417, Stage.R32, "A2"), won(537418, Stage.R32, "F1"))
    )!;
    expect(m.home.teamId).toBe("A2");
    expect(m.away.teamId).toBe("F1");
    // Real results, not a group projection.
    expect(m.provisional).toBe(false);
  });

  it("shows the decided winner on one side and the feeder options on the other", () => {
    const m = ko(
      537376,
      Stage.R16,
      NONE,
      completeSlots,
      results(won(537417, Stage.R32, "A2"))
    )!;
    expect(m.home.teamId).toBe("A2");
    expect(m.away.teamId).toBeNull();
    expect(m.away.label).toBe("F1 / C2");
  });

  // QF slot 0 (537383) is fed by R16 slot 0 (537375) and R16 slot 1 (537376).
  it("rolls Round of 32 winners into the QF as team options on the decided side", () => {
    const m = ko(
      537383,
      Stage.QF,
      NONE,
      completeSlots,
      results(won(537417, Stage.R32, "A2"), won(537418, Stage.R32, "F1"))
    )!;
    // R16 slot 1's feeders are both decided -> concrete options.
    expect(m.away.label).toBe("A2 / F1");
    // R16 slot 0's feeders aren't -> still a reference.
    expect(m.home.label).toBe("Winner of R16 #1");
  });

  it("resolves the QF to actual teams once the Round of 16 is decided", () => {
    const m = ko(
      537383,
      Stage.QF,
      NONE,
      completeSlots,
      results(won(537375, Stage.R16, "E1"), won(537376, Stage.R16, "A2"))
    )!;
    expect(m.home.teamId).toBe("E1");
    expect(m.away.teamId).toBe("A2");
    expect(m.provisional).toBe(false);
  });
});

describe("determinedMatchupTeams", () => {
  it("returns the two teams once a Round of 16 side pair is decided", () => {
    // Both R32 feeders of R16 slot 1 decided -> real teams, not a projection.
    const m = ko(
      537376,
      Stage.R16,
      NONE,
      completeSlots,
      results(won(537417, Stage.R32, "A2"), won(537418, Stage.R32, "F1"))
    );
    expect(determinedMatchupTeams(m)).toEqual({
      homeTeamId: "A2",
      awayTeamId: "F1",
    });
  });

  it("is null for a Round of 32 matchup still projected from group standings", () => {
    const m = ko(537417, Stage.R32, NONE);
    expect(m!.provisional).toBe(true);
    expect(determinedMatchupTeams(m)).toBeNull();
  });

  it("is null when only one side is decided", () => {
    const m = ko(
      537376,
      Stage.R16,
      NONE,
      completeSlots,
      results(won(537417, Stage.R32, "A2"))
    );
    expect(determinedMatchupTeams(m)).toBeNull();
  });

  it("is null for a finalised or group fixture (no live matchup)", () => {
    expect(determinedMatchupTeams(null)).toBeNull();
    expect(
      determinedMatchupTeams(ko(537417, Stage.R32, { homeTeamId: "A2", awayTeamId: "B2" }))
    ).toBeNull();
  });
});

describe("liveKnockoutMatchup — guards", () => {
  it("returns null for an unknown fixture id", () => {
    expect(ko(999999, Stage.QF, NONE)).toBeNull();
  });

  it("returns null for a group-stage fixture", () => {
    expect(ko(537417, Stage.GROUP, NONE)).toBeNull();
  });
});
