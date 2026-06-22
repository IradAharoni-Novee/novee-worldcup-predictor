"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isGroupLocked } from "@/lib/locks";

const inputSchema = z.object({
  group: z.string().regex(/^[A-L]$/, "Invalid group"),
  team1stId: z.string().min(1),
  team2ndId: z.string().min(1),
  team3rdId: z.string().min(1),
  team4thId: z.string().min(1),
});

export type SubmitGroupResult = { ok: true } | { ok: false; error: string };

export async function submitGroupPrediction(
  _prev: SubmitGroupResult | null,
  formData: FormData
): Promise<SubmitGroupResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to predict." };
  }

  const parsed = inputSchema.safeParse({
    group: formData.get("group"),
    team1stId: formData.get("team1stId"),
    team2ndId: formData.get("team2ndId"),
    team3rdId: formData.get("team3rdId"),
    team4thId: formData.get("team4thId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Please pick a team for every position." };
  }
  const { group, team1stId, team2ndId, team3rdId, team4thId } = parsed.data;

  const picks = [team1stId, team2ndId, team3rdId, team4thId];
  if (new Set(picks).size !== 4) {
    return { ok: false, error: "Each team can only be ranked once." };
  }

  if (await isGroupLocked(group)) {
    return { ok: false, error: "This group is locked — first kickoff has passed." };
  }

  const groupMatches = await prisma.match.findMany({
    where: { stage: "GROUP", group },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const validTeams = new Set<string>();
  for (const m of groupMatches) {
    if (m.homeTeamId) validTeams.add(m.homeTeamId);
    if (m.awayTeamId) validTeams.add(m.awayTeamId);
  }
  for (const id of picks) {
    if (!validTeams.has(id)) {
      return { ok: false, error: "One of your picks isn't in this group." };
    }
  }

  const userId = session.user.id;
  await prisma.groupPrediction.upsert({
    where: { userId_group: { userId, group } },
    create: { userId, group, team1stId, team2ndId, team3rdId, team4thId },
    update: { team1stId, team2ndId, team3rdId, team4thId },
  });

  // Re-org may have moved the previous 3rd-place team to a different slot.
  // Drop any third-place qualifier picks that aren't 3rd-place in any of the
  // user's group predictions anymore — otherwise stale references would sit
  // in the DB even though the UI hides them.
  const allGroupPredictions = await prisma.groupPrediction.findMany({
    where: { userId },
    select: { team3rdId: true },
  });
  const valid3rdPlaceTeamIds = allGroupPredictions.map((p) => p.team3rdId);
  await prisma.thirdPlaceQualifierPick.deleteMany({
    where: {
      userId,
      ...(valid3rdPlaceTeamIds.length > 0
        ? { teamId: { notIn: valid3rdPlaceTeamIds } }
        : {}),
    },
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${group}`);
  revalidatePath("/bracket");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true };
}
