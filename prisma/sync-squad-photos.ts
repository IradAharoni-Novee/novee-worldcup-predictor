/* eslint-disable no-console */
// Pull WC2026 squads from FIFA's JSON API and write player headshots to
// Player.photo. Run with:
//   pnpm tsx prisma/sync-squad-photos.ts
//
// Thin CLI wrapper around syncSquadPhotosFromFifa() in @/lib/fifa-squad, which
// is also run daily by the cron at /api/cron/sync. Players FIFA hasn't
// published a photo for keep photo=null and render the on-brand initials chip.

import { syncSquadPhotosFromFifa } from "@/lib/fifa-squad";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Syncing squad photos from FIFA…");
  const r = await syncSquadPhotosFromFifa((line) => console.log(`  · ${line}`));

  console.log(`\nSummary`);
  console.log(`  teams in competition:   ${r.teamsTotal}`);
  console.log(`  teams matched in DB:    ${r.teamsMatched}`);
  console.log(`  teams with FIFA photos: ${r.teamsWithPhotos}`);
  console.log(`  FIFA headshots seen:    ${r.headshotsSeen}`);
  console.log(`  Player.photo updates:   ${r.photoUpdates}`);
  console.log(`  players with a photo:   ${r.playersWithPhoto}/${r.playersTotal}`);
  const withoutPhoto = r.playersTotal - r.playersWithPhoto;
  if (withoutPhoto > 0) {
    console.log(
      `  ${withoutPhoto} player(s) have no FIFA photo yet — they render the initials avatar.`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
