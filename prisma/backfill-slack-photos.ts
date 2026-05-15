/* eslint-disable no-console */
// One-shot: look up every (non-AI) user in Slack and store their profile photo.
// Run with: pnpm exec tsx prisma/backfill-slack-photos.ts

import { prisma } from "@/lib/prisma";
import { fetchSlackProfile } from "@/lib/slack";

async function main() {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error("SLACK_BOT_TOKEN is not set in .env");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: {
      NOT: [
        { email: { startsWith: "opus-" } },
        { email: { startsWith: "gpt-" } },
        { email: { startsWith: "claude" } },
        { email: { startsWith: "chatgpt" } },
      ],
    },
    select: { id: true, email: true, name: true, image: true },
  });

  console.log(`Looking up ${users.length} users in Slack…\n`);

  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  for (const u of users) {
    const profile = await fetchSlackProfile(u.email);
    if (!profile) {
      console.log(`  · ${u.email}  — not found in Slack`);
      missing++;
      continue;
    }
    const data: { image?: string; name?: string } = {};
    if (profile.image && profile.image !== u.image) data.image = profile.image;
    if (profile.name && profile.name !== u.name) data.name = profile.name;
    if (Object.keys(data).length === 0) {
      console.log(`  = ${u.email}  — already up to date`);
      unchanged++;
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data });
    const bits = [
      data.name ? `name=${data.name}` : null,
      data.image ? `image=…${data.image.slice(-20)}` : null,
    ].filter(Boolean);
    console.log(`  ✓ ${u.email}  — ${bits.join(", ")}`);
    updated++;
  }

  console.log(
    `\nDone. ${updated} updated, ${unchanged} unchanged, ${missing} not in workspace.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
