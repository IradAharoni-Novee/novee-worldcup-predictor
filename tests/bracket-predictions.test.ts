import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// submitBracketPicks must reject picks that don't fit the live bracket tree.
// The UI only ever offers the two teams that flow into a slot, but a crafted
// API payload can place any team in any slot — and because bracket scoring is
// slot-independent, an off-slot team still scores, letting a user "select both
// teams of a match as winners" and always win. We mock only the boundaries
// (auth, lock, Prisma) and let the real projectR32Slots + reconcileBracketPicks
// run, then assert what the action actually persists.

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/locks", () => ({ isBracketLocked: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    match: { findMany: vi.fn() },
    bracketPick: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { isBracketLocked } from "@/lib/locks";
import { prisma } from "@/lib/prisma";
import { submitBracketPicks } from "@/lib/actions/bracket-predictions";
import type { ProjectedGroupMatch } from "@/lib/r32-projection";

const authMock = auth as unknown as Mock;
const lockedMock = isBracketLocked as unknown as Mock;
const findMany = prisma.match.findMany as unknown as Mock;
const createMany = prisma.bracketPick.createMany as unknown as Mock;

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

// All twelve groups finished, so every group-position source is determined and
// the projected Round of 32 has concrete teams in (among others) slot 2 (2A v
// 2B), slot 3 (1F v 2C) and slot 13 (2D v 2G).
const ALL_GROUPS = "ABCDEFGHIJKL"
  .split("")
  .flatMap((g) => strictGroup(g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]));

function submit(picks: { round: string; slot: number; teamId: string }[]) {
  const fd = new FormData();
  fd.set("picks", JSON.stringify(picks));
  return submitBracketPicks(null, fd);
}

function persistedKeys(): string[] {
  const data = createMany.mock.calls[0]?.[0]?.data as
    | { round: string; slot: number; teamId: string }[]
    | undefined;
  return (data ?? []).map((p) => `${p.round}:${p.slot}:${p.teamId}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1" } });
  lockedMock.mockResolvedValue(false);
  findMany.mockResolvedValue(ALL_GROUPS);
});

describe("submitBracketPicks structural validation", () => {
  it("strips a team parked in a slot it can't occupy (the hedge exploit)", async () => {
    // A2 legitimately wins slot 2 (2A v 2B). B2 is the other team in that same
    // match, illegally parked in slot 13 (2D v 2G) to hedge — distinct slot and
    // distinct team, so it slips past the dup guards. It must not be persisted.
    const result = await submit([
      { round: "R32", slot: 2, teamId: "A2" },
      { round: "R32", slot: 13, teamId: "B2" },
    ]);

    expect(result).toEqual({ ok: true });
    expect(persistedKeys()).toEqual(["R32:2:A2"]);
  });

  it("keeps a fully valid bracket tree across rounds", async () => {
    // R16 slot 1 is fed by R32 slots 2 and 3; A2 won slot 2, so A2 is a valid
    // R16:1 winner. Nothing here is off-tree, so everything persists.
    const result = await submit([
      { round: "R32", slot: 2, teamId: "A2" },
      { round: "R32", slot: 3, teamId: "F1" },
      { round: "R16", slot: 1, teamId: "A2" },
    ]);

    expect(result).toEqual({ ok: true });
    expect(persistedKeys()).toEqual(["R32:2:A2", "R32:3:F1", "R16:1:A2"]);
  });
});
