import type {
  ExerciseDefinition,
  ExerciseResultSummary,
  RepResult,
} from "@pockettrainer/contracts";

import { createSchema, fail } from "./runtime-schema.js";

type UnknownRecord = Record<string, unknown>;

const MAX_REPETITIONS_PER_RESULT = 500;
const MAX_DERIVED_MEASUREMENTS_PER_REP = 64;

export const exerciseResultSummarySchema = createSchema<ExerciseResultSummary>((input) => {
  const result = object(input, "$");
  text(result.exerciseKey, "$.exerciseKey");
  integer(result.exerciseDefinitionVersion, "$.exerciseDefinitionVersion", 1);
  integer(result.scoringVersion, "$.scoringVersion", 1);
  text(result.poseModelVersion, "$.poseModelVersion");
  nullablePercent(result.formScore, "$.formScore");
  percent(result.completionPercent, "$.completionPercent");
  nullablePercent(result.controlScore, "$.controlScore");
  nullablePercent(result.consistencyScore, "$.consistencyScore");
  unitInterval(result.averageTrackingConfidence, "$.averageTrackingConfidence");
  const confidenceEligible = boolean(result.confidenceEligible, "$.confidenceEligible");
  const criticalRulesPassed = boolean(result.criticalRulesPassed, "$.criticalRulesPassed");
  const failedCriticalRuleIds = stringArray(result.failedCriticalRuleIds, "$.failedCriticalRuleIds", 64);
  const ruleMeasurements = measurements(result.ruleMeasurements, "$.ruleMeasurements");
  if (criticalRulesPassed !== (failedCriticalRuleIds.length === 0)) {
    fail("$.criticalRulesPassed", "must agree with failedCriticalRuleIds");
  }
  if (
    !confidenceEligible &&
    (result.formScore !== null || result.controlScore !== null || result.consistencyScore !== null)
  ) {
    fail("$", "ineligible tracking must not produce form, control, or consistency scores");
  }
  validateSafety(result.safety, "$.safety");

  const resultMode = enumValue(result.resultMode, ["repetition", "hold"] as const, "$.resultMode");
  if (resultMode === "repetition") {
    allowedKeys(result, [
      "resultMode", "exerciseKey", "exerciseDefinitionVersion", "scoringVersion", "poseModelVersion",
      "targetRepetitions", "attemptedRepetitions", "validRepetitions", "repResults", "formScore", "completionPercent",
      "controlScore", "consistencyScore", "averageTrackingConfidence", "confidenceEligible",
      "criticalRulesPassed", "failedCriticalRuleIds", "ruleMeasurements", "safety",
    ], "$");
    const target = integer(result.targetRepetitions, "$.targetRepetitions", 1, MAX_REPETITIONS_PER_RESULT);
    const attempted = integer(result.attemptedRepetitions, "$.attemptedRepetitions", 0, MAX_REPETITIONS_PER_RESULT);
    const valid = integer(result.validRepetitions, "$.validRepetitions", 0, Math.min(attempted, target));
    const repResults = array(result.repResults, "$.repResults", MAX_REPETITIONS_PER_RESULT).map(
      (rep, index) => validateRep(rep, `$.repResults[${index}]`),
    );
    if (repResults.length !== attempted || repResults.filter((rep) => rep.valid).length !== valid) {
      fail("$.repResults", "must exactly explain attempted and valid repetition totals");
    }
    const expectedCompletion = (valid / target) * 100;
    if (Math.abs(expectedCompletion - (result.completionPercent as number)) > 0.01) {
      fail("$.completionPercent", "must equal valid repetitions divided by target repetitions");
    }
  } else {
    allowedKeys(result, [
      "resultMode", "exerciseKey", "exerciseDefinitionVersion", "scoringVersion", "poseModelVersion",
      "validHoldDurationMs", "targetHoldDurationMs", "holdPauseCount", "formScore", "completionPercent",
      "controlScore", "consistencyScore", "averageTrackingConfidence", "confidenceEligible",
      "criticalRulesPassed", "failedCriticalRuleIds", "ruleMeasurements", "safety",
    ], "$");
    const validHoldDurationMs = integer(result.validHoldDurationMs, "$.validHoldDurationMs", 0, 3_600_000);
    const targetHoldDurationMs = integer(result.targetHoldDurationMs, "$.targetHoldDurationMs", 100, 3_600_000);
    integer(result.holdPauseCount, "$.holdPauseCount", 0, 10_000);
    const expectedCompletion = Math.min(100, (validHoldDurationMs / targetHoldDurationMs) * 100);
    if (Math.abs(expectedCompletion - (result.completionPercent as number)) > 0.01) {
      fail("$.completionPercent", "must equal valid hold duration divided by target duration");
    }
  }
  return input as ExerciseResultSummary;
});

