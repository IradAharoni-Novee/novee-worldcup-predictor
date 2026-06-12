/* eslint-disable no-console */
// One-shot: rename the seeded "Opus 4.7" AI shadow player to "Opus 4.8" and
// move its email to opus-4.8@novee.security. Predictions are tied to the user
// id, so they ride along unchanged. Idempotent: re-running after success is a
// no-op. Run against the production DB with:
//   pnpm exec tsx prisma/rename-opus-player.ts

import { prisma } from "@/lib/prisma";

const OLD_EMAIL = "opus-4.7@novee.security";
const NEW_EMAIL = "opus-4.8@novee.security";
const NEW_NAME = "Opus 4.8";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: NEW_EMAIL },
    select: { id: true, name: true },
  });
  if (existing) {
    console.log(
      `Nothing to do: ${NEW_EMAIL} already exists (name="${existing.name}").`
    );
    return;
  }

  const old = await prisma.user.findUnique({
    where: { email: OLD_EMAIL },
    select: { id: true, name: true, _count: { select: { predictions: true } } },
  });
  if (!old) {
    console.error(
      `No user found with email ${OLD_EMAIL} and ${NEW_EMAIL} does not exist. ` +
        "Aborting — nothing matched."
    );
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: old.id },
    data: { email: NEW_EMAIL, name: NEW_NAME },
    select: { id: true, email: true, name: true },
  });

  console.log(
    `Renamed user ${old.id}: "${old.name}" <${OLD_EMAIL}> ` +
      `→ "${updated.name}" <${updated.email}> ` +
      `(${old._count.predictions} predictions carried over).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
