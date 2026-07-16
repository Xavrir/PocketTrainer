import type {
  CalibrationRequirements,
  ExerciseDefinition,
  ExerciseDefinitionManifest,
  ExerciseProgression,
  ExerciseStateDefinition,
  FeedbackDefinition,
  FormRule,
  LandmarkName,
  LocalizedText,
  MetricPredicate,
  NumericRange,
  ScoreWeights,
} from "@pockettrainer/contracts";

import { createSchema, fail } from "./runtime-schema.js";
import { isoDateTimeSchema, semanticVersionSchema } from "./primitives.js";

type UnknownRecord = Record<string, unknown>;

const LANDMARK_NAMES = new Set<LandmarkName>([
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_index",
  "right_index",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
]);

const METRICS = new Set([
  "knee_angle",
  "knee_angular_velocity",
  "hip_angle",
  "elbow_angle",
  "elbow_angular_velocity",
  "torso_lean",
  "body_line_deviation",
  "hip_vertical_velocity",
  "hip_tilt",
  "shoulder_tilt",
  "arm_horizontal_deviation_left",
  "arm_horizontal_deviation_right",
  "front_knee_ankle_offset",
  "stance_width_ratio",
  "single_leg_stability",
  "raised_knee_lateral_rotation",
  "center_displacement",
  "pose_confidence",
]);

function recordAt(input: unknown, path: string): UnknownRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(path, "must be an object");
  }
  return input as UnknownRecord;
}

function arrayAt(input: unknown, path: string, allowEmpty = false): readonly unknown[] {
  if (!Array.isArray(input) || (!allowEmpty && input.length === 0)) {
    return fail(path, allowEmpty ? "must be an array" : "must be a non-empty array");
  }
  return input;
}

function stringAt(input: unknown, path: string, minimumLength = 1): string {
  if (typeof input !== "string" || input.trim().length < minimumLength) {
    return fail(path, `must be a string of at least ${minimumLength} character(s)`);
  }
  return input;
}

function enumAt<T extends string>(input: unknown, values: readonly T[], path: string): T {
  if (typeof input !== "string" || !values.includes(input as T)) {
    return fail(path, `must be one of: ${values.join(", ")}`);
  }
  return input as T;
}

function numberAt(
  input: unknown,
  path: string,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input < minimum || input > maximum) {
    return fail(path, `must be a finite number between ${minimum} and ${maximum}`);
  }
  return input;
}

function integerAt(input: unknown, path: string, minimum = 0): number {
  const value = numberAt(input, path, minimum);
  if (!Number.isInteger(value)) {
    return fail(path, "must be an integer");
  }
  return value;
}

function booleanAt(input: unknown, path: string): boolean {
  if (typeof input !== "boolean") {
    return fail(path, "must be a boolean");
  }
  return input;
}

function optionalNumberAt(input: unknown, path: string): number | undefined {
  return input === undefined ? undefined : numberAt(input, path);
}

function localizedTextAt(input: unknown, path: string): LocalizedText {
  const value = recordAt(input, path);
  return {
    "id-ID": stringAt(value["id-ID"], `${path}.id-ID`),
    "en-US": stringAt(value["en-US"], `${path}.en-US`),
  };
}

function parseCalibration(input: unknown, path: string): CalibrationRequirements {
  const value = recordAt(input, path);
  const maximumPeople = integerAt(value.maximumPeople, `${path}.maximumPeople`, 1);
  if (maximumPeople !== 1) {
    return fail(`${path}.maximumPeople`, "must be exactly 1 for safe coaching");
  }
  return {
    minimumPoseConfidence: numberAt(value.minimumPoseConfidence, `${path}.minimumPoseConfidence`, 0, 1),
    minimumBodyCoverage: numberAt(value.minimumBodyCoverage, `${path}.minimumBodyCoverage`, 0, 1),
    maximumPeople: 1,
    minimumReadyDurationMs: integerAt(value.minimumReadyDurationMs, `${path}.minimumReadyDurationMs`, 100),
    maximumCameraTiltDegrees: numberAt(value.maximumCameraTiltDegrees, `${path}.maximumCameraTiltDegrees`, 0, 45),
    minimumLuminance: numberAt(value.minimumLuminance, `${path}.minimumLuminance`, 0, 1),
  };
}

