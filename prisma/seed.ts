import { syncFromFootballData } from "@/lib/sync";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Seeding default scoring settings…");
  await prisma.setting.upsert({
    where: { key: "scoring" },
    create: {
      key: "scoring",
      value: { exactScore: 3, correctOutcome: 1, knockoutMultiplier: 2 },
    },
    update: {},
  });

  console.log("Pulling fixtures + results from football-data.org…");
  const result = await syncFromFootballData();
  console.log(
    `Upserted ${result.teamsUpserted} teams and ${result.matchesUpserted} matches.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