export function validateExerciseResultAgainstDefinition(
  resultInput: unknown,
  definition: ExerciseDefinition,
): ExerciseResultSummary {
  const result = exerciseResultSummarySchema.parse(resultInput);
  if (
    result.exerciseKey !== definition.exerciseKey ||
    result.exerciseDefinitionVersion !== definition.exerciseDefinitionVersion ||
    result.scoringVersion !== definition.scoringVersion ||
    result.poseModelVersion !== definition.poseModelVersion
  ) {
    fail("$", "result versions do not match the loaded exercise definition");
  }
  if (result.resultMode !== definition.mode && definition.mode !== "assessment") {
    fail("$.resultMode", "does not match the exercise definition mode");
  }
  const ruleIds = new Set(definition.rules.map((rule) => rule.id));
  const criticalRuleIds = new Set(
    definition.rules.filter((rule) => rule.critical).map((rule) => rule.id),
  );
  for (const ruleId of result.failedCriticalRuleIds) {
    if (!criticalRuleIds.has(ruleId)) fail("$.failedCriticalRuleIds", `contains unknown critical rule ${ruleId}`);
  }
  for (const measurement of result.ruleMeasurements) {
    if (!ruleIds.has(measurement.ruleId)) fail("$.ruleMeasurements", `contains unknown rule ${measurement.ruleId}`);
  }
  if (result.confidenceEligible) {
    assertEveryRuleMeasured(result.ruleMeasurements, definition, "$.ruleMeasurements");
  }
  if (result.resultMode === "repetition") {
    const requiredStates = definition.states.map((state) => state.id);
    const failedAcrossReps = new Set<string>();
    for (const [index, rep] of result.repResults.entries()) {
      for (const measurement of rep.measurements) {
        if (!ruleIds.has(measurement.ruleId)) {
          fail(`$.repResults[${index}].measurements`, `contains unknown rule ${measurement.ruleId}`);
        }
      }
      if (rep.valid) {
        assertEveryRuleMeasured(
          rep.measurements,
          definition,
          `$.repResults[${index}].measurements`,
        );
      }
      assertCriticalMeasurementsAgree(
        rep.measurements,
        rep.failedCriticalRuleIds,
        definition,
        `$.repResults[${index}]`,
      );
      if (rep.valid && !requiredStates.every((stateId) => rep.completedStateIds.includes(stateId))) {
        fail(`$.repResults[${index}].completedStateIds`, "valid repetitions must include every required state");
      }
      for (const ruleId of rep.failedCriticalRuleIds) {
        if (!criticalRuleIds.has(ruleId)) {
          fail(`$.repResults[${index}].failedCriticalRuleIds`, `contains unknown critical rule ${ruleId}`);
        }
        failedAcrossReps.add(ruleId);
      }
      if (rep.valid && rep.failedCriticalRuleIds.length > 0) {
        fail(`$.repResults[${index}]`, "a repetition with a critical failure cannot be valid");
      }
    }
    const summarizedFailures = new Set(result.failedCriticalRuleIds);
    if (
      [...failedAcrossReps].some((ruleId) => !summarizedFailures.has(ruleId)) ||
      [...summarizedFailures].some((ruleId) => !failedAcrossReps.has(ruleId))
    ) {
      fail("$.failedCriticalRuleIds", "must equal the union of per-repetition critical failures");
    }
  } else {
    assertCriticalMeasurementsAgree(
      result.ruleMeasurements,
      result.failedCriticalRuleIds,
      definition,
      "$",
    );
  }
  return result;
}

function assertEveryRuleMeasured(
  measurementsInput: readonly Readonly<{ ruleId: string }>[],
  definition: ExerciseDefinition,
  path: string,
): void {
  const measuredRuleIds = new Set(measurementsInput.map((measurement) => measurement.ruleId));
  const missingRule = definition.rules.find((rule) => !measuredRuleIds.has(rule.id));
  if (missingRule !== undefined) {
    fail(path, `must include derived evidence for rule ${missingRule.id}`);
  }
}

function assertCriticalMeasurementsAgree(
  measurementsInput: readonly Readonly<{ ruleId: string; actualValue: number }>[],
  reportedFailureIds: readonly string[],
  definition: ExerciseDefinition,
  path: string,
): void {
  const criticalRules = new Map(
    definition.rules.filter((rule) => rule.critical).map((rule) => [rule.id, rule]),
  );
  const measuredFailures = new Set<string>();
  const measuredCriticalRuleIds = new Set<string>();
  for (const measurement of measurementsInput) {
    const rule = criticalRules.get(measurement.ruleId);
    if (rule === undefined) continue;
    measuredCriticalRuleIds.add(rule.id);
    if (!withinRange(measurement.actualValue, rule.hardRange)) {
      measuredFailures.add(rule.id);
    }
  }
  const reportedFailures = new Set(reportedFailureIds);
  for (const reportedFailure of reportedFailures) {
    if (!measuredCriticalRuleIds.has(reportedFailure)) {
      fail(`${path}.failedCriticalRuleIds`, `failure ${reportedFailure} has no derived measurement evidence`);
    }
  }
  if (
    [...measuredFailures].some((ruleId) => !reportedFailures.has(ruleId)) ||
    [...reportedFailures].some((ruleId) => !measuredFailures.has(ruleId))
  ) {
    fail(`${path}.failedCriticalRuleIds`, "must agree with critical-rule measurement evidence");
  }
}

