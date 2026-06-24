import { ImageResponse } from "next/og";
import { collectBullseyes, type BullseyeMatch } from "@/lib/bullseye";
import { displayName, stageLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1440;
const PAD = 72;
const CONTENT_W = WIDTH - PAD * 2;
const TITLE_H = 150;
const MATCH_HEADER_H = 92;
const MATCH_GAP = 48;
const CHIP_W = 240;
const CHIP_H = 196;
const CHIPS_PER_ROW = Math.max(1, Math.floor(CONTENT_W / CHIP_W));

const BG = "#0f172a";
const PURPLE = "#c4b5fd";
const GREEN = "#a5f3a5";

function matchBlockHeight(winners: number): number {
  const rows = Math.ceil(winners / CHIPS_PER_ROW);
  return MATCH_HEADER_H + rows * CHIP_H;
}

function cardHeight(matches: BullseyeMatch[]): number {
  const body = matches.reduce(
    (h, m) => h + matchBlockHeight(m.winners.length) + MATCH_GAP,
    0
  );
  return PAD * 2 + TITLE_H + Math.max(body, CHIP_H);
}

async function loadBullseyes(idsParam: string | null): Promise<BullseyeMatch[]> {
  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return [];

  const matches = await withRetry(() =>
    prisma.match.findMany({
      where: { id: { in: ids }, status: "FINISHED" },
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
    })
  );
  return collectBullseyes(matches);
}

function Flag({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      width={56}
      height={38}
      style={{ borderRadius: 4, objectFit: "cover" }}
    />
  );
}

function WinnerChip({
  winner,
  score,
}: {
  winner: BullseyeMatch["winners"][number];
  score: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: CHIP_W,
        height: CHIP_H,
      }}
    >
      {winner.image ? (
        <img
          src={winner.image}
          alt=""
          width={104}
          height={104}
          style={{ borderRadius: 9999, border: `3px solid ${GREEN}` }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: 104,
            height: 104,
            borderRadius: 9999,
            backgroundColor: "#7c6cf0",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            color: "#ffffff",
          }}
        >
          {displayName(winner.name, winner.email).charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", marginTop: 14, fontSize: 26, color: "#e2e8f0" }}>
        {displayName(winner.name, winner.email)}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 6,
          fontSize: 34,
          fontWeight: 700,
          color: GREEN,
        }}
      >
        {score}
      </div>
    </div>
  );
}

function MatchBlock({ match }: { match: BullseyeMatch }) {
  const home = match.homeTeamName ?? "TBD";
  const away = match.awayTeamName ?? "TBD";
  const score = `${match.homeScore}–${match.awayScore}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: MATCH_GAP }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: MATCH_HEADER_H,
          fontSize: 44,
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        <Flag url={match.homeFlag} />
        <span style={{ display: "flex", marginLeft: 16 }}>{home}</span>
        <span style={{ display: "flex", margin: "0 22px", color: GREEN }}>{score}</span>
        <span style={{ display: "flex", marginRight: 16 }}>{away}</span>
        <Flag url={match.awayFlag} />
        <span
          style={{
            display: "flex",
            marginLeft: "auto",
            fontSize: 26,
            fontWeight: 400,
            color: PURPLE,
          }}
        >
          {stageLabel(match.stage, match.group)}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {match.winners.map((w) => (
          <WinnerChip key={w.userId} winner={w} score={score} />
        ))}
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  const matches = await loadBullseyes(new URL(req.url).searchParams.get("m"));
  const height = cardHeight(matches);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height,
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          backgroundColor: BG,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: TITLE_H,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            🎯 Bull&apos;s Eye
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 28,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: PURPLE,
            }}
          >
            Exact-score predictions
          </div>
        </div>
        {matches.length === 0 ? (
          <div style={{ display: "flex", fontSize: 40, color: "#e2e8f0" }}>
            No exact-score predictions
          </div>
        ) : (
          matches.map((m) => <MatchBlock key={m.matchId} match={m} />)
        )}
      </div>
    ),
    { width: WIDTH, height }
  );
}
