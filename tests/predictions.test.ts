import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Stage } from "@prisma/client";

// A shootout-winner pick must name one of the fixture's two teams. For a later
// knockout round the feed hasn't populated yet but whose teams are already
// decided by prior-round results, submitPrediction resolves those teams from the
// live cascade (not just the match record) so the pick persists — while a
// matchup still projected from group standings stays id-less and is dropped. We
// mock only the boundaries (auth, Prisma, cache) and let the real projection run.

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    match: { findUnique: vi.fn(), findMany: vi.fn() },
    team: { findMany: vi.fn() },
    prediction: { upsert: vi.fn() },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { submitPrediction } from "@/lib/actions/predictions";
import type { ProjectedGroupMatch } from "@/lib/r32-projection";

const authMock = auth as unknown as Mock;
const findUnique = prisma.match.findUnique as unknown as Mock;
const findMany = prisma.match.findMany as unknown as Mock;
const teamFindMany = prisma.team.findMany as unknown as Mock;
const upsert = prisma.prediction.upsert as unknown as Mock;

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

// Every group finished, so the projected Round of 32 has concrete teams.
const ALL_GROUPS = "ABCDEFGHIJKL"
  .split("")
  .flatMap((g) => strictGroup(g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]));

const won = (fdId: number, advancingTeamId: string) => ({
  fdId,
  stage: Stage.R32,
  homeTeamId: null,
  awayTeamId: null,
  advancingTeamId,
});

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// R16 slot 1 (fd 537376) is fed by R32 slot 2 (537417) and slot 3 (537418).
function mockKnockout(matches: unknown[]) {
  findMany.mockImplementation(({ where }: { where: { stage?: unknown } }) =>
    where?.stage === "GROUP"
      ? Promise.resolve(ALL_GROUPS)
      : Promise.resolve(matches)
  );
}

function submit(
  match: { id: string; fdId: number; stage: Stage },
  fields: { homeScore: number; awayScore: number; shootoutWinnerTeamId: string }
) {
  findUnique.mockResolvedValue({
    id: match.id,
    fdId: match.fdId,
    kickoff: FUTURE,
    status: "SCHEDULED",
    stage: match.stage,
    homeTeamId: null,
    awayTeamId: null,
  });
  const fd = new FormData();
  fd.set("matchId", match.id);
  fd.set("homeScore", String(fields.homeScore));
  fd.set("awayScore", String(fields.awayScore));
  fd.set("shootoutWinnerTeamId", fields.shootoutWinnerTeamId);
  return submitPrediction(null, fd);
}

function persistedShootout(): string | null | undefined {
  return upsert.mock.calls[0]?.[0]?.create?.shootoutWinnerTeamId;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1" } });
  teamFindMany.mockResolvedValue([]);
  upsert.mockResolvedValue({});
});

describe("submitPrediction shootout-winner validation", () => {
  it("persists a pick for a Round of 16 decided by prior-round results", async () => {
    mockKnockout([
      { fdId: 537376, stage: Stage.R16, homeTeamId: null, awayTeamId: null, advancingTeamId: null },
      won(537417, "A2"),
      won(537418, "F1"),
    ]);

    const result = await submit(
      { id: "m-r16-1", fdId: 537376, stage: Stage.R16 },
      { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "A2" }
    );

    expect(result).toEqual({ ok: true });
    expect(persistedShootout()).toBe("A2");
  });

  it("drops a pick that names a team not in the resolved matchup", async () => {
    mockKnockout([
      { fdId: 537376, stage: Stage.R16, homeTeamId: null, awayTeamId: null, advancingTeamId: null },
      won(537417, "A2"),
      won(537418, "F1"),
    ]);

    const result = await submit(
      { id: "m-r16-1", fdId: 537376, stage: Stage.R16 },
      { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "Z9" }
    );

    expect(result).toEqual({ ok: true });
    expect(persistedShootout()).toBeNull();
  });

  it("drops a pick for a matchup still projected from group standings", async () => {
    // R32 slot 2 has no decided feeders — it is a group-standings projection, so
    // its teams can still change and the pick must not be stored.
    mockKnockout([
      { fdId: 537417, stage: Stage.R32, homeTeamId: null, awayTeamId: null, advancingTeamId: null },
    ]);

    const result = await submit(
      { id: "m-r32-2", fdId: 537417, stage: Stage.R32 },
      { homeScore: 1, awayScore: 1, shootoutWinnerTeamId: "A2" }
    );

    expect(result).toEqual({ ok: true });
    expect(persistedShootout()).toBeNull();
  });

  it("drops the pick when the predicted score is decisive", async () => {
    mockKnockout([
      { fdId: 537376, stage: Stage.R16, homeTeamId: null, awayTeamId: null, advancingTeamId: null },
      won(537417, "A2"),
      won(537418, "F1"),
    ]);

    const result = await submit(
      { id: "m-r16-1", fdId: 537376, stage: Stage.R16 },
      { homeScore: 2, awayScore: 1, shootoutWinnerTeamId: "A2" }
    );

    expect(result).toEqual({ ok: true });
    expect(persistedShootout()).toBeNull();
    // A decisive score never needs the projection.
    expect(findMany).not.toHaveBeenCalled();
  });
});
