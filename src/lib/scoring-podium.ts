import type { ScoringConfig } from "@/lib/scoring";

export type PodiumPicks = {
  firstId: string;
  secondId: string;
  thirdId: string;
};

export type PodiumScore = {
  total: number;
  exact: number; // right person, right slot
  inTop3: number; // right person, wrong slot
};

/**
 * Score an ordered top-3 leaderboard prediction against the actual podium.
 *
 * `actualTop3` is the ordered list of user ids that finished 1st, 2nd, 3rd
 * (humans only — AI players are filtered out upstream). Full credit for an
 * exact-slot hit, partial credit for naming someone who lands on the podium in
 * a different slot. Returns a zero score until the podium is settled (fewer
 * than three entries). Mirrors scoreGroupPrediction.
 */
export function scorePodiumPrediction(
  prediction: PodiumPicks,
  actualTop3: readonly string[],
  config: ScoringConfig
): PodiumScore {
  if (actualTop3.length < 3) return { total: 0, exact: 0, inTop3: 0 };

  const predicted = [
    prediction.firstId,
    prediction.secondId,
    prediction.thirdId,
  ];
  const actual = actualTop3.slice(0, 3);
  const actualSet = new Set(actual);

  let exact = 0;
  let inTop3 = 0;
  for (let i = 0; i < 3; i++) {
    const userId = predicted[i];
    if (userId === undefined) continue;
    if (userId === actual[i]) {
      exact += 1;
    } else if (actualSet.has(userId)) {
      inTop3 += 1;
    }
  }

  return {
    total: exact * config.podiumExactPosition + inTop3 * config.podiumInTop3,
    exact,
    inTop3,
  };
}
