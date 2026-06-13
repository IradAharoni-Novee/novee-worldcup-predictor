/* eslint-disable no-console */
// Production seed:
//   - default scoring config in the Setting table
//   - real fixtures, teams, and matches from football-data.org
//   - four seeded non-human players whose predictions reflect their identity:
//       · Opus 4.8         → calls anthropic/claude-opus-4-8 via Vercel AI Gateway
//       · GPT 5.5          → calls openai/gpt-5.5 via Vercel AI Gateway
//       · Gemini 3.5 Flash → calls google/gemini-3.5-flash via Vercel AI Gateway
//       · VeeVee's Cousin  → rule: 0-0 on every match, no other picks
//   Each gets a brand-mark avatar rendered to PNG and uploaded to Vercel Blob,
//   stored as User.image so they're treated like any other user downstream.
//
// Idempotent at the schema/upsert level, but the LLM-generated values will
// drift across runs. Set AI_GATEWAY_API_KEY and BLOB_READ_WRITE_TOKEN before
// invoking (`vercel env pull` pulls both into .env.local). Without either, the
// seed fails fast.
//
// Player photos are pulled from FIFA's squad API by a separate script:
// `pnpm tsx prisma/sync-squad-photos.ts`.

import { Stage, type Prisma } from "@prisma/client";
import { generateObject } from "ai";
import { z } from "zod";
import { renderAndUploadAiAvatar } from "@/lib/ai-avatar-upload";
import { AI_PLAYER_EMAILS, AI_PLAYER_MODEL_IDS } from "@/lib/ai-players";
import { prisma } from "@/lib/prisma";
import { syncFromFootballData } from "@/lib/sync";

type LlmPlayer = {
  email: string;
  name: string;
  kind: "opus" | "gpt" | "gemini";
  modelId: string;
};

const LLM_PLAYERS: LlmPlayer[] = [
  {
    email: AI_PLAYER_EMAILS.opus,
    name: "Opus 4.8",
    kind: "opus",
    modelId: AI_PLAYER_MODEL_IDS.opus,
  },
  {
    email: AI_PLAYER_EMAILS.gpt,
    name: "GPT 5.5",
    kind: "gpt",
    modelId: AI_PLAYER_MODEL_IDS.gpt,
  },
  {
    email: AI_PLAYER_EMAILS.gemini,
    name: "Gemini 3.5 Flash",
    kind: "gemini",
    modelId: AI_PLAYER_MODEL_IDS.gemini,
  },
];

const COUSIN_EMAIL = AI_PLAYER_EMAILS.cousin;
const COUSIN_NAME = "VeeVee's Cousin";

type MatchRow = {
  id: string;
  stage: Stage;
  group: string | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
};

type TeamRow = { id: string; name: string; code: string };
type PlayerRow = {
  id: string;
  name: string;
  position: string | null;
  team: { name: string } | null;
};

// ── AI generation ────────────────────────────────────────────────────────

function tournamentContext(): string {
  return [
    "You are predicting the FIFA World Cup 2026, jointly hosted by the USA,",
    "Canada, and Mexico. The format expands to 48 teams: 12 groups of 4, with",
    "the top 2 from each group plus the 8 best third-placed teams advancing",
    "to a 32-team knockout (R32 → R16 → QF → SF → Final, with a third-place",
    "playoff). Use your knowledge of squads, recent form, and qualifying.",
  ].join(" ");
}

// All AI prompts use index-based addressing: we present items numbered 1..N
// and ask the model to refer to those numbers. We then map indexes back to
// real cuids on our side. This eliminates an entire class of LLM failures
// where the model would copy/typo a 24-char cuid wrong.

const MatchScoresSchema = z.object({
  predictions: z.array(
    z.object({
      n: z.number().int().min(1),
      homeScore: z.number().int().min(0).max(15),
      awayScore: z.number().int().min(0).max(15),
    })
  ),
});

