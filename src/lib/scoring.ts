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
  // Flat bonus for correctly calling the advancing side of a knockout decided
  // on penalties. Not multiplied by knockoutMultiplier (it's already
  // knockout-only). See scoreShootoutBonus.
  shootoutBonus: number;
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
  podiumExactPosition: 3,
  podiumInTop3: 1,
  shootoutBonus: 1,
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

/**
 * A "bull's eye": the prediction matches the final score exactly. Returns false
 * for an unplayed match (null scores). Single source of truth for the rule —
 * scorePrediction and the bull's-eye card both rely on it.
 */
export function isExactScore(
  prediction: { homeScore: number; awayScore: number },
  match: { homeScore: number | null; awayScore: number | null }
): boolean {
  return (
    match.homeScore != null &&
    match.awayScore != null &&
    prediction.homeScore === match.homeScore &&
    prediction.awayScore === match.awayScore
  );
}

export function scorePrediction(
  prediction: PredictionLike,
  match: MatchLike,
  config: ScoringConfig = DEFAULT_SCORING
): number {
  if (!prediction) return 0;
  if (match.homeScore == null || match.awayScore == null) return 0;

  const base = (() => {
    if (isExactScore(prediction, match)) {
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

type ShootoutMatchLike = {
  stage: Stage;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  advancingTeamId: string | null;
};

type ShootoutPredictionLike = {
  homeScore: number;
  awayScore: number;
  shootoutWinnerTeamId: string | null;
} | null;

/**
 * The team a prediction implies will advance from a knockout match. A decisive
 * predicted score names the higher-scored side; a predicted draw defers to the
 * explicit shootout-winner pick (which may be null if the user didn't choose).
 */
function predictedAdvancer(
  prediction: {
    homeScore: number;
    awayScore: number;
    shootoutWinnerTeamId: string | null;
  },
  match: { homeTeamId: string | null; awayTeamId: string | null }
): string | null {
  if (prediction.homeScore > prediction.awayScore) return match.homeTeamId;
  if (prediction.awayScore > prediction.homeScore) return match.awayTeamId;
  return prediction.shootoutWinnerTeamId;
}

/**
 * Bonus for calling the correct advancing side of a knockout decided on
 * penalties. A shootout is the only way a knockout's stored score stays level
 * while still producing an advancer, so the trigger is: knockout stage, a drawn
 * 120' score, and a known advancer. Awards a flat `shootoutBonus` (no knockout
 * multiplier — it's already knockout-only) when the prediction's implied
 * advancer matches the team that actually went through. Returns 0 otherwise,
 * including for matches decided in 90'/extra time, where the normal outcome
 * points already reward the correct side.
 */
export function scoreShootoutBonus(
  prediction: ShootoutPredictionLike,
  match: ShootoutMatchLike,
  config: ScoringConfig = DEFAULT_SCORING
): number {
  if (!prediction) return 0;
  if (!isKnockout(match.stage)) return 0;
  if (match.homeScore == null || match.awayScore == null) return 0;
  if (match.homeScore !== match.awayScore) return 0;
  if (match.advancingTeamId == null) return 0;
  const advancer = predictedAdvancer(prediction, match);
  return advancer != null && advancer === match.advancingTeamId
    ? config.shootoutBonus
    : 0;
}

/**
 * Total per-match points: scoreline points (exact/outcome, knockout-multiplied)
 * plus any correct-advancing-side shootout bonus. Use this for per-match
 * displays so they match the leaderboard total. The leaderboard keeps the two
 * parts separate only so it can classify exact-vs-outcome hits.
 */
export function scoreMatchTotal(
  prediction: ShootoutPredictionLike,
  match: ShootoutMatchLike,
  config: ScoringConfig = DEFAULT_SCORING
): number {
  if (!prediction) return 0;
  return (
    scorePrediction(prediction, match, config) +
    scoreShootoutBonus(prediction, match, config)
  );
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
