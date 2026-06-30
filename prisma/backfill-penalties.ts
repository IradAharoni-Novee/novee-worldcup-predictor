/* eslint-disable no-console */
/**
 * One-off backfill for Match.penaltyHome / penaltyAway on knockout matches that
 * were decided on penalties before those columns existed. Pulls the shootout
 * score from API-Football (`score.penalty`) and writes it for any finished
 * knockout whose 120' score is level and whose penalties aren't recorded yet.
 *
 * Run with: pnpm exec tsx prisma/backfill-penalties.ts
 *
 * Idempotent — only touches matches missing a penalty score. From then on the
 * per-minute live sync records penalties as each shootout finishes.
 *
 * Orientation: API-Football and football-data.org agree on the home/away side
 * (both use FIFA's designation), and the live sync already maps fixture home →
 * our home, so the shootout score carries over in the same orientation.
 */
import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWorldCupFixturesByDate } from "@/lib/api-football";
import { pickFixture } from "@/lib/sync";
import { isKnockout } from "@/lib/scoring";

async function main(): Promise<void> {
  const finished = await prisma.match.findMany({
    where: {
      status: MatchStatus.FINISHED,
      penaltyHome: null,
      homeScore: { not: null },
    },
    select: {
      id: true,
      stage: true,
      kickoff: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  // A shootout only happens in a knockout whose 120' score is level.
  const shootouts = finished.filter(
    (m) => isKnockout(m.stage) && m.homeScore === m.awayScore
  );
  if (shootouts.length === 0) {
    console.log("No knockout matches awaiting a penalty score.");
    return;
  }

  const dates = new Set(shootouts.map((m) => m.kickoff.toISOString().slice(0, 10)));
  const fixtures = (
    await Promise.all([...dates].map(fetchWorldCupFixturesByDate))
  ).flat();

  let updated = 0;
  for (const m of shootouts) {
    const fixture = pickFixture(
      {
        homeName: m.homeTeam?.name ?? "",
        awayName: m.awayTeam?.name ?? "",
        kickoff: m.kickoff,
      },
      fixtures
    );
    if (!fixture || fixture.penaltyHome == null || fixture.penaltyAway == null) {
      console.log(
        `No shootout score for ${m.homeTeam?.name} vs ${m.awayTeam?.name} — skipping`
      );
      continue;
    }
    await prisma.match.update({
      where: { id: m.id },
      data: { penaltyHome: fixture.penaltyHome, penaltyAway: fixture.penaltyAway },
    });
    console.log(
      `${m.homeTeam?.name} ${m.homeScore}-${m.awayScore} ${m.awayTeam?.name} → penalties ${fixture.penaltyHome}-${fixture.penaltyAway}`
    );
    updated += 1;
  }
  console.log(`Backfilled penalties for ${updated} match(es).`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
