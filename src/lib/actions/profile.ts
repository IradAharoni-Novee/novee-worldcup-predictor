"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOwnedBlobUrl } from "@/lib/avatar";
import { parseDisplayName } from "@/lib/profile";

export type ProfileResult = { ok: true } | { ok: false; error: string };

function revalidateProfileSurfaces() {
  revalidatePath("/me");
  // Refresh the authenticated layout so the top-bar name/avatar update.
  revalidatePath("/", "layout");
}

export async function updateProfile(
  _prev: ProfileResult | null,
  formData: FormData
): Promise<ProfileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  const parsed = parseDisplayName(formData.get("name"));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.name },
  });
  revalidateProfileSurfaces();
  return { ok: true };
}

export async function removeAvatar(): Promise<ProfileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });

  if (me?.image && isOwnedBlobUrl(me.image) && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(me.image);
    } catch (err) {
      // Best-effort cleanup — never block the user on an orphaned blob.
      // eslint-disable-next-line no-console
      console.warn("Failed to delete old avatar blob:", err);
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: null },
  });
  revalidateProfileSurfaces();
  return { ok: true };
}
