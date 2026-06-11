import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postSlackMessage } from "@/lib/slack";
import {
  buildReminderMessage,
  collectDailyDeadlines,
} from "@/lib/deadline-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// #worldcup in the Novee Slack workspace.
const SLACK_CHANNEL_ID = "C0B9S42B94M";
const APP_URL = "https://noveecuppredictor.world";
// Setting row used to make the cron idempotent within a day (retries,
// manual re-runs).
const LAST_POSTED_KEY = "deadlineReminder:lastPosted";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) return unauthorized();

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);

  const lastPosted = await prisma.setting.findUnique({
    where: { key: LAST_POSTED_KEY },
  });
  if (lastPosted?.value === dateKey) {
    return NextResponse.json({
      ok: true,
      posted: false,
      reason: `already posted on ${dateKey}`,
    });
  }

  const matches = await prisma.match.findMany({
    select: {
      stage: true,
      group: true,
      kickoff: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  const deadlines = collectDailyDeadlines(
    matches.map((m) => ({
      stage: m.stage,
      group: m.group,
      kickoff: m.kickoff,
      homeTeamName: m.homeTeam?.name ?? null,
      awayTeamName: m.awayTeam?.name ?? null,
    })),
    now
  );

  const message = buildReminderMessage(deadlines, {
    appUrl: APP_URL,
    // Date param busts Slack's image cache so each day's post re-fetches the
    // card with the live leaderboard.
    imageUrl: `${APP_URL}/api/reminder-card?d=${dateKey}`,
  });
  if (!message) {
    return NextResponse.json({
      ok: true,
      posted: false,
      reason: "no deadlines in the next 24h",
    });
  }

  const result = await postSlackMessage(
    SLACK_CHANNEL_ID,
    message.text,
    message.blocks
  );
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Slack post failed: ${result.error}. Check that SLACK_BOT_TOKEN has the chat:write scope and the bot is a member of #worldcup.`,
      },
      { status: 502 }
    );
  }

  await prisma.setting.upsert({
    where: { key: LAST_POSTED_KEY },
    update: { value: dateKey },
    create: { key: LAST_POSTED_KEY, value: dateKey },
  });

  return NextResponse.json({
    ok: true,
    posted: true,
    matches: deadlines.matches.length,
    groups: deadlines.groups.map((g) => g.group),
    bracket: deadlines.bracketLock != null,
    thirdPlace: deadlines.thirdPlaceLock != null,
    awards: deadlines.tournamentLock != null,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
