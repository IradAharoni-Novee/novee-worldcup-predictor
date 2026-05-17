/* eslint-disable no-console */
// CTF flag seed. Upserts every flag in src/lib/ctf/flags.ts so the database
// matches the planted codes, and deletes any slugs that have been retired
// (cascading to any captures of them). Idempotent — safe to re-run.
//
//   pnpm exec tsx prisma/seed-ctf.ts

import { prisma } from "@/lib/prisma";
import { FLAG_LIST, RETIRED_FLAG_SLUGS } from "@/lib/ctf/flags";

async function main() {
  if (RETIRED_FLAG_SLUGS.length) {
    const result = await prisma.ctfFlag.deleteMany({
      where: { slug: { in: [...RETIRED_FLAG_SLUGS] } },
    });
    if (result.count > 0) {
      console.log(
        `  ✗ retired ${result.count} flag${result.count === 1 ? "" : "s"} ` +
          `(captures cascaded)`
      );
    }
  }

  for (const flag of FLAG_LIST) {
    await prisma.ctfFlag.upsert({
      where: { slug: flag.slug },
      create: {
        slug: flag.slug,
        code: flag.code,
        points: flag.points,
        hint: flag.hint,
        discoveryHint: flag.discoveryHint,
      },
      update: {
        code: flag.code,
        points: flag.points,
        hint: flag.hint,
        discoveryHint: flag.discoveryHint,
      },
    });
    console.log(`  ✓ ${flag.slug} (${flag.points} pts)`);
  }
  console.log(`Seeded ${FLAG_LIST.length} CTF flags.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
