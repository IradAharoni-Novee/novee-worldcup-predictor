/* eslint-disable no-console */
/**
 * Results catch-up from football-data.org. The per-minute live sync only
 * revisits matches that aren't FINISHED yet, so an outage can leave finished
 * matches with stale scores it will never correct. This runs the structural
 * sync, then writes score, penalties, status, and knockout advancer for every
 * FINISHED FD match the DB disagrees with, logging each change.
 *
 * Run with: pnpm exec tsx prisma/backfill-results-from-fd.ts
 *
 * Idempotent — a second run finds nothing to change.
 */
import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWorldCupMatches } from "@/lib/football-data";
import { fdResult, syncFromFootballData } from "@/lib/sync";
import { isKnockout } from "@/lib/scoring";

async function main(): Promise<void> {
  const structure = await syncFromFootballData();
  console.log(
    `Structure sync: ${structure.teamsUpserted} teams, ${structure.matchesUpserted} matches upserted.`
  );

  const fdMatches = await fetchWorldCupMatches();
  const ours = await prisma.match.findMany({
    select: {
      id: true,
      fdId: true,
      stage: true,
      status: true,
      homeScore: true,
      awayScore: true,
      penaltyHome: true,
      penaltyAway: true,
      advancingTeamId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  const byFd = new Map(ours.map((m) => [m.fdId, m]));

  let updated = 0;
  for (const fm of fdMatches) {
    if (fm.status !== "FINISHED") continue;
    const m = byFd.get(fm.id);
    if (!m) {
      console.log(`FD match ${fm.id} not in DB — skipping`);
      continue;
    }
    const result = fdResult(fm.score);
    if (!result) {
      console.log(`FD match ${fm.id} finished but score incomplete — skipping`);
      continue;
    }

    // Keep the existing advancer unless FD names a winner we can map; never
    // downgrade a set advancer to null over a missing team mapping.
    let advancer = m.advancingTeamId;
    if (isKnockout(m.stage)) {
      const winnerId =
        fm.score.winner === "HOME_TEAM"
          ? m.homeTeamId
          : fm.score.winner === "AWAY_TEAM"
            ? m.awayTeamId
            : null;
      if (winnerId != null) {
        advancer = winnerId;
      } else {
        console.log(
          `FD match ${fm.id}: winner ${fm.score.winner} has no mapped team — keeping existing advancer`
        );
      }
    }

    const changes: {
      homeScore?: number;
      awayScore?: number;
      penaltyHome?: number | null;
      penaltyAway?: number | null;
      status?: MatchStatus;
      advancingTeamId?: string | null;
    } = {};
    if (m.homeScore !== result.homeScore) changes.homeScore = result.homeScore;
    if (m.awayScore !== result.awayScore) changes.awayScore = result.awayScore;
    if (m.penaltyHome !== result.penaltyHome) changes.penaltyHome = result.penaltyHome;
    if (m.penaltyAway !== result.penaltyAway) changes.penaltyAway = result.penaltyAway;
    if (m.status !== MatchStatus.FINISHED) changes.status = MatchStatus.FINISHED;
    if (m.advancingTeamId !== advancer) changes.advancingTeamId = advancer;
    if (Object.keys(changes).length === 0) continue;

    await prisma.match.update({ where: { id: m.id }, data: changes });
    const pens =
      result.penaltyHome != null ? ` (pens ${result.penaltyHome}-${result.penaltyAway})` : "";
    console.log(
      `${m.homeTeam?.name ?? "?"} ${result.homeScore}-${result.awayScore} ${m.awayTeam?.name ?? "?"}${pens} [${m.stage}] ← ${Object.keys(changes).join(", ")}`
    );
    updated += 1;
  }

  console.log(`Updated ${updated} match(es).`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
