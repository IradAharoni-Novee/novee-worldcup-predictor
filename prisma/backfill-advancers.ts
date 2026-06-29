/* eslint-disable no-console */
/**
 * One-off backfill for Match.advancingTeamId on knockout matches that finished
 * before the column existed. Pulls the winner (including extra-time and
 * penalty-shootout results) from football-data.org and writes it for any
 * knockout match that doesn't have an advancer yet.
 *
 * Run with: pnpm exec tsx prisma/backfill-advancers.ts
 *
 * Idempotent — it only touches knockout matches where advancingTeamId is null,
 * and the daily sync keeps it current from then on.
 */
import { Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWorldCupMatches } from "@/lib/football-data";

const KNOCKOUT_STAGES: Stage[] = [
  Stage.R32,
  Stage.R16,
  Stage.QF,
  Stage.SF,
  Stage.THIRD,
  Stage.FINAL,
];

async function main(): Promise<void> {
  const fdMatches = await fetchWorldCupMatches();
  const ours = await prisma.match.findMany({
    where: { stage: { in: KNOCKOUT_STAGES }, advancingTeamId: null },
    select: { id: true, fdId: true, homeTeamId: true, awayTeamId: true },
  });
  const byFd = new Map(ours.map((m) => [m.fdId, m]));

  let updated = 0;
  for (const fm of fdMatches) {
    const m = byFd.get(fm.id);
    if (!m) continue;
    const advancingTeamId =
      fm.score.winner === "HOME_TEAM"
        ? m.homeTeamId
        : fm.score.winner === "AWAY_TEAM"
          ? m.awayTeamId
          : null;
    if (!advancingTeamId) continue;
    await prisma.match.update({
      where: { id: m.id },
      data: { advancingTeamId },
    });
    updated += 1;
  }

  console.log(`Backfilled advancingTeamId for ${updated} knockout match(es).`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
