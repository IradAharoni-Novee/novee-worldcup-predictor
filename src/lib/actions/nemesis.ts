"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  // Empty string clears the nemesis.
  nemesisId: z.string().trim(),
});

export type NemesisResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setNemesis(
  _prev: NemesisResult | null,
  formData: FormData
): Promise<NemesisResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  const parsed = inputSchema.safeParse({
    nemesisId: formData.get("nemesisId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid nemesis selection." };
  }
  const { nemesisId } = parsed.data;

  if (nemesisId === session.user.id) {
    return { ok: false, error: "You cannot nominate yourself as nemesis." };
  }

  if (nemesisId.length === 0) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { nemesisId: null },
    });
    revalidatePath("/me");
    return { ok: true };
  }

  const exists = await prisma.user.findUnique({
    where: { id: nemesisId },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nemesisId },
  });
  revalidatePath("/me");
  return { ok: true };
}
