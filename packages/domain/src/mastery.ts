import type { MasteryDecision, MasteryEvidence, PlanChange } from "@pockettrainer/contracts";

import { roundScore } from "./numbers.js";

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
      session.confidenceEligible && !session.painReported && session.formScore !== null,
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
    qualifyingSessionIds: Object.freeze([...qualifyingSessionIds]),
    reasonCodes: Object.freeze([...reasonCodes]),
  });
}
