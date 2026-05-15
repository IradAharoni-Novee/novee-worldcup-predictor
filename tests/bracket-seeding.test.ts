import { describe, expect, it } from "vitest";
import {
  R32_SEEDING,
  resolveR32Slots,
  type GroupPickLookup,
} from "@/lib/bracket-seeding";

function makeGroupPicks(): Map<string, GroupPickLookup> {
  // Each group gets four synthetic team IDs based on group letter +
  // 1st/2nd/3rd/4th, so we can recognise them in expectations.
  const picks = new Map<string, GroupPickLookup>();
  for (const group of "ABCDEFGHIJKL".split("")) {
    picks.set(group, {
      group,
      team1stId: `${group}-1`,
      team2ndId: `${group}-2`,
      team3rdId: `${group}-3`,
      team4thId: `${group}-4`,
    });
  }
  return picks;
}

function qualifierMap(groups: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groups) m.set(`${g}-3`, g);
  return m;
}

describe("R32_SEEDING shape", () => {
  it("has 16 slots, each with home + away", () => {
    expect(R32_SEEDING).toHaveLength(16);
    for (const seed of R32_SEEDING) {
      expect(seed.home).toBeDefined();
      expect(seed.away).toBeDefined();
    }
  });

  it("places every group winner (1A–1L) and runner-up (2A–2L) exactly once", () => {
    const seen = new Map<string, number>();
    for (const seed of R32_SEEDING) {
      for (const side of [seed.home, seed.away]) {
        if (side.kind !== "groupPos") continue;
        const key = `${side.position}${side.group}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    for (const g of "ABCDEFGHIJKL".split("")) {
      expect(seen.get(`1${g}`)).toBe(1);
      expect(seen.get(`2${g}`)).toBe(1);
    }
  });

  it("has exactly 8 thirdPlace positions", () => {
    let count = 0;
    for (const seed of R32_SEEDING) {
      if (seed.home.kind === "thirdPlace") count++;
      if (seed.away.kind === "thirdPlace") count++;
    }
    expect(count).toBe(8);
  });
});

describe("resolveR32Slots — third-place distribution", () => {
  it("fills every R32 position when all 12 groups are predicted and 8 qualifiers cover the harder slots", () => {
    const slots = resolveR32Slots(
      makeGroupPicks(),
      qualifierMap(["A", "B", "C", "D", "E", "F", "G", "H"])
    );
    expect(slots.every((s) => s.homeId !== null && s.awayId !== null)).toBe(true);
  });

  it("uses augmenting paths so a constrained slot isn't starved by an earlier eager pick", () => {
    // User picks 8 qualifiers from groups {B, E, F, H, I, J, K, L}.
    // A greedy 'tightest-first' pass that takes H at slot 4 (G/H/J) would
    // leave slot 13 (A/C/D/H) empty — none of A, C, D in the user's set.
    // Bipartite matching can route J → slot 4 and H → slot 13 instead.
    const slots = resolveR32Slots(
      makeGroupPicks(),
      qualifierMap(["B", "E", "F", "H", "I", "J", "K", "L"])
    );
    const slot13 = slots.find((s) => s.slot === 13)!;
    expect(slot13.awayId).toBe("H-3");
  });

  it("never assigns the same qualifier to two slots", () => {
    const slots = resolveR32Slots(
      makeGroupPicks(),
      qualifierMap(["A", "B", "C", "D", "E", "F", "G", "H"])
    );
    const assigned: string[] = [];
    for (const s of slots) {
      if (s.homeId?.endsWith("-3")) assigned.push(s.homeId);
      if (s.awayId?.endsWith("-3")) assigned.push(s.awayId);
    }
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("leaves slots unfillable if no qualifier matches the anyOf list", () => {
    // User picks 0 qualifiers from {A, C, D, H} — slot 13 must stay null.
    const slots = resolveR32Slots(
      makeGroupPicks(),
      qualifierMap(["B", "E", "F", "I", "J", "K", "L"]) // no A/C/D/H
    );
    const slot13 = slots.find((s) => s.slot === 13)!;
    expect(slot13.awayId).toBeNull();
  });
});
