import type { XpAwardDecision, XpCandidate } from "@pockettrainer/contracts";

export type XpAwardContext = Readonly<{
  dailyAwardedPoints: number;
  dailyExerciseXpCap: number;
  processedAwards: ReadonlyMap<string, number>;
}>;

export function calculateXpAward(
  candidate: XpCandidate,
  context: XpAwardContext,
): XpAwardDecision {
  assertNonNegativeInteger(candidate.requestedPoints, "requestedPoints");
  assertNonNegativeInteger(context.dailyAwardedPoints, "dailyAwardedPoints");
  assertNonNegativeInteger(context.dailyExerciseXpCap, "dailyExerciseXpCap");

  const priorAward = context.processedAwards.get(candidate.idempotencyKey);
  if (priorAward !== undefined) {
    assertNonNegativeInteger(priorAward, "priorAward");
    return Object.freeze({
      awardedPoints: priorAward,
      cappedPoints: Math.max(0, candidate.requestedPoints - priorAward),
      duplicate: true,
      dailyTotalAfterAward: context.dailyAwardedPoints,
    });
  }
  const remainingAllowance = Math.max(0, context.dailyExerciseXpCap - context.dailyAwardedPoints);
  const awardedPoints = Math.min(candidate.requestedPoints, remainingAllowance);
  return Object.freeze({
    awardedPoints,
    cappedPoints: candidate.requestedPoints - awardedPoints,
    duplicate: false,
    dailyTotalAfterAward: context.dailyAwardedPoints + awardedPoints,
  });
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}
