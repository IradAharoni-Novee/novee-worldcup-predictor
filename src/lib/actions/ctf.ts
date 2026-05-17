"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedEmail } from "@/lib/email-allowlist";
import { findFlagByCode, normaliseFlagInput } from "@/lib/ctf/flags";

// This file is the ONLY web-facing write path that touches CtfCapture, and it
// only ever calls `create`. There is no update, no delete, no admin override.
// No code path here touches Prediction, BracketPick, Setting, User, or any
// other predictor surface — the CTF is structurally incapable of changing
// scores, deleting users, or affecting the main game leaderboard.

export type CtfSubmitResult =
  | { ok: true; slug: string; points: number; alreadyCaptured: boolean }
  | { ok: false; error: string };

const submitSchema = z.object({
  code: z.string().min(1).max(200),
});

// Per-user rate limit, in-memory, single-instance. Good enough to slow down
// brute-force attempts; not a security boundary on its own (the flag space is
// already huge). Resets on server restart.
const ATTEMPT_WINDOW_MS = 60_000;
const ATTEMPT_LIMIT = 10;
const attempts = new Map<string, number[]>();

function recordAttempt(userId: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter(
    (t) => now - t < ATTEMPT_WINDOW_MS
  );
  if (recent.length >= ATTEMPT_LIMIT) {
    attempts.set(userId, recent);
    return false;
  }
  recent.push(now);
  attempts.set(userId, recent);
  return true;
}

export async function submitFlag(
  _prev: CtfSubmitResult | null,
  formData: FormData
): Promise<CtfSubmitResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email) {
    return { ok: false, error: "You must be signed in to submit flags." };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, error: "CTF play is restricted to @novee.security." };
  }

  if (!recordAttempt(userId)) {
    return {
      ok: false,
      error: "Slow down — too many attempts. Try again in a minute.",
    };
  }

  const parsed = submitSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { ok: false, error: "Enter a flag like `novee{...}`." };
  }

  const flagDef = findFlagByCode(parsed.data.code);
  if (!flagDef) {
    return { ok: false, error: "Not a valid flag. Keep looking." };
  }

  // The DB row may not exist yet if the seed hasn't been run; fail loud rather
  // than silently dropping the capture.
  const flag = await prisma.ctfFlag.findUnique({
    where: { slug: flagDef.slug },
    select: { id: true, points: true, slug: true },
  });
  if (!flag) {
    return { ok: false, error: "Flag is not registered. Ask an admin to seed." };
  }

  try {
    await prisma.ctfCapture.create({
      data: { userId, flagId: flag.id },
    });
  } catch (err) {
    // P2002 = unique constraint violation = user already captured this flag.
    // We surface that as a friendly success-ish result so the UI can react
    // appropriately. Anything else is a real error.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: true,
        slug: flag.slug,
        points: flag.points,
        alreadyCaptured: true,
      };
    }
    throw err;
  }

  revalidatePath("/ctf");
  return {
    ok: true,
    slug: flag.slug,
    points: flag.points,
    alreadyCaptured: false,
  };
}