function parsePredicate(input: unknown, path: string): MetricPredicate {
  const value = recordAt(input, path);
  const metric = stringAt(value.metric, `${path}.metric`);
  if (!METRICS.has(metric)) {
    return fail(`${path}.metric`, "is not a supported pose metric");
  }
  const operator = enumAt(value.operator, ["gt", "gte", "lt", "lte", "between"] as const, `${path}.operator`);
  const parsed: MetricPredicate = {
    metric: metric as MetricPredicate["metric"],
    operator,
    value: numberAt(value.value, `${path}.value`),
    ...(value.maximum === undefined ? {} : { maximum: numberAt(value.maximum, `${path}.maximum`) }),
    ...(value.hysteresis === undefined
      ? {}
      : { hysteresis: numberAt(value.hysteresis, `${path}.hysteresis`, 0) }),
  };
  if (operator === "between" && parsed.maximum === undefined) {
    return fail(`${path}.maximum`, "is required for a between predicate");
  }
  if (parsed.maximum !== undefined && parsed.maximum < parsed.value) {
    return fail(`${path}.maximum`, "must be greater than or equal to value");
  }
  return parsed;
}

function parseState(input: unknown, path: string): ExerciseStateDefinition {
  const value = recordAt(input, path);
  return {
    id: stringAt(value.id, `${path}.id`),
    predicates: arrayAt(value.predicates, `${path}.predicates`).map((predicate, index) =>
      parsePredicate(predicate, `${path}.predicates[${index}]`),
    ),
    predicateMode: enumAt(value.predicateMode, ["all", "any"] as const, `${path}.predicateMode`),
    minimumDurationMs: integerAt(value.minimumDurationMs, `${path}.minimumDurationMs`),
    allowedPreviousStates: arrayAt(value.allowedPreviousStates, `${path}.allowedPreviousStates`, true).map(
      (state, index) => stringAt(state, `${path}.allowedPreviousStates[${index}]`),
    ),
    terminal: booleanAt(value.terminal, `${path}.terminal`),
  };
}

function parseRange(input: unknown, path: string): NumericRange {
  const value = recordAt(input, path);
  const minimum = optionalNumberAt(value.minimum, `${path}.minimum`);
  const maximum = optionalNumberAt(value.maximum, `${path}.maximum`);
  if (minimum === undefined && maximum === undefined) {
    return fail(path, "must define minimum, maximum, or both");
  }
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    return fail(path, "minimum must not exceed maximum");
  }
  return {
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
  };
}

function assertIdealInsideHard(ideal: NumericRange, hard: NumericRange, path: string): void {
  if (hard.minimum !== undefined && (ideal.minimum === undefined || ideal.minimum < hard.minimum)) {
    fail(`${path}.idealRange.minimum`, "must be inside the hard range");
  }
  if (hard.maximum !== undefined && (ideal.maximum === undefined || ideal.maximum > hard.maximum)) {
    fail(`${path}.idealRange.maximum`, "must be inside the hard range");
  }
}

function parseRule(input: unknown, path: string): FormRule {
  const value = recordAt(input, path);
  const metric = stringAt(value.metric, `${path}.metric`);
  if (!METRICS.has(metric)) {
    return fail(`${path}.metric`, "is not a supported pose metric");
  }
  const idealRange = parseRange(value.idealRange, `${path}.idealRange`);
  const hardRange = parseRange(value.hardRange, `${path}.hardRange`);
  assertIdealInsideHard(idealRange, hardRange, path);
  return {
    id: stringAt(value.id, `${path}.id`),
    phases: arrayAt(value.phases, `${path}.phases`).map((phase, index) =>
      stringAt(phase, `${path}.phases[${index}]`),
    ),
    metric: metric as FormRule["metric"],
    idealRange,
    hardRange,
    weight: numberAt(value.weight, `${path}.weight`, Number.EPSILON, 1),
    phaseWeight: numberAt(value.phaseWeight, `${path}.phaseWeight`, Number.EPSILON, 10),
    critical: booleanAt(value.critical, `${path}.critical`),
    feedbackKey: stringAt(value.feedbackKey, `${path}.feedbackKey`),
  };
}

