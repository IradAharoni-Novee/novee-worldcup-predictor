"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isLocked } from "@/lib/format";
import { isKnockout } from "@/lib/scoring";

const inputSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.coerce.number().int().min(0).max(20),
  awayScore: z.coerce.number().int().min(0).max(20),
  shootoutWinnerTeamId: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
  note: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
});

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitPrediction(
  _prev: SubmitResult | null,
  formData: FormData
): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to predict." };
  }

  const rawNote = formData.get("note");
  const parsed = inputSchema.safeParse({
    matchId: formData.get("matchId"),
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
    shootoutWinnerTeamId: formData.get("shootoutWinnerTeamId") ?? undefined,
    note: typeof rawNote === "string" ? rawNote : undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Scores must be whole numbers between 0 and 20." };
  }
  const { matchId, homeScore, awayScore, shootoutWinnerTeamId, note } =
    parsed.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      kickoff: true,
      status: true,
      stage: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.status !== "SCHEDULED" || isLocked(match.kickoff)) {
    return { ok: false, error: "This match is locked — kickoff has passed." };
  }

  // The shootout-winner pick is only meaningful for a knockout predicted as a
  // level score, and must be one of the two teams. Anything else (group match,
  // decisive score, unknown team) is stored as null — recomputed on every save
  // so it self-clears when the score stops being a level knockout.
  const shootoutPick =
    isKnockout(match.stage) &&
    homeScore === awayScore &&
    shootoutWinnerTeamId != null &&
    (shootoutWinnerTeamId === match.homeTeamId ||
      shootoutWinnerTeamId === match.awayTeamId)
      ? shootoutWinnerTeamId
      : null;

  // Notes default to null when the field is omitted from the form (e.g.
  // the score editor saves on stepper click without the note input).
  // Only overwrite an existing note when the caller explicitly sent one.
  const noteUpdate =
    rawNote === null ? {} : { note };

  await prisma.prediction.upsert({
    where: {
      userId_matchId: { userId: session.user.id, matchId: match.id },
    },
    create: {
      userId: session.user.id,
      matchId: match.id,
      homeScore,
      awayScore,
      shootoutWinnerTeamId: shootoutPick,
      note,
    },
    update: { homeScore, awayScore, shootoutWinnerTeamId: shootoutPick, ...noteUpdate },
  });

  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/me");
  return { ok: true };
}
