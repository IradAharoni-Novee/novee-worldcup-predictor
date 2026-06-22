import { describe, expect, it } from "vitest";
import { projectR32Slots, type ProjectedGroupMatch } from "@/lib/r32-projection";
import { allocateThirdPlaces } from "@/lib/third-place-allocation";
import { R32_STRUCTURE, R32_FD_ID_TO_FIFA_MATCH } from "@/lib/r32-structure";

// Six 1-0 results that force a strict 9/6/3/0 finish order for [a,b,c,d].
function strictGroup(group: string, order: [string, string, string, string]): ProjectedGroupMatch[] {
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

const GROUPS = "ABCDEFGHIJKL".split("");

function slot(n: number) {
  return R32_STRUCTURE.find((s) => s.slot === n)!;
}

describe("projectR32Slots", () => {
  it("returns 16 labelled slots with no teams before any results", () => {
    const slots = projectR32Slots([]);
    expect(slots).toHaveLength(16);
    for (const s of slots) {
      expect(s.homeId).toBeNull();
      expect(s.awayId).toBeNull();
    }
    // labels come straight from the real structure
    expect(slots[0]!.homeLabel).toBe("1st E");
    expect(slots[0]!.awayLabel).toBe("3rd A/B/C/D/F");
    expect(slot(2).home.kind).toBe("runnerUp");
    expect(slots[2]!.homeLabel).toBe("2nd A");
  });

  it("resolves only the groups that have results, leaving the rest as labels", () => {
    // Only group A has finished matches; everything else stays unresolved.
    const slots = projectR32Slots(strictGroup("A", ["A1", "A2", "A3", "A4"]));
    // slot 2 = 2A v 2B → A's runner-up known, B unknown
    expect(slots[2]!.homeId).toBe("A2");
    expect(slots[2]!.awayId).toBeNull();
    // slot 10 home = 1A
    expect(slots[10]!.homeId).toBe("A1");
    // thirds need eight qualifying groups, so the third side stays null
    expect(slots[10]!.awayId).toBeNull();
  });

  it("seeds the full bracket from complete results and routes the best eight thirds via Annex C", () => {
    const matches = GROUPS.flatMap((g) =>
      strictGroup(g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`])
    );
    const slots = projectR32Slots(matches);

    // Group positions resolve directly from standings.
    expect(slots[2]!.homeId).toBe("A2"); // 2A
    expect(slots[2]!.awayId).toBe("B2"); // 2B
    expect(slots[13]!.homeId).toBe("D2"); // 2D
    expect(slots[13]!.awayId).toBe("G2"); // 2G
    expect(slots[0]!.homeId).toBe("E1"); // 1E

    // All twelve thirds tie on points/GD/GF, so the best eight are the eight
    // with the alphabetically-smallest ids → groups A–H qualify.
    const expected = allocateThirdPlaces(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(expected.size).toBe(8);

    for (const s of R32_STRUCTURE) {
      if (s.away.kind === "third") {
        const thirdGroup = expected.get(s.away.winnerGroup)!;
        expect(slots[s.slot]!.awayId).toBe(`${thirdGroup}3`);
      }
    }

    // Every third-placed team that qualified appears exactly once.
    const placedThirds = slots
      .map((s) => s.awayId)
      .filter((id): id is string => !!id && id.endsWith("3"));
    expect(new Set(placedThirds).size).toBe(8);
  });
});

describe("R32 FIFA match numbering", () => {
  it("tags every slot with a distinct FIFA match number M73–M88", () => {
    const numbers = R32_STRUCTURE.map((s) => s.fifaMatch).sort((a, b) => a - b);
    expect(numbers).toEqual([
      73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
    ]);
  });

  it("maps all 16 football-data ids onto the match numbers bijectively", () => {
    const fdIds = Object.keys(R32_FD_ID_TO_FIFA_MATCH);
    expect(fdIds).toHaveLength(16);
    const mapped = Object.values(R32_FD_ID_TO_FIFA_MATCH).sort((a, b) => a - b);
    expect(mapped).toEqual([
      73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
    ]);
  });
});

// Resolving a football-data id to its live matchup (and partially-resolved
// fixtures) is exercised in tests/knockout-projection.test.ts.
