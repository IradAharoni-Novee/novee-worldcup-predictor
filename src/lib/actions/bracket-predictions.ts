"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Stage } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isBracketLocked } from "@/lib/locks";

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

  const userId = session.user.id;
  await prisma.$transaction([
    prisma.bracketPick.deleteMany({ where: { userId } }),
    prisma.bracketPick.createMany({
      data: parsed.data.picks.map((p) => ({
        userId,
        round: p.round as Stage,
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
