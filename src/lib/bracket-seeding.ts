// Approximation of the FIFA 2026 R32 bracket layout. 12 groups (A–L) of 4
// produce 24 group winners/runners-up + 8 best third-place teams = 32 in R32.
// Each entry is a *hint* used to label and pre-fill bracket slots from the
// user's group prediction. The actual picks are free-form per slot — users
// can override any slot.
//
// Source format:
//   { kind: "groupPos", group: "A", position: 1 }  // 1st of group A
//   { kind: "thirdPlace", anyOf: ["A","B","C","D","E","F"] } // best 3rd from these groups

export type SeedSource =
  | { kind: "groupPos"; group: string; position: 1 | 2 | 3 | 4 }
  | { kind: "thirdPlace"; anyOf: string[] };

export type R32SlotSeed = {
  slot: number;
  home: SeedSource;
  away: SeedSource;
};

// A plausible 2026-style layout. Eight third-place teams fill the slots
// labeled `thirdPlace`. Tweak this map if FIFA finalizes a different mapping.
export const R32_SEEDING: readonly R32SlotSeed[] = [
  { slot: 0, home: { kind: "groupPos", group: "A", position: 1 }, away: { kind: "groupPos", group: "B", position: 2 } },
  { slot: 1, home: { kind: "groupPos", group: "C", position: 1 }, away: { kind: "thirdPlace", anyOf: ["D", "E", "F"] } },
  { slot: 2, home: { kind: "groupPos", group: "E", position: 1 }, away: { kind: "thirdPlace", anyOf: ["A", "B", "C", "D"] } },
  { slot: 3, home: { kind: "groupPos", group: "G", position: 1 }, away: { kind: "groupPos", group: "H", position: 2 } },
  { slot: 4, home: { kind: "groupPos", group: "I", position: 1 }, away: { kind: "thirdPlace", anyOf: ["G", "H", "J"] } },
  { slot: 5, home: { kind: "groupPos", group: "K", position: 1 }, away: { kind: "groupPos", group: "L", position: 2 } },
  { slot: 6, home: { kind: "groupPos", group: "B", position: 1 }, away: { kind: "groupPos", group: "A", position: 2 } },
  { slot: 7, home: { kind: "groupPos", group: "D", position: 1 }, away: { kind: "thirdPlace", anyOf: ["B", "E", "F", "I"] } },
  { slot: 8, home: { kind: "groupPos", group: "F", position: 1 }, away: { kind: "groupPos", group: "E", position: 2 } },
  { slot: 9, home: { kind: "groupPos", group: "H", position: 1 }, away: { kind: "groupPos", group: "G", position: 2 } },
  { slot: 10, home: { kind: "groupPos", group: "J", position: 1 }, away: { kind: "groupPos", group: "I", position: 2 } },
  { slot: 11, home: { kind: "groupPos", group: "L", position: 1 }, away: { kind: "groupPos", group: "K", position: 2 } },
  { slot: 12, home: { kind: "groupPos", group: "C", position: 2 }, away: { kind: "groupPos", group: "D", position: 2 } },
  { slot: 13, home: { kind: "groupPos", group: "F", position: 2 }, away: { kind: "thirdPlace", anyOf: ["A", "C", "D", "H"] } },
  { slot: 14, home: { kind: "thirdPlace", anyOf: ["B", "F", "I", "K"] }, away: { kind: "thirdPlace", anyOf: ["E", "G", "I", "J"] } },
  { slot: 15, home: { kind: "groupPos", group: "J", position: 2 }, away: { kind: "thirdPlace", anyOf: ["C", "F", "K", "L"] } },
];

export type GroupPickLookup = {
  group: string;
  team1stId: string;
  team2ndId: string;
  team3rdId: string;
  team4thId: string;
};

// Resolve a seed source to a single team id, or null if unknown for the
// user's current group prediction. For thirdPlace slots we delegate to the
// user's third-place qualifier picks via `resolveR32Slots()` below.
export function resolveSeedSource(
  source: SeedSource,
  groupPicks: Map<string, GroupPickLookup>
): string | null {
  if (source.kind === "thirdPlace") return null;
  const pick = groupPicks.get(source.group);
  if (!pick) return null;
  switch (source.position) {
    case 1:
      return pick.team1stId;
    case 2:
      return pick.team2ndId;
    case 3:
      return pick.team3rdId;
    case 4:
      return pick.team4thId;
  }
}

