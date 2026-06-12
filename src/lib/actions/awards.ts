"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAwardsLocked } from "@/lib/locks";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
} from "@/lib/scoring-awards";

export type AwardSubmitResult = { ok: true } | { ok: false; error: string };

const winnerSchema = z.object({ teamId: z.string().min(1) });
const goldenBootSchema = z.object({ playerId: z.string().min(1) });

export async function submitWinnerPrediction(
  _prev: AwardSubmitResult | null,
  formData: FormData
): Promise<AwardSubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = winnerSchema.safeParse({ teamId: formData.get("teamId") });
  if (!parsed.success) return { ok: false, error: "Please pick a team." };

  if (await isAwardsLocked()) {
    return { ok: false, error: "Predictions are locked — the deadline has passed." };
  }

  const team = await prisma.team.findUnique({ where: { id: parsed.data.teamId } });
  if (!team) return { ok: false, error: "Unknown team." };

  await prisma.tournamentWinnerPrediction.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, teamId: parsed.data.teamId },
    update: { teamId: parsed.data.teamId },
  });

  revalidatePath("/awards");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function submitGoldenBootPrediction(
  _prev: AwardSubmitResult | null,
  formData: FormData
): Promise<AwardSubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = goldenBootSchema.safeParse({ playerId: formData.get("playerId") });
  if (!parsed.success) return { ok: false, error: "Please pick a player." };

  if (await isAwardsLocked()) {
    return { ok: false, error: "Predictions are locked — the deadline has passed." };
  }

  const player = await prisma.player.findUnique({ where: { id: parsed.data.playerId } });
  if (!player) return { ok: false, error: "Unknown player." };

  await prisma.goldenBootPrediction.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, playerId: parsed.data.playerId },
    update: { playerId: parsed.data.playerId },
  });

  revalidatePath("/awards");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true };
}

const actualSchema = z.object({
  actualWinnerTeamId: z.string().nullable().optional(),
  actualGoldenBootPlayerId: z.string().nullable().optional(),
});

export async function setActualAwards(
  _prev: AwardSubmitResult | null,
  formData: FormData
): Promise<AwardSubmitResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return { ok: false, error: "Admin only." };
  }

  const winnerRaw = formData.get("actualWinnerTeamId");
  const gbRaw = formData.get("actualGoldenBootPlayerId");
  const parsed = actualSchema.safeParse({
    actualWinnerTeamId: typeof winnerRaw === "string" && winnerRaw !== "" ? winnerRaw : null,
    actualGoldenBootPlayerId: typeof gbRaw === "string" && gbRaw !== "" ? gbRaw : null,
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const winnerValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    parsed.data.actualWinnerTeamId ?? Prisma.JsonNull;
  const gbValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    parsed.data.actualGoldenBootPlayerId ?? Prisma.JsonNull;

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SETTING_KEY_ACTUAL_WINNER },
      create: { key: SETTING_KEY_ACTUAL_WINNER, value: winnerValue },
      update: { value: winnerValue },
    }),
    prisma.setting.upsert({
      where: { key: SETTING_KEY_ACTUAL_GOLDEN_BOOT },
      create: { key: SETTING_KEY_ACTUAL_GOLDEN_BOOT, value: gbValue },
      update: { value: gbValue },
    }),
  ]);

  revalidatePath("/admin/awards");
  revalidatePath("/awards");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true };
}
