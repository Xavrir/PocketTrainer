import type {
  FormRule,
  NumericRange,
  ScoreWeights,
  SessionScore,
  SessionScoringInput,
} from "@pockettrainer/contracts";

import { assertPercent, clamp, roundScore } from "./numbers.js";

export const DEFAULT_SESSION_SCORE_WEIGHTS = Object.freeze({
  formAccuracy: 0.5,
  completion: 0.25,
  control: 0.15,
  consistency: 0.1,
}) satisfies ScoreWeights;

export type FormRuleEvaluation = Readonly<{
  ruleId: string;
  score: number;
  weight: number;
  phaseWeight: number;
  critical: boolean;
  passed: boolean;
}>;

export function evaluateFormRule(rule: FormRule, actualValue: number): FormRuleEvaluation {
  const score = calculateRangeRuleScore(actualValue, rule.idealRange, rule.hardRange);
  return Object.freeze({
    ruleId: rule.id,
    score,
    weight: rule.weight,
    phaseWeight: rule.phaseWeight,
    critical: rule.critical,
    passed: score > 0,
  });
}

export function calculateRangeRuleScore(
  actualValue: number,
  idealRange: NumericRange,
  hardRange: NumericRange,
): number {
  if (!Number.isFinite(actualValue)) {
    throw new RangeError("actualValue must be finite");
  }
  if (isInsideRange(actualValue, idealRange)) {
    return 100;
  }
  if (idealRange.minimum !== undefined && actualValue < idealRange.minimum) {
    return interpolateLower(actualValue, idealRange.minimum, hardRange.minimum);
  }
  if (idealRange.maximum !== undefined && actualValue > idealRange.maximum) {
    return interpolateUpper(actualValue, idealRange.maximum, hardRange.maximum);
  }
  return 100;
}

export function calculateFormAccuracy(input: SessionScoringInput["ruleScores"]): number {
  if (input.length === 0) {
    return 0;
  }
  let weightedScore = 0;
  let totalWeight = 0;
  for (const rule of input) {
    assertPercent(rule.score, `rule ${rule.ruleId} score`);
    if (rule.weight <= 0 || rule.phaseWeight <= 0) {
      throw new RangeError("rule and phase weights must be positive");
    }
    const combinedWeight = rule.weight * rule.phaseWeight;
    weightedScore += rule.score * combinedWeight;
    totalWeight += combinedWeight;
  }
  return roundScore(weightedScore / totalWeight);
}

export function calculateConsistency(repetitionFormScores: readonly number[]): number {
  if (repetitionFormScores.length === 0) {
    return 0;
  }
  for (const score of repetitionFormScores) {
    assertPercent(score, "repetition form score");
  }
  if (repetitionFormScores.length === 1) {
    return 100;
  }
  const mean = repetitionFormScores.reduce((total, score) => total + score, 0) / repetitionFormScores.length;
  if (mean === 0) {
    return 0;
  }
  const variance =
    repetitionFormScores.reduce((total, score) => total + (score - mean) ** 2, 0) /
    repetitionFormScores.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return roundScore(100 * (1 - clamp(coefficientOfVariation, 0, 1)));
}

export function calculateSessionScore(
  input: SessionScoringInput,
  weights: ScoreWeights = DEFAULT_SESSION_SCORE_WEIGHTS,
): SessionScore | null {
  if (!input.confidenceEligible) {
    return null;
  }
  assertPercent(input.completion, "completion");
  assertPercent(input.control, "control");
  assertScoreWeights(weights);

  const formAccuracy = calculateFormAccuracy(input.ruleScores);
  const consistency = calculateConsistency(input.repetitionFormScores);
  const criticalRulesPassed = input.ruleScores.every((rule) => !rule.critical || rule.passed);
  const total =
    formAccuracy * weights.formAccuracy +
    input.completion * weights.completion +
    input.control * weights.control +
    consistency * weights.consistency;

  return Object.freeze({
    formAccuracy,
    completion: roundScore(input.completion),
    control: roundScore(input.control),
    consistency,
    total: roundScore(total),
    criticalRulesPassed,
  });
}

function isInsideRange(value: number, range: NumericRange): boolean {
  return (range.minimum === undefined || value >= range.minimum) &&
    (range.maximum === undefined || value <= range.maximum);
}

function interpolateLower(value: number, idealMinimum: number, hardMinimum: number | undefined): number {
  if (hardMinimum === undefined || value <= hardMinimum || idealMinimum === hardMinimum) {
    return 0;
  }
  return roundScore(((value - hardMinimum) / (idealMinimum - hardMinimum)) * 100);
}

function interpolateUpper(value: number, idealMaximum: number, hardMaximum: number | undefined): number {
  if (hardMaximum === undefined || value >= hardMaximum || idealMaximum === hardMaximum) {
    return 0;
  }
  return roundScore(((hardMaximum - value) / (hardMaximum - idealMaximum)) * 100);
}

function assertScoreWeights(weights: ScoreWeights): void {
  const values = Object.values(weights);
  if (values.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new RangeError("score weights must be finite and non-negative");
  }
  const sum = values.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 1) > 0.000_001) {
    throw new RangeError("score weights must sum to 1");
  }
}
