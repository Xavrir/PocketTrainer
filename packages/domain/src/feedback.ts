import { clamp } from "./numbers.js";

export type FeedbackCandidate = Readonly<{
  feedbackKey: string;
  normalizedDeviation: number;
  ruleImportance: number;
  phaseImportance: number;
  trackingConfidence: number;
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
    }))
    .sort((left, right) => right.priority - left.priority || left.feedbackKey.localeCompare(right.feedbackKey));
  const selected = ranked[0];
  return selected === undefined ? null : Object.freeze(selected);
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
  return candidate.persistedForMs >= candidate.minimumErrorDurationMs &&
    candidate.cooldownRemainingMs <= 0 &&
    !candidate.oppositeCorrectionShownRecently &&
    candidate.relevantToCurrentPhase &&
    candidate.trackingConfidence > 0;
}
