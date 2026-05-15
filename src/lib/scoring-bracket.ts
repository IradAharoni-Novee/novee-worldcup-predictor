import type { Stage } from "@prisma/client";
import type { KnockoutStage, ScoringConfig } from "@/lib/scoring";

export const KNOCKOUT_STAGES: readonly KnockoutStage[] = [
  "R32",
  "R16",
  "QF",
  "SF",
  "THIRD",
  "FINAL",
] as const;

export type KnockoutMatch = {
  stage: Stage;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type BracketPick = {
  round: Stage;
  slot: number;
  teamId: string;
};

export type BracketScore = {
  total: number;
  perRound: Record<KnockoutStage, number>;
};

function emptyPerRound(): Record<KnockoutStage, number> {
  return { R32: 0, R16: 0, QF: 0, SF: 0, THIRD: 0, FINAL: 0 };
}

function isKnockoutStage(stage: Stage): stage is KnockoutStage {
  return stage !== "GROUP";
}

function winningTeamId(m: KnockoutMatch): string | null {
  if (
    m.homeTeamId == null ||
    m.awayTeamId == null ||
    m.homeScore == null ||
    m.awayScore == null
  ) {
    return null;
  }
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  return null;
}

// advancers[stage] = teams that won their match at `stage` (i.e., advanced past
// that round). For a user pick of (round=R32, slot=N, teamId=X), the pick is
// correct when X is in advancers.R32 — meaning X won an R32 match.
export function computeAdvancers(
  matches: KnockoutMatch[]
): Record<KnockoutStage, Set<string>> {
  const advancers: Record<KnockoutStage, Set<string>> = {
    R32: new Set(),
    R16: new Set(),
    QF: new Set(),
    SF: new Set(),
    THIRD: new Set(),
    FINAL: new Set(),
  };

  for (const m of matches) {
    if (!isKnockoutStage(m.stage)) continue;
    const winner = winningTeamId(m);
    if (!winner) continue;
    advancers[m.stage].add(winner);
  }

  return advancers;
}

export function scoreBracketPicks(
  picks: BracketPick[],
  advancers: Record<KnockoutStage, Set<string>>,
  config: ScoringConfig
): BracketScore {
  const perRound = emptyPerRound();
  for (const pick of picks) {
    if (!isKnockoutStage(pick.round)) continue;
    if (!advancers[pick.round].has(pick.teamId)) continue;
    perRound[pick.round] += config.bracketRoundPoints[pick.round];
  }
  const total = KNOCKOUT_STAGES.reduce((sum, s) => sum + perRound[s], 0);
  return { total, perRound };
}