function parseScoreWeights(input: unknown, path: string): ScoreWeights {
  const value = recordAt(input, path);
  const weights: ScoreWeights = {
    formAccuracy: numberAt(value.formAccuracy, `${path}.formAccuracy`, 0, 1),
    completion: numberAt(value.completion, `${path}.completion`, 0, 1),
    control: numberAt(value.control, `${path}.control`, 0, 1),
    consistency: numberAt(value.consistency, `${path}.consistency`, 0, 1),
  };
  assertApproximatelyOne(Object.values(weights), path);
  return weights;
}

function parseFeedback(input: unknown, path: string): FeedbackDefinition {
  const value = recordAt(input, path);
  return {
    key: stringAt(value.key, `${path}.key`),
    ruleId: stringAt(value.ruleId, `${path}.ruleId`),
    severity: enumAt(value.severity, ["coaching", "important", "safety"] as const, `${path}.severity`),
    message: localizedTextAt(value.message, `${path}.message`),
    minimumErrorDurationMs: integerAt(value.minimumErrorDurationMs, `${path}.minimumErrorDurationMs`, 100),
    cooldownMs: integerAt(value.cooldownMs, `${path}.cooldownMs`, 100),
    minimumDisplayDurationMs: integerAt(value.minimumDisplayDurationMs, `${path}.minimumDisplayDurationMs`, 100),
  };
}

function parseProgression(input: unknown, path: string): ExerciseProgression {
  const value = recordAt(input, path);
  const capabilities = recordAt(value.requiredCapabilities, `${path}.requiredCapabilities`);
  const parsedCapabilities: Record<string, number> = {};
  for (const [key, score] of Object.entries(capabilities)) {
    parsedCapabilities[key] = numberAt(score, `${path}.requiredCapabilities.${key}`, 0, 100);
  }
  return {
    ...(value.easierVariationKey === undefined
      ? {}
      : { easierVariationKey: stringAt(value.easierVariationKey, `${path}.easierVariationKey`) }),
    ...(value.harderVariationKey === undefined
      ? {}
      : { harderVariationKey: stringAt(value.harderVariationKey, `${path}.harderVariationKey`) }),
    requiredEquipment: arrayAt(value.requiredEquipment, `${path}.requiredEquipment`, true).map((item, index) =>
      enumAt(
        item,
        ["none", "wall", "chair", "bench", "yoga_mat", "resistance_band", "dumbbell"] as const,
        `${path}.requiredEquipment[${index}]`,
      ),
    ),
    requiredCapabilities: parsedCapabilities,
    contraindicationTags: arrayAt(value.contraindicationTags, `${path}.contraindicationTags`, true).map(
      (tag, index) => stringAt(tag, `${path}.contraindicationTags[${index}]`),
    ),
  };
}

function assertUnique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) {
    fail(path, "must not contain duplicate values");
  }
}

function assertApproximatelyOne(values: readonly number[], path: string): void {
  const sum = values.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 1) > 0.000_001) {
    fail(path, `must sum to 1; received ${sum}`);
  }
}

function assertReferences(
  states: readonly ExerciseStateDefinition[],
  rules: readonly FormRule[],
  feedback: readonly FeedbackDefinition[],
): void {
  const stateIds = new Set(states.map((state) => state.id));
  for (const [index, state] of states.entries()) {
    assertUnique(state.allowedPreviousStates, `$.states[${index}].allowedPreviousStates`);
    if (state.allowedPreviousStates.includes(state.id)) {
      fail(`$.states[${index}].allowedPreviousStates`, "must not contain a self-transition");
    }
    if (index > 0 && state.allowedPreviousStates.length === 0) {
      fail(`$.states[${index}].allowedPreviousStates`, "must define a direction-aware transition");
    }
    for (const previous of state.allowedPreviousStates) {
      if (!stateIds.has(previous)) {
        fail(`$.states[${index}].allowedPreviousStates`, `references unknown state ${previous}`);
      }
    }
  }
  for (const [index, rule] of rules.entries()) {
    for (const phase of rule.phases) {
      if (!stateIds.has(phase)) {
        fail(`$.rules[${index}].phases`, `references unknown state ${phase}`);
      }
    }
  }
  assertTerminalStateIsReachable(states);
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const feedbackByKey = new Map(feedback.map((item) => [item.key, item]));
  for (const [index, item] of feedback.entries()) {
    if (!rulesById.has(item.ruleId)) {
      fail(`$.feedback[${index}].ruleId`, `references unknown rule ${item.ruleId}`);
    }
  }
  for (const [index, rule] of rules.entries()) {
    const item = feedbackByKey.get(rule.feedbackKey);
    if (item?.ruleId !== rule.id) {
      fail(`$.rules[${index}].feedbackKey`, "must reference feedback for the same rule");
    }
  }
}

