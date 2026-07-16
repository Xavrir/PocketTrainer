import type { XpAwardDecision, XpCandidate, XpEventType } from "@pockettrainer/contracts";

export type XpAwardContext = Readonly<{
  dailyCappedPoints: number;
  dailyExerciseXpCap: number;
  processedAwards: ReadonlyMap<
    string,
    Readonly<{
      candidate: XpCandidate;
      decision: Readonly<Omit<XpAwardDecision, "duplicate">>;
    }>
  >;
  cappedEventTypes?: ReadonlySet<XpEventType>;
}>;

export const DEFAULT_CAPPED_XP_EVENT_TYPES: ReadonlySet<XpEventType> = new Set([
  "WORKOUT_COMPLETED",
  "FORM_SCORE_BONUS",
  "PERSONAL_BEST",
]);

export function calculateXpAward(
  candidate: XpCandidate,
  context: XpAwardContext,
): XpAwardDecision {
  assertNonNegativeInteger(candidate.requestedPoints, "requestedPoints");
  assertNonNegativeInteger(context.dailyCappedPoints, "dailyCappedPoints");
  assertNonNegativeInteger(context.dailyExerciseXpCap, "dailyExerciseXpCap");

  const priorAward = context.processedAwards.get(candidate.idempotencyKey);
  if (priorAward !== undefined) {
    if (!sameCandidate(candidate, priorAward.candidate)) {
      throw new Error("idempotency key was already used for a different XP event");
    }
    assertNonNegativeInteger(priorAward.decision.awardedPoints, "priorAward.awardedPoints");
    assertNonNegativeInteger(priorAward.decision.cappedPoints, "priorAward.cappedPoints");
    assertNonNegativeInteger(
      priorAward.decision.dailyCappedTotalAfterAward,
      "priorAward.dailyCappedTotalAfterAward",
    );
    return Object.freeze({
      ...priorAward.decision,
      duplicate: true,
    });
  }
  const cappedEventTypes = context.cappedEventTypes ?? DEFAULT_CAPPED_XP_EVENT_TYPES;
  const isCapped = cappedEventTypes.has(candidate.eventType);
  const remainingAllowance = Math.max(0, context.dailyExerciseXpCap - context.dailyCappedPoints);
  const awardedPoints = isCapped
    ? Math.min(candidate.requestedPoints, remainingAllowance)
    : candidate.requestedPoints;
  return Object.freeze({
    awardedPoints,
    cappedPoints: candidate.requestedPoints - awardedPoints,
    duplicate: false,
    dailyCappedTotalAfterAward: context.dailyCappedPoints + (isCapped ? awardedPoints : 0),
  });
}

function sameCandidate(left: XpCandidate, right: XpCandidate): boolean {
  return left.eventType === right.eventType &&
    left.eventId === right.eventId &&
    left.requestedPoints === right.requestedPoints &&
    left.idempotencyKey === right.idempotencyKey;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}
