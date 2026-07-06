import type { MatchStatus, Stage } from "@prisma/client";
import {
  scoreMatchTotal,
  scorePrediction,
  type ScoringConfig,
} from "@/lib/scoring";

export type ContenderUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type ContenderPrediction = {
  homeScore: number;
  awayScore: number;
  shootoutWinnerTeamId: string | null;
  user: ContenderUser;
};

export type ContenderMatch = {
  stage: Stage;
  status: MatchStatus;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  advancingTeamId: string | null;
};

export type ContenderRow = ContenderPrediction & {
  /**
   * Shared competition rank: predictions with equal points share a rank and
   * the next distinct score skips past the tied block (1, 1, 3, …).
   */
  rank: number;
  points: number;
};

/**
 * Points a single prediction earns for this match. A finished match uses the
 * canonical per-match total (scoreline points + shootout bonus). Anything else
 * is scored at the current scoreline only, with no shootout bonus — the live
 * sync writes `advancingTeamId` while a shootout is still in progress, so
 * adding the bonus pre-finish would award it prematurely. This matches the
 * leaderboard's `livePoints` split, so the two surfaces never disagree.
 */
function contenderPoints(
  prediction: ContenderPrediction,
  match: ContenderMatch,
  config: ScoringConfig
): number {
  if (match.status === "FINISHED") {
    return scoreMatchTotal(prediction, match, config);
  }
  return scorePrediction(prediction, match, config);
}

function displayLabel(user: ContenderUser): string {
  return user.name ?? user.email.split("@")[0] ?? "";
}

/**
 * Rank everyone who predicted a match by the points their pick earns for it,
 * highest first. Per-match points take only a handful of values, so ties are
 * the norm: tied rows share a rank and sort deterministically by display name
 * (then user id) so the order doesn't shuffle between live refreshes.
 */
export function rankContenders(
  predictions: ContenderPrediction[],
  match: ContenderMatch,
  config: ScoringConfig
): ContenderRow[] {
  const scored = predictions.map((p) => ({
    ...p,
    points: contenderPoints(p, match, config),
  }));
  scored.sort(
    (a, b) =>
      b.points - a.points ||
      displayLabel(a.user).localeCompare(displayLabel(b.user)) ||
      a.user.id.localeCompare(b.user.id)
  );

  let rank = 0;
  let prevPoints: number | null = null;
  return scored.map((row, i) => {
    if (prevPoints === null || row.points !== prevPoints) {
      rank = i + 1;
      prevPoints = row.points;
    }
    return { ...row, rank };
  });
}