async function aiPredictMatches(
  modelId: string,
  playableMatches: MatchRow[]
): Promise<Map<string, { homeScore: number; awayScore: number }>> {
  const lines = playableMatches.map((m, i) => {
    const home = m.homeTeam?.name ?? "TBD";
    const away = m.awayTeam?.name ?? "TBD";
    const ctx = m.stage === "GROUP" ? `Group ${m.group ?? "?"}` : m.stage;
    return `${i + 1}. ${home} vs ${away} (${ctx})`;
  });

  const { object } = await generateObject({
    model: modelId,
    schema: MatchScoresSchema,
    prompt: [
      tournamentContext(),
      "",
      "Predict the final score of every numbered match below. For group-stage",
      "matches, report the regulation-time score. For knockout matches that",
      "would go to extra time or penalties, report the score after extra time",
      "with the side you predict to advance scoring more goals — never a draw.",
      "",
      `Return one prediction per match (${playableMatches.length} total).`,
      'Use the "n" field to refer to the match number shown.',
      "",
      "Matches:",
      ...lines,
    ].join("\n"),
  });

  const byId = new Map<string, { homeScore: number; awayScore: number }>();
  for (const p of object.predictions) {
    const match = playableMatches[p.n - 1];
    if (!match) continue;
    byId.set(match.id, { homeScore: p.homeScore, awayScore: p.awayScore });
  }
  for (const m of playableMatches) {
    if (!byId.has(m.id)) {
      throw new Error(
        `AI player (${modelId}) missed at least one match. Got ${object.predictions.length} predictions for ${playableMatches.length} matches.`
      );
    }
  }
  return byId;
}

const GroupRankingsSchema = z.object({
  groups: z.array(
    z.object({
      group: z.string(),
      ranking: z.array(z.number().int().min(1).max(4)).length(4),
    })
  ),
});

async function aiPredictGroups(
  modelId: string,
  groupsToTeams: Map<string, TeamRow[]>
): Promise<Map<string, { first: string; second: string; third: string; fourth: string }>> {
  const groupsList = [...groupsToTeams.entries()]
    .filter(([, teams]) => teams.length >= 4)
    .sort(([a], [b]) => a.localeCompare(b));

  const blocks = groupsList.map(([group, teams]) => {
    const roster = teams
      .map((t, i) => `  ${i + 1}. ${t.name} (${t.code})`)
      .join("\n");
    return `Group ${group}:\n${roster}`;
  });

  const { object } = await generateObject({
    model: modelId,
    schema: GroupRankingsSchema,
    prompt: [
      tournamentContext(),
      "",
      "For each group below, predict the final standings (1st → 4th) based on",
      "points, then head-to-head and goal difference.",
      "",
      'Each "ranking" is an array of 4 numbers referring to teams in that',
      "group — first place first, fourth place last. The numbers are local to",
      "the group (1–4 for each).",
      "",
      ...blocks,
    ].join("\n\n"),
  });

  const result = new Map<
    string,
    { first: string; second: string; third: string; fourth: string }
  >();
  for (const g of object.groups) {
    // Some models echo back "Group A" / "group a" instead of just "A".
    const normalized = g.group.replace(/^group\s+/i, "").trim().toUpperCase();
    const teams = groupsToTeams.get(normalized);
    if (!teams) continue;
    if (new Set(g.ranking).size !== 4) {
      throw new Error(
        `AI player (${modelId}) returned duplicate positions in group ${normalized}.`
      );
    }
    const ids = g.ranking.map((n) => teams[n - 1]?.id);
    if (ids.some((id) => !id)) {
      throw new Error(
        `AI player (${modelId}) returned an out-of-range team number in group ${normalized}.`
      );
    }
    result.set(normalized, {
      first: ids[0]!,
      second: ids[1]!,
      third: ids[2]!,
      fourth: ids[3]!,
    });
  }
  for (const [group] of groupsList) {
    if (!result.has(group)) {
      throw new Error(`AI player (${modelId}) skipped group ${group}.`);
    }
  }
  return result;
}

const TournamentRankingSchema = z.object({
  ranking: z.array(z.number().int().min(1)),
});

async function aiRankTeams(
  modelId: string,
  teams: TeamRow[]
): Promise<string[]> {
  const roster = teams
    .map((t, i) => `${i + 1}. ${t.name} (${t.code})`)
    .join("\n");

  const { object } = await generateObject({
    model: modelId,
    schema: TournamentRankingSchema,
    prompt: [
      tournamentContext(),
      "",
      "Rank every team below from strongest to weakest in terms of how far you",
      "expect them to advance in this tournament. The team you list first is",
      "your predicted champion; ties are broken by your subjective confidence.",
      "",
      "Return the team numbers in order — strongest first, weakest last.",
      `Include all ${teams.length} teams exactly once.`,
      "",
      `Teams (${teams.length}):`,
      roster,
    ].join("\n"),
  });

  const seen = new Set<number>();
  const ranked: string[] = [];
  for (const n of object.ranking) {
    if (n < 1 || n > teams.length || seen.has(n)) continue;
    seen.add(n);
    ranked.push(teams[n - 1]!.id);
  }
  // Append any teams the model omitted so downstream slot indexing has all IDs.
  for (let i = 0; i < teams.length; i++) {
    if (!seen.has(i + 1)) ranked.push(teams[i]!.id);
  }
  return ranked;
}

