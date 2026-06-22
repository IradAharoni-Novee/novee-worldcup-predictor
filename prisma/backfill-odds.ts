/* eslint-disable no-console */
// One-shot: price every played match that has no stored odds, using the-odds-api
// historical (closing) snapshot at kickoff − 5min. Reconciles each event to a DB
// match by team name + kickoff minute and writes the averaged 1/X/2 decimal odds.
// Run with: pnpm backfill-odds
//
// Re-running is safe (priced matches drop out via the oddsHome: null filter), but
// a match that never reconciles stays null and is retried every run — re-fetching,
// and re-charging ~10 credits for, its kickoff−5min snapshot. Run sparingly.

import { fetchHistoricalOdds, type OddsEvent } from "@/lib/odds-api";
import { pickByTeamsAtMinute } from "@/lib/match-reconcile";
import { prisma } from "@/lib/prisma";

// Closing-odds snapshot: 5 minutes before kickoff.
function snapshotFor(kickoff: Date): string {
  return new Date(kickoff.getTime() - 5 * 60 * 1000).toISOString();
}

// Fetch a snapshot once per distinct timestamp; simultaneous kickoffs reuse it.
async function getSnapshot(
  cache: Map<string, OddsEvent[]>,
  snapshot: string
): Promise<OddsEvent[]> {
  const cached = cache.get(snapshot);
  if (cached) return cached;
  const events = await fetchHistoricalOdds(snapshot);
  cache.set(snapshot, events);
  return events;
}

async function main() {
  if (!process.env.ODDS_API_KEY) {
    console.error("ODDS_API_KEY is not set in .env");
    process.exit(1);
  }

  const now = new Date();
  const matches = await prisma.match.findMany({
    where: { oddsHome: null, kickoff: { lte: now } },
    select: {
      id: true,
      kickoff: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  console.log(`Backfilling odds for ${matches.length} played, un-priced matches…\n`);

  const cache = new Map<string, OddsEvent[]>();
  let matched = 0;
  let unmatched = 0;
  for (const m of matches) {
    const homeName = m.homeTeam?.name ?? "";
    const awayName = m.awayTeam?.name ?? "";
    const label = `${homeName} vs ${awayName}`;
    const snapshot = snapshotFor(m.kickoff);
    const events = await getSnapshot(cache, snapshot);
    const chosen = pickByTeamsAtMinute({ homeName, awayName, kickoff: m.kickoff }, events);
    if (!chosen) {
      console.log(`  · ${label}  — no odds event matched`);
      unmatched++;
      continue;
    }
    await prisma.match.update({
      where: { id: m.id },
      data: {
        oddsHome: chosen.odds.home,
        oddsDraw: chosen.odds.draw,
        oddsAway: chosen.odds.away,
        oddsUpdatedAt: new Date(),
      },
    });
    console.log(
      `  ✓ ${label}  — H ${chosen.odds.home.toFixed(2)} / ` +
        `D ${chosen.odds.draw.toFixed(2)} / A ${chosen.odds.away.toFixed(2)}`
    );
    matched++;
  }

  console.log(
    `\nDone. ${matched} priced, ${unmatched} unmatched, ` +
      `${cache.size} snapshot(s) fetched.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
