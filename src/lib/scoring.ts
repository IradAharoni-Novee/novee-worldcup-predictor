import { Stage } from "@prisma/client";

export type KnockoutStage = Exclude<Stage, "GROUP">;

export type ScoringConfig = {
  exactScore: number;
  correctOutcome: number;
  knockoutMultiplier: number;
  groupExactPosition: number;
  groupQualifiedHalf: number;
  bracketRoundPoints: Record<KnockoutStage, number>;
  tournamentWinnerPoints: number;
  goldenBootPoints: number;
  podiumExactPosition: number;
  podiumInTop3: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  exactScore: 3,
  correctOutcome: 1,
  knockoutMultiplier: 2,
  groupExactPosition: 3,
  groupQualifiedHalf: 1,
  bracketRoundPoints: {
    R32: 1,
    R16: 2,
    QF: 4,
    SF: 8,
    THIRD: 4,
    FINAL: 16,
  },
  tournamentWinnerPoints: 25,
  goldenBootPoints: 20,
  podiumExactPosition: 10,
  podiumInTop3: 4,
};

type MatchLike = {
  stage: Stage;
  homeScore: number | null;
  awayScore: number | null;
};

type PredictionLike = {
  homeScore: number;
  awayScore: number;
} | null;

const KNOCKOUT_STAGES: ReadonlySet<Stage> = new Set([
  Stage.R32,
  Stage.R16,
  Stage.QF,
  Stage.SF,
  Stage.THIRD,
  Stage.FINAL,
]);

function outcome(home: number, away: number): "H" | "A" | "D" {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

export function isKnockout(stage: Stage): boolean {
  return KNOCKOUT_STAGES.has(stage);
}

export function scorePrediction(
  prediction: PredictionLike,
  match: MatchLike,
  config: ScoringConfig = DEFAULT_SCORING
): number {
  if (!prediction) return 0;
  if (match.homeScore == null || match.awayScore == null) return 0;

  const base = (() => {
    if (
      prediction.homeScore === match.homeScore &&
      prediction.awayScore === match.awayScore
    ) {
      return config.exactScore;
    }
    if (
      outcome(prediction.homeScore, prediction.awayScore) ===
      outcome(match.homeScore, match.awayScore)
    ) {
      return config.correctOutcome;
    }
    return 0;
  })();

  if (base === 0) return 0;
  return isKnockout(match.stage) ? base * config.knockoutMultiplier : base;
}

export type ScoreBreakdown = {
  total: number;
  exact: number;
  outcome: number;
  predictions: number;
};

export function summarize(
  predictions: { prediction: PredictionLike; match: MatchLike }[],
  config: ScoringConfig = DEFAULT_SCORING
): ScoreBreakdown {
  let total = 0;
  let exact = 0;
  let outcomeCount = 0;
  let counted = 0;
  for (const { prediction, match } of predictions) {
    if (!prediction) continue;
    counted++;
    if (match.homeScore == null || match.awayScore == null) continue;
    const points = scorePrediction(prediction, match, config);
    total += points;
    if (points === 0) continue;
    const multiplier = isKnockout(match.stage) ? config.knockoutMultiplier : 1;
    if (points === config.exactScore * multiplier) exact++;
    else if (points === config.correctOutcome * multiplier) outcomeCount++;
  }
  return { total, exact, outcome: outcomeCount, predictions: counted };
}
