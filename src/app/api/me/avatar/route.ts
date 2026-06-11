import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { del, put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOwnedBlobUrl, validateAvatarUpload } from "@/lib/avatar";
import { processAvatar } from "@/lib/avatar-process";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Photo uploads aren't configured." },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  }

  const check = validateAvatarUpload({ type: file.type, size: file.size });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  // sharp is the real MIME enforcer: a spoofed Content-Type passes the declared
  // checks above but fails to decode here (also catches decompression bombs that
  // slip under the byte cap).
  let processed: Buffer;
  try {
    processed = await processAvatar(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json(
      { error: "That file isn't a valid image." },
      { status: 400 }
    );
  }

  const blob = await put(`avatars/${session.user.id}.webp`, processed, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: true,
  });

  const previous = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: blob.url },
  });

  if (previous?.image && isOwnedBlobUrl(previous.image)) {
    try {
      await del(previous.image);
    } catch (err) {
      // Best-effort cleanup — never block the upload on an orphaned blob.
      // eslint-disable-next-line no-console
      console.warn("Failed to delete old avatar blob:", err);
    }
  }

  revalidatePath("/me");
  revalidatePath("/", "layout");
  return NextResponse.json({ url: blob.url });
}
