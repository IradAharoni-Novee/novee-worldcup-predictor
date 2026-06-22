import {
  computeGroupStandings,
  compareStandings,
  type GroupMatch,
  type Standing,
} from "@/lib/group-standings";
import {
  R32_STRUCTURE,
  slotSourceLabel,
  type SlotSource,
} from "@/lib/r32-structure";
import { allocateThirdPlaces, THIRD_PLACE_WINNER_COLUMNS } from "@/lib/third-place-allocation";

export type ProjectedGroupMatch = GroupMatch & { group: string };

export type ProjectedSlot = {
  slot: number;
  homeId: string | null;
  awayId: string | null;
  homeLabel: string;
  awayLabel: string;
};

const THIRDS_NEEDED = THIRD_PLACE_WINNER_COLUMNS.length; // 8

type GroupTable = {
  group: string;
  standings: Standing[];
  hasResults: boolean;
};

function buildGroupTables(matches: ProjectedGroupMatch[]): Map<string, GroupTable> {
  const byGroup = new Map<string, ProjectedGroupMatch[]>();
  for (const m of matches) {
    const list = byGroup.get(m.group) ?? [];
    list.push(m);
    byGroup.set(m.group, list);
  }

  const tables = new Map<string, GroupTable>();
  for (const [group, groupMatches] of byGroup) {
    const teamIds = new Set<string>();
    let hasResults = false;
    for (const m of groupMatches) {
      if (m.homeTeamId) teamIds.add(m.homeTeamId);
      if (m.awayTeamId) teamIds.add(m.awayTeamId);
      if (
        m.homeScore != null &&
        m.awayScore != null &&
        m.homeTeamId != null &&
        m.awayTeamId != null
      ) {
        hasResults = true;
      }
    }
    tables.set(group, {
      group,
      standings: computeGroupStandings(groupMatches, [...teamIds]),
      hasResults,
    });
  }
  return tables;
}

// Best eight third-placed groups by FIFA Article 12.6: rank every group's
// third-placed team by points/GD/GF (compareStandings) and take the top eight.
// Only groups that have played a match contribute; until eight qualify the
// allocation is undefined and third-place slots stay as labels.
function qualifyingThirdGroups(tables: Map<string, GroupTable>): string[] {
  const thirds: { group: string; standing: Standing }[] = [];
  for (const table of tables.values()) {
    if (!table.hasResults) continue;
    const third = table.standings[2];
    if (third) thirds.push({ group: table.group, standing: third });
  }
  if (thirds.length < THIRDS_NEEDED) return [];
  thirds.sort((a, b) => compareStandings(a.standing, b.standing));
  return thirds.slice(0, THIRDS_NEEDED).map((t) => t.group);
}

// Project the live Round of 32 from real group results. Group-position sources
// resolve from each group's current standings; third-place sources resolve via
// the Annex C allocation of the current best-eight thirds. Any source that
// isn't determined yet stays null, and the slot's label is shown instead.
export function projectR32Slots(matches: ProjectedGroupMatch[]): ProjectedSlot[] {
  const tables = buildGroupTables(matches);
  const allocation = allocateThirdPlaces(qualifyingThirdGroups(tables));

  const positionTeamId = (group: string, index: 0 | 1 | 2): string | null => {
    const table = tables.get(group);
    if (!table || !table.hasResults) return null;
    return table.standings[index]?.teamId ?? null;
  };

  const resolve = (source: SlotSource): string | null => {
    switch (source.kind) {
      case "winner":
        return positionTeamId(source.group, 0);
      case "runnerUp":
        return positionTeamId(source.group, 1);
      case "third": {
        const thirdGroup = allocation.get(source.winnerGroup);
        return thirdGroup ? positionTeamId(thirdGroup, 2) : null;
      }
    }
  };

  return R32_STRUCTURE.map((slot) => ({
    slot: slot.slot,
    homeId: resolve(slot.home),
    awayId: resolve(slot.away),
    homeLabel: slotSourceLabel(slot.home),
    awayLabel: slotSourceLabel(slot.away),
  }));
}
