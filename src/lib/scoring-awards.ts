import type { ScoringConfig } from "@/lib/scoring";

export const SETTING_KEY_ACTUAL_WINNER = "actualWinnerTeamId";
export const SETTING_KEY_ACTUAL_GOLDEN_BOOT = "actualGoldenBootPlayerId";

export type AwardsPrediction = {
  winnerTeamId: string | null;
  goldenBootPlayerId: string | null;
};

export type AwardsActual = {
  actualWinnerTeamId: string | null;
  actualGoldenBootPlayerId: string | null;
};

export type AwardsScore = {
  total: number;
  winnerPoints: number;
  goldenBootPoints: number;
};

export function scoreAwards(
  prediction: AwardsPrediction,
  actual: AwardsActual,
  config: ScoringConfig
): AwardsScore {
  const winnerPoints =
    prediction.winnerTeamId &&
    actual.actualWinnerTeamId &&
    prediction.winnerTeamId === actual.actualWinnerTeamId
      ? config.tournamentWinnerPoints
      : 0;
  const goldenBootPoints =
    prediction.goldenBootPlayerId &&
    actual.actualGoldenBootPlayerId &&
    prediction.goldenBootPlayerId === actual.actualGoldenBootPlayerId
      ? config.goldenBootPoints
      : 0;
  return {
    total: winnerPoints + goldenBootPoints,
    winnerPoints,
    goldenBootPoints,
  };
}