const GoldenBootSchema = z.object({
  n: z.number().int().min(1),
});

async function aiPickGoldenBoot(
  modelId: string,
  candidates: PlayerRow[]
): Promise<string | null> {
  if (candidates.length === 0) return null;

  const roster = candidates
    .map((p, i) => {
      const team = p.team?.name ?? "Unknown";
      const pos = p.position ?? "?";
      return `${i + 1}. ${p.name} (${team}, ${pos})`;
    })
    .join("\n");

  const { object } = await generateObject({
    model: modelId,
    schema: GoldenBootSchema,
    prompt: [
      tournamentContext(),
      "",
      "Pick the single player you predict will win the Golden Boot (top scorer",
      'of the tournament). Return only the player number in the "n" field.',
      "",
      "Candidates:",
      roster,
    ].join("\n"),
  });

  const picked = candidates[object.n - 1];
  if (!picked) {
    throw new Error(
      `AI player (${modelId}) returned out-of-range player number ${object.n} for Golden Boot.`
    );
  }
  return picked.id;
}

// ── DB writes ────────────────────────────────────────────────────────────

async function writeMatchPredictions(
  userId: string,
  scoresByMatchId: Map<string, { homeScore: number; awayScore: number }>
) {
  // Wipe any prior predictions so re-seeds don't leave stale rows from earlier
  // seed runs (e.g. matches that have since become unplayable, or values from
  // the old hash-based seed).
  await prisma.prediction.deleteMany({ where: { userId } });
  await prisma.prediction.createMany({
    data: [...scoresByMatchId].map(([matchId, score]) => ({
      userId,
      matchId,
      ...score,
    })),
  });
}

async function writeGroupPredictions(
  userId: string,
  rankings: Map<string, { first: string; second: string; third: string; fourth: string }>
) {
  for (const [group, picks] of rankings) {
    await prisma.groupPrediction.upsert({
      where: { userId_group: { userId, group } },
      create: {
        userId,
        group,
        team1stId: picks.first,
        team2ndId: picks.second,
        team3rdId: picks.third,
        team4thId: picks.fourth,
      },
      update: {
        team1stId: picks.first,
        team2ndId: picks.second,
        team3rdId: picks.third,
        team4thId: picks.fourth,
      },
    });
  }
}

async function writeBracket(userId: string, rankedTeamIds: string[]) {
  const picks: Prisma.BracketPickCreateManyInput[] = [];
  const push = (round: Stage, slot: number, teamIndex: number) => {
    const teamId = rankedTeamIds[teamIndex];
    if (!teamId) return;
    picks.push({ userId, round, slot, teamId });
  };

  for (let i = 0; i < 16; i++) push(Stage.R32, i, i);
  for (let i = 0; i < 8; i++) push(Stage.R16, i, i);
  for (let i = 0; i < 4; i++) push(Stage.QF, i, i);
  for (let i = 0; i < 2; i++) push(Stage.SF, i, i);
  push(Stage.FINAL, 0, 0);
  push(Stage.THIRD, 0, 2);

  await prisma.bracketPick.deleteMany({ where: { userId } });
  await prisma.bracketPick.createMany({ data: picks });
}

async function writeAwards(
  userId: string,
  winnerTeamId: string,
  goldenBootPlayerId: string | null
) {
  await prisma.tournamentWinnerPrediction.upsert({
    where: { userId },
    create: { userId, teamId: winnerTeamId },
    update: { teamId: winnerTeamId },
  });

  if (goldenBootPlayerId) {
    await prisma.goldenBootPrediction.upsert({
      where: { userId },
      create: { userId, playerId: goldenBootPlayerId },
      update: { playerId: goldenBootPlayerId },
    });
  }
}

// ── Players ──────────────────────────────────────────────────────────────

async function upsertUser(email: string, name: string, image: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, image, isAdmin: false, emailVerified: new Date() },
    update: { name, image },
  });
}

async function seedLlmPlayer(
  player: LlmPlayer,
  matches: MatchRow[],
  teams: TeamRow[],
  groupsToTeams: Map<string, TeamRow[]>,
  goldenBootCandidates: PlayerRow[]
) {
  console.log(`\nSeeding ${player.name} via ${player.modelId}…`);
  console.log("  · uploading avatar to Vercel Blob…");
  const image = await renderAndUploadAiAvatar(player.email);
  const user = await upsertUser(player.email, player.name, image);

  console.log("  · predicting match scores…");
  const scores = await aiPredictMatches(player.modelId, matches);
  await writeMatchPredictions(user.id, scores);
  console.log(`    ✓ ${scores.size} match scores`);

  console.log("  · predicting group standings…");
  const groups = await aiPredictGroups(player.modelId, groupsToTeams);
  await writeGroupPredictions(user.id, groups);
  console.log(`    ✓ ${groups.size} groups`);

  console.log("  · ranking the field for bracket + winner…");
  const ranking = await aiRankTeams(player.modelId, teams);
  await writeBracket(user.id, ranking);
  console.log(`    ✓ bracket filled across all knockout rounds`);

  console.log("  · picking Golden Boot…");
  const gb = await aiPickGoldenBoot(player.modelId, goldenBootCandidates);
  await writeAwards(user.id, ranking[0]!, gb);
  const gbNote = gb ? "Golden Boot pick saved" : "(no players in DB — skipped Golden Boot)";
  console.log(`    ✓ tournament winner + ${gbNote}`);
}

