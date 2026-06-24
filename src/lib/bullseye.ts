import type { Stage } from "@prisma/client";
import { displayName, stageLabel } from "@/lib/format";
import { isExactScore } from "@/lib/scoring";

export type BullseyeWinner = {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
};

/** A finished match with at least one exact-score ("bull's eye") prediction. */
export type BullseyeMatch = {
  matchId: string;
  stage: Stage;
  group: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeFlag: string | null;
  awayFlag: string | null;
  homeScore: number;
  awayScore: number;
  winners: BullseyeWinner[];
};

/** Shape pulled from Prisma: a finished match plus its predictions. */
export type ScoredMatch = {
  id: string;
  stage: Stage;
  group: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string; flag: string | null } | null;
  awayTeam: { name: string; flag: string | null } | null;
  predictions: {
    homeScore: number;
    awayScore: number;
    user: { id: string; name: string | null; email: string; image: string | null };
  }[];
};

/**
 * Reduce finished matches to the ones where someone nailed the exact score,
 * each carrying the list of players who did. Matches with no bull's eye (or no
 * final score yet) are dropped.
 */
export function collectBullseyes(matches: ScoredMatch[]): BullseyeMatch[] {
  const result: BullseyeMatch[] = [];
  for (const m of matches) {
    if (m.homeScore == null || m.awayScore == null) continue;

    const winners: BullseyeWinner[] = [];
    for (const p of m.predictions) {
      if (isExactScore(p, m)) {
        winners.push({
          userId: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
        });
      }
    }
    if (winners.length === 0) continue;

    result.push({
      matchId: m.id,
      stage: m.stage,
      group: m.group,
      homeTeamName: m.homeTeam?.name ?? null,
      awayTeamName: m.awayTeam?.name ?? null,
      homeFlag: m.homeTeam?.flag ?? null,
      awayFlag: m.awayTeam?.flag ?? null,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winners,
    });
  }
  return result;
}

export type BullseyeMessage = {
  text: string;
  blocks: Record<string, unknown>[];
};

/**
 * Build the Slack message for the bull's-eye digest: an mrkdwn summary (also
 * the notification fallback) plus the rendered card image. Returns null when
 * there's nothing to celebrate, so the caller can skip posting.
 */
export function buildBullseyeMessage(
  matches: BullseyeMatch[],
  opts: { appUrl: string; imageUrl: string }
): BullseyeMessage | null {
  if (matches.length === 0) return null;

  const winnerCount = matches.reduce((n, m) => n + m.winners.length, 0);
  const lines: string[] = [
    `:dart: *Bull's eye!* ${winnerCount} exact-score ${
      winnerCount === 1 ? "prediction" : "predictions"
    } nailed:`,
  ];

  for (const m of matches) {
    const home = m.homeTeamName ?? "TBD";
    const away = m.awayTeamName ?? "TBD";
    const names = m.winners.map((w) => displayName(w.name, w.email)).join(", ");
    lines.push(
      "",
      `• *${home} ${m.homeScore}–${m.awayScore} ${away}* (${stageLabel(
        m.stage,
        m.group
      )}) — ${names}`
    );
  }

  lines.push("", `:crystal_ball: <${opts.appUrl}|See the leaderboard →>`);

  return {
    text: "Bull's eye! Exact-score predictions nailed.",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      {
        type: "image",
        image_url: opts.imageUrl,
        alt_text: "Players who predicted exact scores",
      },
    ],
  };
}
