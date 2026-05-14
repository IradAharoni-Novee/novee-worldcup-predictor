/* eslint-disable no-console */
// Dev-only sample data: a handful of teams + matches across stages so the
// UI has something to render without a football-data.org token.

import { Stage, MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TEAMS = [
  { fdId: 770, name: "England", code: "ENG", flag: "https://flagcdn.com/w80/gb-eng.png" },
  { fdId: 771, name: "France", code: "FRA", flag: "https://flagcdn.com/w80/fr.png" },
  { fdId: 772, name: "Germany", code: "GER", flag: "https://flagcdn.com/w80/de.png" },
  { fdId: 773, name: "Brazil", code: "BRA", flag: "https://flagcdn.com/w80/br.png" },
  { fdId: 774, name: "Argentina", code: "ARG", flag: "https://flagcdn.com/w80/ar.png" },
  { fdId: 775, name: "Spain", code: "ESP", flag: "https://flagcdn.com/w80/es.png" },
  { fdId: 776, name: "Netherlands", code: "NED", flag: "https://flagcdn.com/w80/nl.png" },
  { fdId: 777, name: "Portugal", code: "POR", flag: "https://flagcdn.com/w80/pt.png" },
  { fdId: 778, name: "Belgium", code: "BEL", flag: "https://flagcdn.com/w80/be.png" },
  { fdId: 779, name: "Croatia", code: "CRO", flag: "https://flagcdn.com/w80/hr.png" },
  { fdId: 780, name: "USA", code: "USA", flag: "https://flagcdn.com/w80/us.png" },
  { fdId: 781, name: "Mexico", code: "MEX", flag: "https://flagcdn.com/w80/mx.png" },
];

type Fixture = {
  fdId: number;
  stage: Stage;
  group: string | null;
  daysFromNow: number;
  hoursFromNow?: number;
  home: string;
  away: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: MatchStatus;
};

const FIXTURES: Fixture[] = [
  // Finished group matches
  { fdId: 9001, stage: Stage.GROUP, group: "A", daysFromNow: -5, home: "ENG", away: "USA", homeScore: 2, awayScore: 1, status: MatchStatus.FINISHED },
  { fdId: 9002, stage: Stage.GROUP, group: "B", daysFromNow: -4, home: "FRA", away: "MEX", homeScore: 3, awayScore: 0, status: MatchStatus.FINISHED },
  { fdId: 9003, stage: Stage.GROUP, group: "C", daysFromNow: -3, home: "GER", away: "BRA", homeScore: 1, awayScore: 1, status: MatchStatus.FINISHED },
  { fdId: 9004, stage: Stage.GROUP, group: "D", daysFromNow: -2, home: "ARG", away: "ESP", homeScore: 2, awayScore: 2, status: MatchStatus.FINISHED },
  // Live
  { fdId: 9005, stage: Stage.GROUP, group: "A", daysFromNow: 0, hoursFromNow: -1, home: "NED", away: "POR", homeScore: 1, awayScore: 0, status: MatchStatus.LIVE },
  // Upcoming today + this week
  { fdId: 9006, stage: Stage.GROUP, group: "B", daysFromNow: 0, hoursFromNow: 3, home: "BEL", away: "CRO", status: MatchStatus.SCHEDULED },
  { fdId: 9007, stage: Stage.GROUP, group: "C", daysFromNow: 1, home: "ENG", away: "FRA", status: MatchStatus.SCHEDULED },
  { fdId: 9008, stage: Stage.GROUP, group: "D", daysFromNow: 2, home: "GER", away: "ARG", status: MatchStatus.SCHEDULED },
  { fdId: 9009, stage: Stage.GROUP, group: "A", daysFromNow: 3, home: "BRA", away: "ESP", status: MatchStatus.SCHEDULED },
  // Knockouts (still TBD-or-named)
  { fdId: 9010, stage: Stage.R16, group: null, daysFromNow: 10, home: "ENG", away: "MEX", status: MatchStatus.SCHEDULED },
  { fdId: 9011, stage: Stage.R16, group: null, daysFromNow: 10, hoursFromNow: 4, home: "FRA", away: "NED", status: MatchStatus.SCHEDULED },
  { fdId: 9012, stage: Stage.QF, group: null, daysFromNow: 15, home: "BRA", away: "ARG", status: MatchStatus.SCHEDULED },
  { fdId: 9013, stage: Stage.SF, group: null, daysFromNow: 20, home: "FRA", away: "ENG", status: MatchStatus.SCHEDULED },
  { fdId: 9014, stage: Stage.FINAL, group: null, daysFromNow: 25, home: "BRA", away: "FRA", status: MatchStatus.SCHEDULED },
];

const USERS = [
  { email: "you@novee.security", name: "You", isAdmin: true },
  { email: "alice@novee.security", name: "Alice", isAdmin: false },
  { email: "bob@novee.security", name: "Bob", isAdmin: false },
];

// Sample predictions for the finished matches so the leaderboard has data
const PREDICTIONS: Record<string, Record<number, [number, number]>> = {
  "you@novee.security": {
    9001: [2, 1], // exact: 3
    9002: [2, 0], // outcome: 1
    9003: [1, 1], // exact: 3
    9004: [1, 0], // wrong: 0
  },
  "alice@novee.security": {
    9001: [1, 0], // outcome: 1
    9002: [3, 0], // exact: 3
    9003: [2, 2], // exact: 3
    9004: [2, 2], // exact: 3
  },
  "bob@novee.security": {
    9001: [0, 2], // wrong: 0
    9002: [1, 1], // wrong: 0
    9003: [0, 0], // outcome (draw): 1
    9004: [2, 2], // exact: 3
  },
};

function kickoff(daysFromNow: number, hoursFromNow = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(d.getHours() + hoursFromNow, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding scoring config…");
  await prisma.setting.upsert({
    where: { key: "scoring" },
    create: {
      key: "scoring",
      value: { exactScore: 3, correctOutcome: 1, knockoutMultiplier: 2 },
    },
    update: {},
  });

  console.log("Seeding teams…");
  for (const t of TEAMS) {
    await prisma.team.upsert({
      where: { fdId: t.fdId },
      create: t,
      update: t,
    });
  }
  const teams = await prisma.team.findMany();
  const idByCode = new Map(teams.map((t) => [t.code, t.id]));

  console.log("Seeding matches…");
  for (const f of FIXTURES) {
    await prisma.match.upsert({
      where: { fdId: f.fdId },
      create: {
        fdId: f.fdId,
        stage: f.stage,
        group: f.group,
        kickoff: kickoff(f.daysFromNow, f.hoursFromNow ?? 0),
        homeTeamId: idByCode.get(f.home) ?? null,
        awayTeamId: idByCode.get(f.away) ?? null,
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        status: f.status,
      },
      update: {
        stage: f.stage,
        group: f.group,
        kickoff: kickoff(f.daysFromNow, f.hoursFromNow ?? 0),
        homeTeamId: idByCode.get(f.home) ?? null,
        awayTeamId: idByCode.get(f.away) ?? null,
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        status: f.status,
      },
    });
  }

  console.log("Seeding users…");
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, isAdmin: u.isAdmin, emailVerified: new Date() },
      update: { name: u.name, isAdmin: u.isAdmin },
    });
  }

  console.log("Seeding predictions…");
  const users = await prisma.user.findMany();
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));
  const matches = await prisma.match.findMany();
  const matchByFdId = new Map(matches.map((m) => [m.fdId, m.id]));

  for (const [email, picks] of Object.entries(PREDICTIONS)) {
    const userId = userByEmail.get(email);
    if (!userId) continue;
    for (const [fdIdStr, [h, a]] of Object.entries(picks)) {
      const matchId = matchByFdId.get(Number(fdIdStr));
      if (!matchId) continue;
      await prisma.prediction.upsert({
        where: { userId_matchId: { userId, matchId } },
        create: { userId, matchId, homeScore: h, awayScore: a },
        update: { homeScore: h, awayScore: a },
      });
    }
  }

  console.log("\nDone. Local sign-in: open http://localhost:3010/signin and enter you@novee.security");
  console.log("The magic link will be printed in the dev-server console.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
