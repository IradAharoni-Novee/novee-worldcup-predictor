/* eslint-disable no-console */
// Production seed:
//   - default scoring config in the Setting table
//   - real fixtures, teams, and matches from football-data.org
//   - two AI players (Opus 4.7, GPT 5.5) with full predictions across every
//     prediction type, so the leaderboard always has data.
//
// Idempotent: all writes are upserts. Re-run any time.
//
// Player photos (heavyweight, headless-browser-driven) live in a separate
// script: `pnpm tsx prisma/sync-squad-photos.ts`.

import { Stage, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncFromFootballData } from "@/lib/sync";

const AI_PLAYERS = [
  {
    email: "opus-4.7@novee.security",
    name: "Opus 4.7",
    // Thoughtful, conservative — favors tight scores
    style: "thoughtful" as const,
  },
  {
    email: "gpt-5.5@novee.security",
    name: "GPT 5.5",
    // Bolder — wider range of scorelines, more goals
    style: "bold" as const,
  },
];

type AiStyle = (typeof AI_PLAYERS)[number]["style"];

// Deterministic hash → number in [0,1). Same input always returns the same
// output, so re-running the seed produces identical predictions.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function pickScore(matchId: string, side: "home" | "away", style: AiStyle): number {
  const r = hash(`${matchId}:${side}:${style}`);
  if (style === "thoughtful") {
    // 30% → 0, 40% → 1, 20% → 2, 10% → 3
    if (r < 0.3) return 0;
    if (r < 0.7) return 1;
    if (r < 0.9) return 2;
    return 3;
  }
  // bold: more goals
  // 15% → 0, 25% → 1, 30% → 2, 20% → 3, 8% → 4, 2% → 5
  if (r < 0.15) return 0;
  if (r < 0.4) return 1;
  if (r < 0.7) return 2;
  if (r < 0.9) return 3;
  if (r < 0.98) return 4;
  return 5;
}

// A model's "perceived strength" of a team — deterministic per (model, team).
function teamStrength(modelName: string, teamId: string): number {
  return hash(`${modelName}:strength:${teamId}`);
}

async function seedAiMatchPredictions(
  userId: string,
  style: AiStyle,
  matchIds: string[]
) {
  for (const matchId of matchIds) {
    const homeScore = pickScore(matchId, "home", style);
    const awayScore = pickScore(matchId, "away", style);
    await prisma.prediction.upsert({
      where: { userId_matchId: { userId, matchId } },
      create: { userId, matchId, homeScore, awayScore },
      update: { homeScore, awayScore },
    });
  }
}

async function seedAiGroupPredictions(
  userId: string,
  modelName: string,
  groupsToTeams: Map<string, { id: string }[]>
) {
  for (const [group, teams] of groupsToTeams) {
    if (teams.length < 4) continue;
    const ranked = [...teams].sort(
      (a, b) => teamStrength(modelName, b.id) - teamStrength(modelName, a.id)
    );
    await prisma.groupPrediction.upsert({
      where: { userId_group: { userId, group } },
      create: {
        userId,
        group,
        team1stId: ranked[0]!.id,
        team2ndId: ranked[1]!.id,
        team3rdId: ranked[2]!.id,
        team4thId: ranked[3]!.id,
      },
      update: {
        team1stId: ranked[0]!.id,
        team2ndId: ranked[1]!.id,
        team3rdId: ranked[2]!.id,
        team4thId: ranked[3]!.id,
      },
    });
  }
}

async function seedAiBracket(
  userId: string,
  modelName: string,
  allTeams: { id: string }[]
) {
  const ranked = [...allTeams].sort(
    (a, b) => teamStrength(modelName, b.id) - teamStrength(modelName, a.id)
  );

  const picks: Prisma.BracketPickCreateManyInput[] = [];
  const push = (round: Stage, slot: number, teamIndex: number) => {
    const team = ranked[teamIndex];
    if (!team) return;
    picks.push({ userId, round, slot, teamId: team.id });
  };

  // R32: top 16 teams (one per slot, all different to satisfy the no-duplicates
  // constraint within a round)
  for (let i = 0; i < 16; i++) push(Stage.R32, i, i);
  for (let i = 0; i < 8; i++) push(Stage.R16, i, i);
  for (let i = 0; i < 4; i++) push(Stage.QF, i, i);
  for (let i = 0; i < 2; i++) push(Stage.SF, i, i);
  push(Stage.FINAL, 0, 0); // top team wins it all
  push(Stage.THIRD, 0, 2); // 3rd-strongest team takes bronze

  await prisma.bracketPick.deleteMany({ where: { userId } });
  await prisma.bracketPick.createMany({ data: picks });
}

async function seedAiAwards(
  userId: string,
  modelName: string,
  allTeams: { id: string }[],
  candidatePlayers: { id: string }[]
) {
  const rankedTeams = [...allTeams].sort(
    (a, b) => teamStrength(modelName, b.id) - teamStrength(modelName, a.id)
  );
  await prisma.tournamentWinnerPrediction.upsert({
    where: { userId },
    create: { userId, teamId: rankedTeams[0]!.id },
    update: { teamId: rankedTeams[0]!.id },
  });

  if (candidatePlayers.length > 0) {
    const rankedPlayers = [...candidatePlayers].sort(
      (a, b) => teamStrength(modelName, b.id) - teamStrength(modelName, a.id)
    );
    await prisma.goldenBootPrediction.upsert({
      where: { userId },
      create: { userId, playerId: rankedPlayers[0]!.id },
      update: { playerId: rankedPlayers[0]!.id },
    });
  }
}

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
    `  → upserted ${result.teamsUpserted} teams and ${result.matchesUpserted} matches`
  );

  // Reference data for AI predictions.
  const matches = await prisma.match.findMany({
    select: { id: true, group: true, homeTeamId: true, awayTeamId: true },
  });
  const teams = await prisma.team.findMany({ select: { id: true } });
  const players = await prisma.player.findMany({
    where: { position: { in: ["Offence", "Midfield"] } },
    select: { id: true },
  });

  const groupsToTeams = new Map<string, { id: string }[]>();
  for (const m of matches) {
    if (!m.group) continue;
    const list = groupsToTeams.get(m.group) ?? [];
    const seen = new Set(list.map((t) => t.id));
    if (m.homeTeamId && !seen.has(m.homeTeamId)) list.push({ id: m.homeTeamId });
    if (m.awayTeamId && !seen.has(m.awayTeamId)) list.push({ id: m.awayTeamId });
    groupsToTeams.set(m.group, list);
  }

  for (const ai of AI_PLAYERS) {
    console.log(`\nSeeding AI player ${ai.name} (${ai.email})…`);
    const user = await prisma.user.upsert({
      where: { email: ai.email },
      create: {
        email: ai.email,
        name: ai.name,
        isAdmin: false,
        emailVerified: new Date(),
      },
      update: { name: ai.name },
    });

    await seedAiMatchPredictions(
      user.id,
      ai.style,
      matches.map((m) => m.id)
    );
    console.log(`  · ${matches.length} match predictions`);

    await seedAiGroupPredictions(user.id, ai.name, groupsToTeams);
    console.log(`  · ${groupsToTeams.size} group predictions`);

    await seedAiBracket(user.id, ai.name, teams);
    console.log(`  · bracket: 32 picks across all knockout rounds`);

    await seedAiAwards(user.id, ai.name, teams, players);
    console.log(
      `  · tournament winner + golden-boot pick${
        players.length === 0 ? " (no players in DB, golden-boot skipped)" : ""
      }`
    );
  }

  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