async function seedCousin(allMatches: MatchRow[]) {
  console.log(`\nSeeding ${COUSIN_NAME} (rule: 0-0 on every match)…`);
  const image = await renderAndUploadAiAvatar(COUSIN_EMAIL);
  const user = await upsertUser(COUSIN_EMAIL, COUSIN_NAME, image);

  // The 0-0 rule applies to every match — even knockout slots whose teams are
  // still TBD. The cousin's whole gimmick is being right whenever a match
  // actually ends 0-0, regardless of seeding.
  const scores = new Map<string, { homeScore: number; awayScore: number }>();
  for (const m of allMatches) scores.set(m.id, { homeScore: 0, awayScore: 0 });
  await writeMatchPredictions(user.id, scores);
  console.log(`  · ${scores.size} match predictions (all 0-0)`);

  // The 0-0 rule is per-match. The cousin has no rule for group/bracket/awards
  // surfaces, so don't fabricate picks — wipe any stale ones from prior seeds.
  const purged = await Promise.all([
    prisma.groupPrediction.deleteMany({ where: { userId: user.id } }),
    prisma.bracketPick.deleteMany({ where: { userId: user.id } }),
    prisma.tournamentWinnerPrediction.deleteMany({ where: { userId: user.id } }),
    prisma.goldenBootPrediction.deleteMany({ where: { userId: user.id } }),
  ]);
  const totalPurged = purged.reduce((sum, r) => sum + r.count, 0);
  if (totalPurged > 0) {
    console.log(`  · cleared ${totalPurged} legacy non-match picks`);
  }
}

// ── Entrypoint ───────────────────────────────────────────────────────────

async function main() {
  const hasGatewayAuth =
    !!process.env.AI_GATEWAY_API_KEY || !!process.env.VERCEL_OIDC_TOKEN;
  if (LLM_PLAYERS.length > 0 && !hasGatewayAuth) {
    throw new Error(
      "No Vercel AI Gateway credentials found. The Opus 4.8, GPT 5.5, and " +
        "Gemini 3.5 Flash seeded players call their models through the gateway, " +
        "which needs either " +
        "AI_GATEWAY_API_KEY or a fresh VERCEL_OIDC_TOKEN. Run `vercel env pull` " +
        "(writes a short-lived OIDC token to .env.local) before re-running the seed."
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. The seeded AI players upload their " +
        "brand-mark avatars to Vercel Blob. Run `vercel env pull` to fetch it."
    );
  }

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

  const matches: MatchRow[] = await prisma.match.findMany({
    select: {
      id: true,
      stage: true,
      group: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });
  const playableMatches = matches.filter(
    (m) => m.homeTeam !== null && m.awayTeam !== null
  );

  const teams: TeamRow[] = await prisma.team.findMany({
    select: { id: true, name: true, code: true },
  });

  const goldenBootCandidates: PlayerRow[] = await prisma.player.findMany({
    where: { position: { in: ["Offence", "Midfield"] } },
    select: {
      id: true,
      name: true,
      position: true,
      team: { select: { name: true } },
    },
  });

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const groupsToTeams = new Map<string, TeamRow[]>();
  for (const m of matches) {
    if (!m.group) continue;
    const list = groupsToTeams.get(m.group) ?? [];
    const seen = new Set(list.map((t) => t.id));
    if (m.homeTeam && !seen.has(m.homeTeam.id)) {
      const t = teamById.get(m.homeTeam.id);
      if (t) list.push(t);
    }
    if (m.awayTeam && !seen.has(m.awayTeam.id)) {
      const t = teamById.get(m.awayTeam.id);
      if (t) list.push(t);
    }
    groupsToTeams.set(m.group, list);
  }

  for (const player of LLM_PLAYERS) {
    await seedLlmPlayer(
      player,
      playableMatches,
      teams,
      groupsToTeams,
      goldenBootCandidates
    );
  }

  await seedCousin(matches);

  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
