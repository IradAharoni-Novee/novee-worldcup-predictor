"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isLocked } from "@/lib/format";
import { MAX_THIRD_PLACE_QUALIFIERS } from "@/lib/third-place-qualifiers";
import { cleanupStaleBracketPicks } from "@/lib/bracket-cleanup";

const inputSchema = z.object({
  teamIds: z.array(z.string().min(1)).max(MAX_THIRD_PLACE_QUALIFIERS),
});

export type SubmitThirdPlaceResult =
  | { ok: true }
  | { ok: false; error: string };

// The third-place qualifier picks lock when every group has kicked off — the
// last group's first match locks the picks (i.e. the bracket implications
// settle from that point on).
async function isThirdPlaceLocked(now: Date = new Date()): Promise<boolean> {
  const rows = await prisma.match.groupBy({
    by: ["group"],
    where: { stage: "GROUP", group: { not: null } },
    _min: { kickoff: true },
  });
  if (rows.length === 0) return false;
  for (const r of rows) {
    if (!r._min.kickoff) continue;
    if (!isLocked(r._min.kickoff, now)) return false;
  }
  return true;
}

export async function submitThirdPlaceQualifiers(
  _prev: SubmitThirdPlaceResult | null,
  formData: FormData
): Promise<SubmitThirdPlaceResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to predict." };
  }

  const raw = formData.get("teamIds");
  if (typeof raw !== "string") {
    return { ok: false, error: "Missing picks payload." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Picks payload is not valid JSON." };
  }
  const valid = inputSchema.safeParse({ teamIds: parsed });
  if (!valid.success) {
    return { ok: false, error: "Invalid third-place selection." };
  }
  const teamIds = [...new Set(valid.data.teamIds)];

  if (teamIds.length > MAX_THIRD_PLACE_QUALIFIERS) {
    return {
      ok: false,
      error: `Pick at most ${MAX_THIRD_PLACE_QUALIFIERS} third-place qualifiers.`,
    };
  }

  if (await isThirdPlaceLocked()) {
    return {
      ok: false,
      error: "Third-place picks are locked — all groups have kicked off.",
    };
  }

  const userId = session.user.id;
  await prisma.$transaction([
    prisma.thirdPlaceQualifierPick.deleteMany({ where: { userId } }),
    prisma.thirdPlaceQualifierPick.createMany({
      data: teamIds.map((teamId) => ({ userId, teamId })),
    }),
  ]);

  // Bracket picks for teams the user *removed* from the third-place set are
  // now stale (their team is no longer in their predicted R32). Drop those.
  await cleanupStaleBracketPicks(userId);

  revalidatePath("/groups");
  revalidatePath("/bracket");
  revalidatePath("/me");
  return { ok: true };
}
