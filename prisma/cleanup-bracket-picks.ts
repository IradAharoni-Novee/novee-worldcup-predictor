/* eslint-disable no-console */
// One-off: walk every user's bracket picks and delete any that don't match
// the current group + third-place predictions. Run after the cascading
// cleanup landed so historical stale picks get scrubbed.

import { prisma } from "@/lib/prisma";
import { cleanupStaleBracketPicks } from "@/lib/bracket-cleanup";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  let totalRemoved = 0;
  for (const user of users) {
    const before = await prisma.bracketPick.count({ where: { userId: user.id } });
    await cleanupStaleBracketPicks(user.id);
    const after = await prisma.bracketPick.count({ where: { userId: user.id } });
    const removed = before - after;
    if (removed > 0) {
      console.log(`${user.email}: removed ${removed} stale pick${removed === 1 ? "" : "s"}`);
      totalRemoved += removed;
    }
  }
  console.log(`\nTotal stale picks removed across ${users.length} users: ${totalRemoved}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
