import type { ScoringConfig } from "@/lib/scoring";
import type { Standing } from "@/lib/group-standings";

export type GroupPredictionPicks = {
  team1stId: string;
  team2ndId: string;
  team3rdId: string;
  team4thId: string;
};

export type GroupScore = {
  total: number;
  exact: number;
  halfRight: number;
};

export function scoreGroupPrediction(
  prediction: GroupPredictionPicks,
  standings: Standing[],
  config: ScoringConfig
): GroupScore {
  if (standings.length !== 4) return { total: 0, exact: 0, halfRight: 0 };

  const predicted = [
    prediction.team1stId,
    prediction.team2ndId,
    prediction.team3rdId,
    prediction.team4thId,
  ];
  const actualOrder = standings.map((s) => s.teamId);
  const actualTopHalf = new Set(actualOrder.slice(0, 2));
  const actualBottomHalf = new Set(actualOrder.slice(2, 4));

  let exact = 0;
  let halfRight = 0;
  for (let i = 0; i < 4; i++) {
    const teamId = predicted[i];
    if (teamId === actualOrder[i]) {
      exact += 1;
      continue;
    }
    const predictedTopHalf = i < 2;
    const inActualTopHalf = actualTopHalf.has(teamId);
    const inActualBottomHalf = actualBottomHalf.has(teamId);
    if (predictedTopHalf && inActualTopHalf) {
      halfRight += 1;
    } else if (!predictedTopHalf && inActualBottomHalf) {
      halfRight += 1;
    }
  }

  return {
    total: exact * config.groupExactPosition + halfRight * config.groupQualifiedHalf,
    exact,
    halfRight,
  };
}
