import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getLeaderboard } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches public/reminder-card-bg.jpg (the flyer: logo on the left third,
// open grass on the right where the leaderboard panel goes).
const WIDTH = 1440;
const HEIGHT = 810;
const MEDALS = ["🥇", "🥈", "🥉"];

function displayName(name: string | null, email: string): string {
  const label = name?.trim() || email.split("@")[0] || "—";
  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
}

export async function GET() {
  // Read from disk rather than fetching over HTTP — a self-request 401s on
  // protected preview deployments.
  const bg = await readFile(
    path.join(process.cwd(), "public", "reminder-card-bg.jpg")
  );
  const bgSrc = `data:image/jpeg;base64,${bg.toString("base64")}`;
  const top3 = (await getLeaderboard()).slice(0, 3);

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
            marginLeft: 500,
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
              marginBottom: 24,
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
                  gap: 24,
                  fontSize: i === 0 ? 56 : 44,
                  fontWeight: 700,
                  marginBottom: i === 2 ? 0 : 18,
                }}
              >
                <span style={{ display: "flex" }}>{MEDALS[i]}</span>
                <span style={{ display: "flex" }}>
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
