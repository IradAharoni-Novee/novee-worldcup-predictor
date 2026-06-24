import { NextResponse } from "next/server";
import { buildBullseyeMessage, collectBullseyes } from "@/lib/bullseye";
import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/retry";
import { postSlackMessage } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// #worldcup in the Novee Slack workspace.
const SLACK_CHANNEL_ID = "C0B9S42B94M";
const APP_URL = "https://noveecuppredictor.world";
// Setting row holding the match IDs already covered by a bull's-eye post, so a
// daily run never re-announces the same match.
const ANNOUNCED_KEY = "bullseyeCard:announced";

// A cold/asleep Neon compute throws P1001 on the first query. No user waits on
// this cron, so retry patiently to ride out the wake-up.
const DB_RETRY = { retries: 5, baseDelayMs: 500 };

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

  const announcedRow = await withRetry(
    () => prisma.setting.findUnique({ where: { key: ANNOUNCED_KEY } }),
    DB_RETRY
  );
  const announced = Array.isArray(announcedRow?.value)
    ? (announcedRow.value as string[])
    : [];
  const announcedSet = new Set(announced);

  const finished = await withRetry(
    () =>
      prisma.match.findMany({
        where: { status: "FINISHED", homeScore: { not: null }, awayScore: { not: null } },
        select: {
          id: true,
          stage: true,
          group: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { name: true, flag: true } },
          awayTeam: { select: { name: true, flag: true } },
          predictions: {
            select: {
              homeScore: true,
              awayScore: true,
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      }),
    DB_RETRY
  );

  const candidates = finished.filter((m) => !announcedSet.has(m.id));
  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      posted: false,
      reason: "no newly finished matches",
    });
  }

  const digest = collectBullseyes(candidates);
  const message = buildBullseyeMessage(digest, {
    appUrl: APP_URL,
    // The match-id list selects which matches the card renders and doubles as a
    // cache key so Slack re-fetches the image for each new post.
    imageUrl: `${APP_URL}/api/bullseye-card?m=${digest
      .map((m) => m.matchId)
      .join(",")}`,
  });

  // A bull's-eye-free batch still gets marked announced below so it's never
  // re-scanned — we just don't post anything.
  if (message) {
    const result = await postSlackMessage(
      SLACK_CHANNEL_ID,
      message.text,
      message.blocks
    );
    if (!result.ok) {
      // Leave the batch unannounced so the next run retries the post rather
      // than silently dropping these bull's eyes.
      return NextResponse.json(
        {
          ok: false,
          error: `Slack post failed: ${result.error}. Check that SLACK_BOT_TOKEN has the chat:write scope and the bot is a member of #worldcup.`,
        },
        { status: 502 }
      );
    }
  }

  const updated = [...announcedSet, ...candidates.map((m) => m.id)];
  await withRetry(
    () =>
      prisma.setting.upsert({
        where: { key: ANNOUNCED_KEY },
        update: { value: updated },
        create: { key: ANNOUNCED_KEY, value: updated },
      }),
    DB_RETRY
  );

  return NextResponse.json({
    ok: true,
    posted: message != null,
    matches: digest.length,
    winners: digest.reduce((n, m) => n + m.winners.length, 0),
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
