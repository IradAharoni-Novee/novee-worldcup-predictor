"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Stage } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isBracketLocked } from "@/lib/locks";
import { projectR32Slots } from "@/lib/r32-projection";
import { reconcileBracketPicks } from "@/lib/bracket-validation";

const KNOCKOUT_STAGES = ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] as const;
const stageSchema = z.enum(KNOCKOUT_STAGES);

const pickSchema = z.object({
  round: stageSchema,
  slot: z.number().int().min(0).max(31),
  teamId: z.string().min(1),
});

const inputSchema = z.object({
  picks: z.array(pickSchema).min(1).max(64),
});

export type SubmitBracketResult = { ok: true } | { ok: false; error: string };

export async function submitBracketPicks(
  _prev: SubmitBracketResult | null,
  formData: FormData
): Promise<SubmitBracketResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to predict." };
  }

  const rawPicks = formData.get("picks");
  if (typeof rawPicks !== "string") {
    return { ok: false, error: "Missing picks payload." };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawPicks);
  } catch {
    return { ok: false, error: "Picks payload is not valid JSON." };
  }

  const parsed = inputSchema.safeParse({ picks: parsedJson });
  if (!parsed.success) {
    return { ok: false, error: "One or more picks are invalid." };
  }

  if (await isBracketLocked()) {
    return { ok: false, error: "The bracket is locked — knockouts have started." };
  }

  // No duplicate (round, slot) pairs.
  const slotKeys = new Set<string>();
  for (const p of parsed.data.picks) {
    const key = `${p.round}:${p.slot}`;
    if (slotKeys.has(key)) {
      return { ok: false, error: "Duplicate slot in your bracket." };
    }
    slotKeys.add(key);
  }

  // No duplicate teams within the same round.
  const teamsByRound = new Map<Stage, Set<string>>();
  for (const p of parsed.data.picks) {
    const existing = teamsByRound.get(p.round) ?? new Set<string>();
    if (existing.has(p.teamId)) {
      return { ok: false, error: `A team can't win two matches in the same round (${p.round}).` };
    }
    existing.add(p.teamId);
    teamsByRound.set(p.round, existing);
  }

  // Enforce the bracket tree server-side. The form only ever offers the two
  // teams that flow into a slot, but a raw API payload can put any team in any
  // slot — and since scoring is slot-independent, an off-slot team would still
  // score, letting a user "pick both teams of a match" and always win. Project
  // the live Round of 32 from real group results (the same projection the page
  // uses) and keep only picks that fit the cascading matchups.
  const groupMatches = await prisma.match.findMany({
    where: { stage: "GROUP", group: { not: null } },
    select: {
      group: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
    },
  });
  const r32Slots = projectR32Slots(
    groupMatches.map((m) => ({ ...m, group: m.group as string }))
  );
  const { valid } = reconcileBracketPicks(
    r32Slots,
    parsed.data.picks.map((p) => ({
      round: p.round as Stage,
      slot: p.slot,
      teamId: p.teamId,
    }))
  );

  const userId = session.user.id;
  await prisma.$transaction([
    prisma.bracketPick.deleteMany({ where: { userId } }),
    prisma.bracketPick.createMany({
      data: valid.map((p) => ({
        userId,
        round: p.round,
        slot: p.slot,
        teamId: p.teamId,
      })),
    }),
  ]);

  revalidatePath("/bracket");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true };
}