function withinRange(
  value: number,
  range: Readonly<{ minimum?: number; maximum?: number }>,
): boolean {
  return (
    (range.minimum === undefined || value >= range.minimum) &&
    (range.maximum === undefined || value <= range.maximum)
  );
}

function validateRep(input: unknown, path: string): RepResult {
  const rep = object(input, path);
  allowedKeys(rep, [
    "repIndex", "valid", "formScore", "completion", "control", "confidence", "durationMs",
    "completedStateIds", "failedCriticalRuleIds", "measurements",
  ], path);
  integer(rep.repIndex, `${path}.repIndex`, 1, MAX_REPETITIONS_PER_RESULT);
  boolean(rep.valid, `${path}.valid`);
  nullablePercent(rep.formScore, `${path}.formScore`);
  percent(rep.completion, `${path}.completion`);
  percent(rep.control, `${path}.control`);
  unitInterval(rep.confidence, `${path}.confidence`);
  integer(rep.durationMs, `${path}.durationMs`, 1, 120_000);
  stringArray(rep.completedStateIds, `${path}.completedStateIds`, 32);
  stringArray(rep.failedCriticalRuleIds, `${path}.failedCriticalRuleIds`, 64);
  measurements(rep.measurements, `${path}.measurements`);
  return input as RepResult;
}

function measurements(input: unknown, path: string): readonly Readonly<{ ruleId: string; actualValue: number }>[] {
  const items = array(input, path, MAX_DERIVED_MEASUREMENTS_PER_REP);
  const parsed = items.map((measurementInput, index) => {
    const measurement = object(measurementInput, `${path}[${index}]`);
    allowedKeys(measurement, ["ruleId", "actualValue"], `${path}[${index}]`);
    return {
      ruleId: text(measurement.ruleId, `${path}[${index}].ruleId`),
      actualValue: finite(measurement.actualValue, `${path}[${index}].actualValue`),
    };
  });
  if (new Set(parsed.map((measurement) => measurement.ruleId)).size !== parsed.length) {
    fail(path, "must contain at most one derived measurement per rule");
  }
  return parsed;
}

function validateSafety(input: unknown, path: string): void {
  const safety = object(input, path);
  allowedKeys(safety, ["painReported", "perceivedDifficulty", "stopReason"], path);
  const pain = boolean(safety.painReported, `${path}.painReported`);
  if (safety.perceivedDifficulty !== null) {
    finiteRange(safety.perceivedDifficulty, `${path}.perceivedDifficulty`, 0, 10);
  }
  const stopReason = enumValue(
    safety.stopReason,
    ["completed", "pain_reported", "tracking_unavailable", "user_stopped"] as const,
    `${path}.stopReason`,
  );
  if (pain !== (stopReason === "pain_reported")) {
    fail(path, "painReported and stopReason must agree");
  }
}

function object(input: unknown, path: string): UnknownRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) fail(path, "must be an object");
  return input as UnknownRecord;
}
function array(input: unknown, path: string, maximum: number): readonly unknown[] {
  if (!Array.isArray(input) || input.length > maximum) fail(path, `must be an array with at most ${maximum} items`);
  return input;
}
function text(input: unknown, path: string): string {
  if (typeof input !== "string" || input.trim() === "") fail(path, "must be a non-empty string");
  return input;
}
function stringArray(input: unknown, path: string, maximum: number): readonly string[] {
  const values = array(input, path, maximum).map((value, index) => text(value, `${path}[${index}]`));
  if (new Set(values).size !== values.length) fail(path, "must contain unique values");
  return values;
}
function boolean(input: unknown, path: string): boolean {
  if (typeof input !== "boolean") fail(path, "must be a boolean");
  return input;
}
function finite(input: unknown, path: string): number {
  if (typeof input !== "number" || !Number.isFinite(input)) fail(path, "must be a finite number");
  return input;
}
function finiteRange(input: unknown, path: string, minimum: number, maximum: number): number {
  const value = finite(input, path);
  if (value < minimum || value > maximum) fail(path, `must be between ${minimum} and ${maximum}`);
  return value;
}
function integer(input: unknown, path: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const value = finiteRange(input, path, minimum, maximum);
  if (!Number.isInteger(value)) fail(path, "must be an integer");
  return value;
}
function percent(input: unknown, path: string): number { return finiteRange(input, path, 0, 100); }
function nullablePercent(input: unknown, path: string): number | null {
  return input === null ? null : percent(input, path);
}
function unitInterval(input: unknown, path: string): number { return finiteRange(input, path, 0, 1); }
function enumValue<T extends string>(input: unknown, values: readonly T[], path: string): T {
  if (typeof input !== "string" || !values.includes(input as T)) fail(path, `must be one of ${values.join(", ")}`);
  return input as T;
}

function allowedKeys(value: UnknownRecord, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown !== undefined) fail(`${path}.${unknown}`, "is not supported and will not be accepted");
}