function assertTerminalStateIsReachable(states: readonly ExerciseStateDefinition[]): void {
  const first = states[0];
  if (first === undefined) {
    return;
  }
  const reachable = new Set([first.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const state of states) {
      if (!reachable.has(state.id) && state.allowedPreviousStates.some((id) => reachable.has(id))) {
        reachable.add(state.id);
        changed = true;
      }
    }
  }
  if (!states.some((state) => state.terminal && reachable.has(state.id))) {
    fail("$.states", "must provide a reachable terminal state");
  }
}

function parseExerciseDefinition(input: unknown): ExerciseDefinition {
  const value = recordAt(input, "$");
  const mode = enumAt(value.mode, ["repetition", "hold", "assessment"] as const, "$.mode");
  const landmarks = arrayAt(value.requiredLandmarks, "$.requiredLandmarks").map((item, index) => {
    const landmark = stringAt(item, `$.requiredLandmarks[${index}]`);
    if (!LANDMARK_NAMES.has(landmark as LandmarkName)) {
      return fail(`$.requiredLandmarks[${index}]`, "is not a supported landmark");
    }
    return landmark as LandmarkName;
  });
  const states = arrayAt(value.states, "$.states").map((state, index) =>
    parseState(state, `$.states[${index}]`),
  );
  const rules = arrayAt(value.rules, "$.rules").map((rule, index) =>
    parseRule(rule, `$.rules[${index}]`),
  );
  const feedback = arrayAt(value.feedback, "$.feedback").map((item, index) =>
    parseFeedback(item, `$.feedback[${index}]`),
  );

  assertUnique(landmarks, "$.requiredLandmarks");
  assertUnique(states.map((state) => state.id), "$.states[].id");
  assertUnique(rules.map((rule) => rule.id), "$.rules[].id");
  assertUnique(feedback.map((item) => item.key), "$.feedback[].key");
  assertApproximatelyOne(rules.map((rule) => rule.weight), "$.rules[].weight");
  assertReferences(states, rules, feedback);

  if (!states.some((state) => state.terminal)) {
    fail("$.states", "must contain a terminal state");
  }

  const maximumRepDurationMs =
    value.maximumRepDurationMs === undefined
      ? undefined
      : integerAt(value.maximumRepDurationMs, "$.maximumRepDurationMs", 100);
  const targetHoldDurationMs =
    value.targetHoldDurationMs === undefined
      ? undefined
      : integerAt(value.targetHoldDurationMs, "$.targetHoldDurationMs", 100);
  if (mode === "repetition" && maximumRepDurationMs === undefined) {
    fail("$.maximumRepDurationMs", "is required for repetition exercises");
  }
  if (mode === "hold" && targetHoldDurationMs === undefined) {
    fail("$.targetHoldDurationMs", "is required for hold exercises");
  }

  const minimumAppVersion = stringAt(value.minimumAppVersion, "$.minimumAppVersion");
  semanticVersionSchema.parse(minimumAppVersion);

  const exerciseDefinitionVersion = integerAt(
    value.exerciseDefinitionVersion,
    "$.exerciseDefinitionVersion",
    1,
  );
  const rollbackExerciseDefinitionVersion =
    value.rollbackExerciseDefinitionVersion === null
      ? null
      : integerAt(value.rollbackExerciseDefinitionVersion, "$.rollbackExerciseDefinitionVersion", 1);
  assertRollbackVersion(
    exerciseDefinitionVersion,
    rollbackExerciseDefinitionVersion,
    "$.rollbackExerciseDefinitionVersion",
  );

  return {
    exerciseKey: stringAt(value.exerciseKey, "$.exerciseKey"),
    exerciseDefinitionVersion,
    schemaVersion: integerAt(value.schemaVersion, "$.schemaVersion", 1),
    scoringVersion: integerAt(value.scoringVersion, "$.scoringVersion", 1),
    poseModelVersion: stringAt(value.poseModelVersion, "$.poseModelVersion"),
    minimumAppVersion,
    rollbackExerciseDefinitionVersion,
    displayName: localizedTextAt(value.displayName, "$.displayName"),
    category: enumAt(value.category, ["strength", "yoga", "mobility"] as const, "$.category"),
    mode,
    cameraView: enumAt(value.cameraView, ["front", "side", "either"] as const, "$.cameraView"),
    requiredLandmarks: landmarks,
    calibration: parseCalibration(value.calibration, "$.calibration"),
    states,
    ...(maximumRepDurationMs === undefined ? {} : { maximumRepDurationMs }),
    ...(targetHoldDurationMs === undefined ? {} : { targetHoldDurationMs }),
    trackingLossResetMs: integerAt(value.trackingLossResetMs, "$.trackingLossResetMs", 100),
    rules,
    scoreWeights: parseScoreWeights(value.scoreWeights, "$.scoreWeights"),
    feedback,
    progression: parseProgression(value.progression, "$.progression"),
  };
}

