"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  syncFromFootballData,
  syncSquadsFromFootballData,
  syncVenuesFromEspn,
} from "@/lib/sync";
import { MatchStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error("Forbidden");
}

const scoreSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.coerce.number().int().min(0).max(20).nullable(),
  awayScore: z.coerce.number().int().min(0).max(20).nullable(),
  status: z.enum(["SCHEDULED", "LIVE", "FINISHED"]),
});

export type AdminResult = { ok: true } | { ok: false; error: string };

export async function updateMatchResult(
  _prev: AdminResult | null,
  formData: FormData
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admins only." };
  }

  const homeRaw = formData.get("homeScore");
  const awayRaw = formData.get("awayScore");
  const parsed = scoreSchema.safeParse({
    matchId: formData.get("matchId"),
    homeScore: homeRaw === "" || homeRaw == null ? null : homeRaw,
    awayScore: awayRaw === "" || awayRaw == null ? null : awayRaw,
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid score values." };
  const { matchId, homeScore, awayScore, status } = parsed.data;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      status: status as MatchStatus,
    },
  });

  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidatePath("/leaderboard");
  revalidatePath("/bracket");
  return { ok: true };
}

export async function toggleAdminFlag(userId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admins only." };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: !user.isAdmin },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function triggerSync(): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admins only." };
  }
  try {
    const result = await syncFromFootballData();
    // ESPN venue sync is optional — failures shouldn't bubble up as if the
    // whole sync failed.
    try {
      await syncVenuesFromEspn();
    } catch {
      // swallow; surfaced separately if needed
    }
    revalidatePath("/matches");
    revalidatePath("/bracket");
    revalidatePath("/admin/matches");
    return {
      ok: true,
      ...result,
    } as AdminResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { ok: false, error: message };
  }
}

export async function triggerSquadSync(): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admins only." };
  }
  try {
    const result = await syncSquadsFromFootballData();
    revalidatePath("/awards");
    revalidatePath("/admin/awards");
    return { ok: true, ...result } as AdminResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { ok: false, error: message };
  }
}
