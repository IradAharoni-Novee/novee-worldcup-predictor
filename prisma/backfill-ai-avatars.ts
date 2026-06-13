/* eslint-disable no-console */
// One-shot: render each seeded AI player's brand mark to a PNG, upload it to
// Vercel Blob, and store the URL as their User.image. Lets an already-seeded
// database pick up avatars without a full re-seed (which would regenerate the
// AI players' predictions). Idempotent — the blob path and URL are stable.
// Run with: pnpm exec tsx prisma/backfill-ai-avatars.ts

import { AI_AVATAR_EMAILS, renderAndUploadAiAvatar } from "@/lib/ai-avatar-upload";
import { prisma } from "@/lib/prisma";

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set. Run `vercel env pull`.");
    process.exit(1);
  }

  let updated = 0;
  let missing = 0;
  for (const email of AI_AVATAR_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      console.log(`  · ${email}  — no user row (seed first)`);
      missing++;
      continue;
    }
    const image = await renderAndUploadAiAvatar(email);
    await prisma.user.update({ where: { id: user.id }, data: { image } });
    console.log(`  ✓ ${email}  — ${image}`);
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${missing} not found.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
