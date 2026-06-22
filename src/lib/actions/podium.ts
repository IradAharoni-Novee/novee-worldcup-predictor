"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isBracketLocked } from "@/lib/locks";
import { isAiPlayer } from "@/lib/ai-players";

export type PodiumSubmitResult = { ok: true } | { ok: false; error: string };

const podiumSchema = z.object({
  firstId: z.string().min(1),
  secondId: z.string().min(1),
  thirdId: z.string().min(1),
});

export async function submitPodiumPrediction(
  _prev: PodiumSubmitResult | null,
  formData: FormData
): Promise<PodiumSubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = podiumSchema.safeParse({
    firstId: formData.get("firstId"),
    secondId: formData.get("secondId"),
    thirdId: formData.get("thirdId"),
  });
  if (!parsed.success) return { ok: false, error: "Pick three players." };

  const { firstId, secondId, thirdId } = parsed.data;
  const ids = [firstId, secondId, thirdId];
  if (new Set(ids).size !== 3) {
    return { ok: false, error: "Pick three different players." };
  }

  if (await isBracketLocked()) {
    return {
      ok: false,
      error: "Podium picks are locked — the knockouts have started.",
    };
  }

  const picked = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true },
  });
  if (picked.length !== 3 || picked.some((u) => isAiPlayer(u.email))) {
    return { ok: false, error: "Pick three real players from the list." };
  }

  await prisma.podiumPrediction.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, firstId, secondId, thirdId },
    update: { firstId, secondId, thirdId },
  });

  revalidatePath("/podium");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true };
}
