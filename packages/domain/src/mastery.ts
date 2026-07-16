import type {
  ExerciseResultSummary,
  IsoDateTime,
  MasteryDecision,
  MasteryEvidence,
  PlanChange,
  Uuid,
} from "@pockettrainer/contracts";

import { assertPercent, roundScore } from "./numbers.js";

export type MasteryThresholds = Readonly<{
  progressionFormScore: number;
  progressionCompletionPercent: number;
  maximumProgressionDifficulty: number;
  requiredRecentSessions: number;
  regressionFormScore: number;
  regressionValidRepetitionRate: number;
  significantDifficulty: number;
}>;

export const DEFAULT_MASTERY_THRESHOLDS = Object.freeze({
  progressionFormScore: 85,
  progressionCompletionPercent: 90,
  maximumProgressionDifficulty: 6,
  requiredRecentSessions: 2,
  regressionFormScore: 65,
  regressionValidRepetitionRate: 0.6,
  significantDifficulty: 9,
}) satisfies MasteryThresholds;

export function evaluateMastery(
  evidence: readonly MasteryEvidence[],
  thresholds: MasteryThresholds = DEFAULT_MASTERY_THRESHOLDS,
): MasteryDecision {
  assertMasteryThresholds(thresholds);
  evidence.forEach(assertMasteryEvidence);
  if (evidence.length === 0) {
    return decision("maintain", 0, [], ["MASTERY_CRITERIA_PENDING"]);
  }
  const recent = [...evidence]
    .sort((left, right) => timestampOf(right) - timestampOf(left))
    .slice(0, thresholds.requiredRecentSessions);
  const latest = recent[0];
  if (latest === undefined) {
    return decision("maintain", 0, [], ["MASTERY_CRITERIA_PENDING"]);
  }
  if (latest.painReported) {
    return decision("exclude", masteryScore(recent), [], ["PAIN_REPORTED"]);
  }
  if (!latest.confidenceEligible || latest.formScore === null) {
    return decision("maintain", masteryScore(recent), [], ["LOW_TRACKING_CONFIDENCE"]);
  }
  if (!latest.criticalRulesPassed) {
    return decision("regress", masteryScore(recent), [], ["CRITICAL_FORM_RULE_FAILED"]);
  }
  const regressionReason = findRegressionReason(latest, thresholds);
  if (regressionReason !== undefined) {
    return decision("regress", masteryScore(recent), [], [regressionReason]);
  }
  if (
    recent.length === thresholds.requiredRecentSessions &&
    recent.every((session) => qualifiesForProgression(session, thresholds))
  ) {
    return decision(
      "progress",
      masteryScore(recent),
      recent.map((session) => session.workoutSessionId),
      ["MASTERY_CRITERIA_MET"],
    );
  }
  return decision("maintain", masteryScore(recent), [], ["MASTERY_CRITERIA_PENDING"]);
}

function assertMasteryEvidence(evidence: MasteryEvidence): void {
  timestampOf(evidence);
  if (evidence.formScore !== null) {
    assertPercent(evidence.formScore, "mastery evidence formScore");
  }
  assertPercent(evidence.completionPercent, "mastery evidence completionPercent");
  if (
    evidence.perceivedDifficulty !== null &&
    (!Number.isFinite(evidence.perceivedDifficulty) ||
      evidence.perceivedDifficulty < 0 ||
      evidence.perceivedDifficulty > 10)
  ) {
    throw new RangeError("mastery evidence perceivedDifficulty must be between 0 and 10");
  }
  if (
    !Number.isFinite(evidence.validRepetitionRate) ||
    evidence.validRepetitionRate < 0 ||
    evidence.validRepetitionRate > 1
  ) {
    throw new RangeError("mastery evidence validRepetitionRate must be between 0 and 1");
  }
}

