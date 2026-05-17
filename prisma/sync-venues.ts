/* eslint-disable no-console */
// One-off: trigger the ESPN venue sync from the CLI. The same function runs
// inside the daily /api/cron/sync route. Useful for backfilling or local
// testing.
//
// Run: pnpm exec tsx prisma/sync-venues.ts

import { prisma } from "@/lib/prisma";
import { syncVenuesFromEspn } from "@/lib/sync";

async function main() {
  const result = await syncVenuesFromEspn();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
