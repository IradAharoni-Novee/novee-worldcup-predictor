import { describe, expect, it } from "vitest";
import { Stage } from "@prisma/client";
import { reconcileBracketPicks, type StoredPick } from "@/lib/bracket-validation";
import type { ProjectedSlot } from "@/lib/r32-projection";

function emptySlots(): ProjectedSlot[] {
  return Array.from({ length: 16 }, (_, slot) => ({
    slot,
    homeId: null,
    awayId: null,
    homeLabel: "",
    awayLabel: "",
  }));
}

function withTeams(
  overrides: Record<number, { home: string | null; away: string | null }>
): ProjectedSlot[] {
  const slots = emptySlots();
  for (const [slot, teams] of Object.entries(overrides)) {
    slots[Number(slot)]!.homeId = teams.home;
    slots[Number(slot)]!.awayId = teams.away;
  }
  return slots;
}

const pick = (round: Stage, slot: number, teamId: string): StoredPick => ({
  round,
  slot,
  teamId,
});

describe("reconcileBracketPicks", () => {
  it("keeps picks that still match the live matchup", () => {
    const r32 = withTeams({ 0: { home: "A", away: "B" } });
    const { valid, staleR32Slots } = reconcileBracketPicks(r32, [
      pick(Stage.R32, 0, "A"),
    ]);
    expect(valid).toHaveLength(1);
    expect(staleR32Slots).toEqual([]);
  });

  it("flags an R32 slot whose pick is no longer one of the two teams", () => {
    const r32 = withTeams({ 1: { home: "C", away: "D" } });
    const { valid, staleR32Slots } = reconcileBracketPicks(r32, [
      pick(Stage.R32, 1, "X"),
    ]);
    expect(valid).toEqual([]);
    expect(staleR32Slots).toEqual([1]);
  });

  it("does not flag an undetermined slot (no teams yet)", () => {
    const r32 = emptySlots();
    const { valid, staleR32Slots } = reconcileBracketPicks(r32, [
      pick(Stage.R32, 5, "X"),
    ]);
    expect(valid).toEqual([]);
    expect(staleR32Slots).toEqual([]);
  });

  it("cascades: a stale R32 pick drops the downstream picks it fed", () => {
    // R16 slot 0 is fed by R32 slots 0 and 1. R32:1 goes stale, so R16:0's away
    // side disappears and any pick that depended on it is invalid.
    const r32 = withTeams({
      0: { home: "A", away: "B" },
      1: { home: "C", away: "D" },
    });
    const { valid, staleR32Slots } = reconcileBracketPicks(r32, [
      pick(Stage.R32, 0, "A"), // valid
      pick(Stage.R32, 1, "X"), // stale — X not in {C,D}
      pick(Stage.R16, 0, "A"), // valid: A is still the R32:0 winner
      pick(Stage.QF, 0, "A"), // valid: fed by R16:0 winner A
    ]);
    const keys = valid.map((p) => `${p.round}:${p.slot}`);
    expect(keys).toEqual(["R32:0", "R16:0", "QF:0"]);
    expect(staleR32Slots).toEqual([1]);
  });

  it("drops a downstream pick that references a team not in its (valid) pair without flagging it", () => {
    const r32 = withTeams({
      0: { home: "A", away: "B" },
      1: { home: "C", away: "D" },
    });
    const { valid, staleR32Slots } = reconcileBracketPicks(r32, [
      pick(Stage.R32, 0, "A"),
      pick(Stage.R32, 1, "C"),
      pick(Stage.R16, 0, "B"), // B lost R32:0 to A, so not a valid R16:0 team
    ]);
    const keys = valid.map((p) => `${p.round}:${p.slot}`);
    expect(keys).toEqual(["R32:0", "R32:1"]);
    expect(staleR32Slots).toEqual([]);
  });
});
