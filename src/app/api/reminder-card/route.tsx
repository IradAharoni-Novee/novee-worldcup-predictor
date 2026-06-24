import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { displayName } from "@/lib/format";
import { getLeaderboard } from "@/lib/leaderboard";
import {
  getLeaderboardSnapshot,
  isSnapshotDateParam,
} from "@/lib/leaderboard-snapshots";
import { withRetry } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches public/reminder-card-bg.jpg (the flyer: logo on the left third,
// open grass on the right where the leaderboard panel goes).
const WIDTH = 1440;
const HEIGHT = 810;
const MEDALS = ["🥇", "🥈", "🥉"];

async function loadTop3(dateParam: string | null) {
  // A valid ?d= with a stored snapshot renders that day's frozen standings.
  // Anything else — no/malformed date, or a date never snapshotted (old posts,
  // ad-hoc loads) — falls back to the live leaderboard.
  if (isSnapshotDateParam(dateParam)) {
    const snapshot = await withRetry(() => getLeaderboardSnapshot(dateParam));
    if (snapshot) return snapshot.slice(0, 3);
  }
  return (await withRetry(() => getLeaderboard())).slice(0, 3);
}

export async function GET(req: Request) {
  // Read from disk rather than fetching over HTTP — a self-request 401s on
  // protected preview deployments.
  const bg = await readFile(
    path.join(process.cwd(), "public", "reminder-card-bg.jpg")
  );
  const bgSrc = `data:image/jpeg;base64,${bg.toString("base64")}`;
  const top3 = await loadTop3(new URL(req.url).searchParams.get("d"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <img
          src={bgSrc}
          alt=""
          width={WIDTH}
          height={HEIGHT}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // Logo art ends ≈x=390; center the panel in the remaining space.
            marginLeft: 525,
            width: 780,
            padding: "44px 56px",
            borderRadius: 28,
            backgroundColor: "rgba(15, 23, 42, 0.62)",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#c4b5fd",
              marginBottom: 28,
            }}
          >
            Leaderboard
          </div>
          {top3.length === 0 ? (
            <div style={{ display: "flex", fontSize: 40 }}>
              No predictions scored yet
            </div>
          ) : (
            top3.map((row, i) => (
              <div
                key={row.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  fontSize: i === 0 ? 52 : 44,
                  fontWeight: 700,
                  marginBottom: i === 2 ? 0 : 20,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: 76,
                    justifyContent: "center",
                  }}
                >
                  {MEDALS[i]}
                </span>
                {row.image ? (
                  <img
                    src={row.image}
                    alt=""
                    width={68}
                    height={68}
                    style={{ borderRadius: 9999, marginLeft: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      width: 68,
                      height: 68,
                      borderRadius: 9999,
                      marginLeft: 8,
                      backgroundColor: "#7c6cf0",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 34,
                    }}
                  >
                    {displayName(row.name, row.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  style={{
                    display: "flex",
                    flexGrow: 1,
                    marginLeft: 20,
                  }}
                >
                  {displayName(row.name, row.email)}
                </span>
                <span
                  style={{
                    display: "flex",
                    color: "#a5f3a5",
                    fontWeight: 400,
                  }}
                >
                  {row.total} pts
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