export function seedSourceLabel(source: SeedSource): string {
  if (source.kind === "thirdPlace") {
    return `3rd ${source.anyOf.join("/")}`;
  }
  const pos = source.position === 1 ? "1st" : source.position === 2 ? "2nd" : source.position === 3 ? "3rd" : "4th";
  return `${pos} ${source.group}`;
}

// Maximum bipartite matching between thirdPlace slots and the user's qualifier
// picks via augmenting paths. Each slot gets one qualifier whose group is in
// its `anyOf` list; each qualifier is used at most once. Returns the maximum
// possible number of filled slots, not just whatever a greedy pass found.
function matchQualifiersToSlots<S extends { id: number; anyOf: string[] }>(
  slots: S[],
  qualifiers: { teamId: string; group: string }[]
): Map<number, string> {
  const slotToTeam = new Map<number, string>();
  const teamToSlot = new Map<string, number>();
  const slotById = new Map(slots.map((s) => [s.id, s]));

  function tryAugment(slotId: number, visited: Set<string>): boolean {
    const slot = slotById.get(slotId);
    if (!slot) return false;
    const allowed = new Set(slot.anyOf);
    for (const q of qualifiers) {
      if (!allowed.has(q.group)) continue;
      if (visited.has(q.teamId)) continue;
      visited.add(q.teamId);
      const current = teamToSlot.get(q.teamId);
      if (current === undefined || tryAugment(current, visited)) {
        slotToTeam.set(slotId, q.teamId);
        teamToSlot.set(q.teamId, slotId);
        return true;
      }
    }
    return false;
  }

  // Try slots in tightest-first order so the matching prefers harder slots —
  // not strictly required for correctness, but makes the result stable.
  const ordered = [...slots].sort((a, b) => a.anyOf.length - b.anyOf.length);
  for (const slot of ordered) tryAugment(slot.id, new Set());
  return slotToTeam;
}

// Build the full R32 layout, resolving group-position sources from the user's
// group predictions and thirdPlace sources from the user's third-place
// qualifier picks. Each qualifier is assigned to at most one slot. If a
// thirdPlace seed has no eligible qualifier (e.g., the user didn't pick
// anyone from that seed's `anyOf` groups) the slot stays null and the
// bracket UI shows "—" for the user to override manually.
export function resolveR32Slots(
  groupPicks: Map<string, GroupPickLookup>,
  qualifierGroupByTeamId: Map<string, string>
): { slot: number; homeId: string | null; awayId: string | null; homeLabel: string; awayLabel: string }[] {
  const out = R32_SEEDING.map((seed) => ({
    slot: seed.slot,
    homeId: null as string | null,
    awayId: null as string | null,
    homeLabel: seedSourceLabel(seed.home),
    awayLabel: seedSourceLabel(seed.away),
  }));

  // Collect every thirdPlace position. We use the slot index + side as a
  // synthetic id so home and away thirdPlace positions are separate match
  // nodes (some R32 matches have thirdPlace on both sides in principle).
  type ThirdPlaceTarget = {
    id: number;
    anyOf: string[];
    outIdx: number;
    side: "home" | "away";
  };
  const targets: ThirdPlaceTarget[] = [];
  R32_SEEDING.forEach((seed, idx) => {
    if (seed.home.kind === "thirdPlace") {
      targets.push({ id: idx * 2, anyOf: [...seed.home.anyOf], outIdx: idx, side: "home" });
    }
    if (seed.away.kind === "thirdPlace") {
      targets.push({ id: idx * 2 + 1, anyOf: [...seed.away.anyOf], outIdx: idx, side: "away" });
    }
  });

  const qualifiers = [...qualifierGroupByTeamId].map(([teamId, group]) => ({
    teamId,
    group,
  }));
  const assigned = matchQualifiersToSlots(targets, qualifiers);
  for (const t of targets) {
    const teamId = assigned.get(t.id);
    if (!teamId) continue;
    if (t.side === "home") out[t.outIdx]!.homeId = teamId;
    else out[t.outIdx]!.awayId = teamId;
  }

  // Group-position sources are deterministic from the user's rankings.
  R32_SEEDING.forEach((seed, idx) => {
    if (seed.home.kind === "groupPos") {
      out[idx]!.homeId = resolveSeedSource(seed.home, groupPicks);
    }
    if (seed.away.kind === "groupPos") {
      out[idx]!.awayId = resolveSeedSource(seed.away, groupPicks);
    }
  });

  return out;
}