function parseManifest(input: unknown): ExerciseDefinitionManifest {
  const value = recordAt(input, "$");
  const generatedAt = stringAt(value.generatedAt, "$.generatedAt");
  isoDateTimeSchema.parse(generatedAt);
  const entries = arrayAt(value.entries, "$.entries").map((entry, index) => {
    const path = `$.entries[${index}]`;
    const item = recordAt(entry, path);
    const minimumAppVersion = stringAt(item.minimumAppVersion, `${path}.minimumAppVersion`);
    semanticVersionSchema.parse(minimumAppVersion);
    const sha256 = stringAt(item.sha256, `${path}.sha256`);
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      fail(`${path}.sha256`, "must be a lowercase SHA-256 digest");
    }
    const signature = stringAt(item.signature, `${path}.signature`);
    if (!/^[A-Za-z0-9_-]{43,}$/.test(signature)) {
      fail(`${path}.signature`, "must be a base64url signature");
    }
    const exerciseDefinitionVersion = integerAt(
      item.exerciseDefinitionVersion,
      `${path}.exerciseDefinitionVersion`,
      1,
    );
    const rollbackExerciseDefinitionVersion =
      item.rollbackExerciseDefinitionVersion === null
        ? null
        : integerAt(item.rollbackExerciseDefinitionVersion, `${path}.rollbackExerciseDefinitionVersion`, 1);
    assertRollbackVersion(
      exerciseDefinitionVersion,
      rollbackExerciseDefinitionVersion,
      `${path}.rollbackExerciseDefinitionVersion`,
    );
    const contentUrl = stringAt(item.contentUrl, `${path}.contentUrl`);
    if (!contentUrl.startsWith("https://")) {
      fail(`${path}.contentUrl`, "must use HTTPS");
    }
    return {
      exerciseKey: stringAt(item.exerciseKey, `${path}.exerciseKey`),
      exerciseDefinitionVersion,
      minimumAppVersion,
      rollbackExerciseDefinitionVersion,
      contentUrl,
      sha256,
      signature,
    };
  });
  assertUnique(
    entries.map((entry) => `${entry.exerciseKey}@${entry.exerciseDefinitionVersion}`),
    "$.entries",
  );
  return {
    schemaVersion: integerAt(value.schemaVersion, "$.schemaVersion", 1),
    catalogVersion: stringAt(value.catalogVersion, "$.catalogVersion"),
    generatedAt,
    keyId: stringAt(value.keyId, "$.keyId"),
    entries,
  };
}

function assertRollbackVersion(
  version: number,
  rollbackVersion: number | null,
  path: string,
): void {
  if (version === 1 && rollbackVersion !== null) {
    fail(path, "must be null for the first definition version");
  }
  if (version > 1 && (rollbackVersion === null || rollbackVersion >= version)) {
    fail(path, "must reference an earlier version");
  }
}

export const exerciseDefinitionSchema = createSchema<ExerciseDefinition>(parseExerciseDefinition);
export const exerciseDefinitionManifestSchema = createSchema<ExerciseDefinitionManifest>(parseManifest);