function assertMasteryThresholds(thresholds: MasteryThresholds): void {
  assertPercent(thresholds.progressionFormScore, "progressionFormScore");
  assertPercent(thresholds.progressionCompletionPercent, "progressionCompletionPercent");
  assertPercent(thresholds.regressionFormScore, "regressionFormScore");
  if (!Number.isInteger(thresholds.requiredRecentSessions) || thresholds.requiredRecentSessions < 1) {
    throw new RangeError("requiredRecentSessions must be a positive integer");
  }
  if (
    !Number.isFinite(thresholds.maximumProgressionDifficulty) ||
    thresholds.maximumProgressionDifficulty < 0 ||
    thresholds.maximumProgressionDifficulty > 10 ||
    !Number.isFinite(thresholds.significantDifficulty) ||
    thresholds.significantDifficulty < 0 ||
    thresholds.significantDifficulty > 10
  ) {
    throw new RangeError("difficulty thresholds must be between 0 and 10");
  }
  if (
    !Number.isFinite(thresholds.regressionValidRepetitionRate) ||
    thresholds.regressionValidRepetitionRate < 0 ||
    thresholds.regressionValidRepetitionRate > 1
  ) {
    throw new RangeError("regressionValidRepetitionRate must be between 0 and 1");
  }
}

export function createMasteryEvidence(
  workoutSessionId: Uuid,
  completedAt: IsoDateTime,
  result: ExerciseResultSummary,
): MasteryEvidence {
  const validRepetitionRate =
    result.resultMode === "repetition" && result.attemptedRepetitions > 0
      ? result.validRepetitions / result.attemptedRepetitions
      : result.completionPercent / 100;
  return Object.freeze({
    workoutSessionId,
    completedAt,
    formScore: result.formScore,
    completionPercent: result.completionPercent,
    perceivedDifficulty: result.safety.perceivedDifficulty,
    validRepetitionRate,
    confidenceEligible: result.confidenceEligible,
    criticalRulesPassed: result.criticalRulesPassed,
    painReported: result.safety.painReported,
  });
}

function timestampOf(evidence: MasteryEvidence): number {
  const timestamp = Date.parse(evidence.completedAt);
  if (!Number.isFinite(timestamp)) {
    throw new RangeError("mastery evidence completedAt must be an ISO date-time");
  }
  return timestamp;
}

function qualifiesForProgression(session: MasteryEvidence, thresholds: MasteryThresholds): boolean {
  return !session.painReported &&
    session.confidenceEligible &&
    session.criticalRulesPassed &&
    session.formScore !== null &&
    session.formScore >= thresholds.progressionFormScore &&
    session.completionPercent >= thresholds.progressionCompletionPercent &&
    session.perceivedDifficulty !== null &&
    session.perceivedDifficulty <= thresholds.maximumProgressionDifficulty;
}

function findRegressionReason(
  latest: MasteryEvidence,
  thresholds: MasteryThresholds,
): PlanChange["reasonCode"] | undefined {
  if (latest.formScore !== null && latest.formScore < thresholds.regressionFormScore) {
    return "LOW_FORM_SCORE";
  }
  if (latest.validRepetitionRate < thresholds.regressionValidRepetitionRate) {
    return "LOW_VALID_REP_RATE";
  }
  if (
    latest.perceivedDifficulty !== null &&
    latest.perceivedDifficulty >= thresholds.significantDifficulty
  ) {
    return "HIGH_DIFFICULTY";
  }
  return undefined;
}

function masteryScore(evidence: readonly MasteryEvidence[]): number {
  const scoreable = evidence.filter(
    (session): session is MasteryEvidence & { formScore: number } =>
      session.confidenceEligible &&
      session.criticalRulesPassed &&
      !session.painReported &&
      session.formScore !== null,
  );
  if (scoreable.length === 0) {
    return 0;
  }
  return roundScore(
    scoreable.reduce(
      (total, session) => total + session.formScore * 0.7 + session.completionPercent * 0.3,
      0,
    ) / scoreable.length,
  );
}

function decision(
  action: MasteryDecision["action"],
  score: number,
  qualifyingSessionIds: readonly string[],
  reasonCodes: readonly PlanChange["reasonCode"][],
): MasteryDecision {
  return Object.freeze({
    action,
    masteryScore: score,
    progressionCriteriaMet: action === "progress",
    qualifyingSessionIds: Object.freeze([...qualifyingSessionIds]),
    reasonCodes: Object.freeze([...reasonCodes]),
  });
}
