"use server";

import { revalidatePath } from "next/cache";
import type { Stage } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isLocked } from "@/lib/format";
import { isKnockout } from "@/lib/scoring";
import { resolveDeterminedKnockoutTeams } from "@/lib/knockout-live";

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
      fdId: true,
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
  // level score, and must name one of the two contesting teams. For a fixture
  // the feed hasn't formally populated yet — a later round whose teams are
  // already decided by prior-round results — resolve those teams from the live
  // knockout cascade. Anything else (group match, decisive score, unknown team,
  // or a matchup still projected from group standings) is stored as null.
  // Recomputed on every save so it self-clears when the score stops being level.
  const shootoutPick = await resolveShootoutPick({
    stage: match.stage,
    fdId: match.fdId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeScore,
    awayScore,
    shootoutWinnerTeamId,
  });

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

// Validate a shootout-winner pick against the fixture's two teams, taking the
// team ids off the record when set and otherwise resolving them from the live
// knockout cascade (a later round already decided by prior results). Returns the
// pick when it names one of those teams, else null.
async function resolveShootoutPick(match: {
  stage: Stage;
  fdId: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  shootoutWinnerTeamId: string | null;
}): Promise<string | null> {
  if (
    !isKnockout(match.stage) ||
    match.homeScore !== match.awayScore ||
    match.shootoutWinnerTeamId == null
  ) {
    return null;
  }
  let { homeTeamId, awayTeamId } = match;
  if (homeTeamId == null || awayTeamId == null) {
    const determined = await resolveDeterminedKnockoutTeams(match);
    if (!determined) return null;
    ({ homeTeamId, awayTeamId } = determined);
  }
  return match.shootoutWinnerTeamId === homeTeamId ||
    match.shootoutWinnerTeamId === awayTeamId
    ? match.shootoutWinnerTeamId
    : null;
}
