import { clamp } from "./numbers.js";

export type FeedbackCandidate = Readonly<{
  feedbackKey: string;
  severity: "coaching" | "important" | "safety";
  critical: boolean;
  normalizedDeviation: number;
  ruleImportance: number;
  phaseImportance: number;
  trackingConfidence: number;
  minimumTrackingConfidence: number;
  persistedForMs: number;
  minimumErrorDurationMs: number;
  cooldownRemainingMs: number;
  oppositeCorrectionShownRecently: boolean;
  relevantToCurrentPhase: boolean;
}>;

export type FeedbackSelection = Readonly<{
  feedbackKey: string;
  priority: number;
}>;

export function selectFeedbackCandidate(
  candidates: readonly FeedbackCandidate[],
): FeedbackSelection | null {
  const eligible = candidates.filter(isFeedbackEligible);
  if (eligible.length === 0) {
    return null;
  }
  const ranked = eligible
    .map((candidate) => ({
      feedbackKey: candidate.feedbackKey,
      priority: calculateFeedbackPriority(candidate),
      severityRank: severityRank(candidate.severity),
      critical: candidate.critical,
    }))
    .sort(
      (left, right) =>
        right.severityRank - left.severityRank ||
        Number(right.critical) - Number(left.critical) ||
        right.priority - left.priority ||
        left.feedbackKey.localeCompare(right.feedbackKey),
    );
  const selected = ranked[0];
  return selected === undefined
    ? null
    : Object.freeze({ feedbackKey: selected.feedbackKey, priority: selected.priority });
}

export function calculateFeedbackPriority(candidate: FeedbackCandidate): number {
  return (
    clamp(candidate.normalizedDeviation, 0, 1) *
    Math.max(0, candidate.ruleImportance) *
    Math.max(0, candidate.phaseImportance) *
    clamp(candidate.trackingConfidence, 0, 1)
  );
}

function isFeedbackEligible(candidate: FeedbackCandidate): boolean {
  return isFiniteNonNegative(candidate.normalizedDeviation) &&
    isFiniteNonNegative(candidate.ruleImportance) &&
    isFiniteNonNegative(candidate.phaseImportance) &&
    isFiniteNonNegative(candidate.persistedForMs) &&
    isFiniteNonNegative(candidate.minimumErrorDurationMs) &&
    Number.isFinite(candidate.cooldownRemainingMs) &&
    candidate.persistedForMs >= candidate.minimumErrorDurationMs &&
    candidate.cooldownRemainingMs <= 0 &&
    !candidate.oppositeCorrectionShownRecently &&
    candidate.relevantToCurrentPhase &&
    Number.isFinite(candidate.trackingConfidence) &&
    Number.isFinite(candidate.minimumTrackingConfidence) &&
    candidate.minimumTrackingConfidence >= 0 &&
    candidate.minimumTrackingConfidence <= 1 &&
    candidate.trackingConfidence <= 1 &&
    candidate.trackingConfidence >= candidate.minimumTrackingConfidence;
}

function severityRank(severity: FeedbackCandidate["severity"]): number {
  return severity === "safety" ? 3 : severity === "important" ? 2 : 1;
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
