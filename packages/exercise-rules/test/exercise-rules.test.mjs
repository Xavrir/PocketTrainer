import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import test from "node:test";

import {
  canonicalManifestEntryPayload,
  exerciseDefinitionManifestSchema,
  exerciseDefinitionSchema,
  exerciseResultSummarySchema,
  validateExerciseResultAgainstDefinition,
  verifyRemoteExerciseDefinition,
} from "@pockettrainer/validation";
import {
  BODY_SQUAT_DEFINITION,
  EXERCISE_DEFINITIONS,
  JUMPING_JACK_DEFINITION,
  POSE_METRIC_SPECIFICATION_V1,
  POSE_METRIC_GOLDEN_FIXTURES_V1,
  TREE_POSE_DEFINITION,
  WARRIOR_II_DEFINITION,
  getBundledExerciseDefinition,
  validateBundledExerciseDefinitions,
} from "../dist/index.js";

test("all five bundled definitions are unique, versioned, and schema-valid", () => {
  const parsed = validateBundledExerciseDefinitions();
  assert.equal(parsed.length, 5);
  assert.equal(new Set(parsed.map((definition) => definition.exerciseKey)).size, 5);
  assert.deepEqual(
    parsed.map((definition) => definition.exerciseKey),
    ["body_squat", "incline_push_up", "jumping_jack", "warrior_ii", "tree_pose"],
  );
  for (const definition of parsed) {
    assert.equal(definition.exerciseDefinitionVersion, 1);
    assert.equal(definition.scoringVersion, 1);
    assert.equal(definition.schemaVersion, 1);
  }
});

test("every rule and transition metric has a versioned deterministic computation spec", () => {
  for (const definition of EXERCISE_DEFINITIONS) {
    assert.equal(definition.metricSpecificationVersion, 1);
    const metrics = [
      ...definition.rules.map((rule) => rule.metric),
      ...definition.states.flatMap((state) => state.predicates.map((predicate) => predicate.metric)),
    ];
    for (const metric of metrics) {
      const spec = POSE_METRIC_SPECIFICATION_V1[metric];
      assert.equal(spec.metric, metric);
      assert.ok(spec.formulaId.endsWith("_v1"));
    }
  }
  assert.ok(POSE_METRIC_GOLDEN_FIXTURES_V1.length >= 4);
  for (const fixture of POSE_METRIC_GOLDEN_FIXTURES_V1) {
    assert.equal(fixture.metricSpecificationVersion, 1);
    assert.ok(POSE_METRIC_SPECIFICATION_V1[fixture.metric]);
    assert.ok(fixture.tolerance > 0);
  }
});

test("bundled definitions are deeply immutable", () => {
  assert.equal(Object.isFrozen(EXERCISE_DEFINITIONS), true);
  assert.equal(Object.isFrozen(BODY_SQUAT_DEFINITION), true);
  assert.equal(Object.isFrozen(BODY_SQUAT_DEFINITION.states), true);
  assert.equal(Object.isFrozen(BODY_SQUAT_DEFINITION.states[0]), true);
});

test("definition lookup never silently substitutes another movement", () => {
  assert.equal(getBundledExerciseDefinition("body_squat")?.exerciseKey, "body_squat");
  assert.equal(getBundledExerciseDefinition("not_supported"), undefined);
});

test("schema rejects a rule configuration that cannot be rolled back safely", () => {
  const unsafe = {
    ...BODY_SQUAT_DEFINITION,
    minimumAppVersion: "latest",
  };
  assert.equal(exerciseDefinitionSchema.safeParse(unsafe).success, false);

  const typoedCapability = {
    ...BODY_SQUAT_DEFINITION,
    progression: {
      ...BODY_SQUAT_DEFINITION.progression,
      requiredCapabilities: { balnce: 40 },
    },
  };
  assert.equal(exerciseDefinitionSchema.safeParse(typoedCapability).success, false);

  const typoedRestriction = {
    ...BODY_SQUAT_DEFINITION,
    progression: {
      ...BODY_SQUAT_DEFINITION.progression,
      contraindicationTags: ["knee_fexion"],
    },
  };
  assert.equal(exerciseDefinitionSchema.safeParse(typoedRestriction).success, false);
});

test("hold completion keeps critical alignment predicates active for the full timer", () => {
  for (const definition of [WARRIOR_II_DEFINITION, TREE_POSE_DEFINITION]) {
    const completed = definition.states.find((state) => state.terminal);
    const terminalMetrics = new Set(completed.predicates.map((predicate) => predicate.metric));
    const criticalMetrics = new Set(
      definition.rules.filter((rule) => rule.critical).map((rule) => rule.metric),
    );
    for (const metric of criticalMetrics) {
      assert.equal(
        terminalMetrics.has(metric),
        true,
        `${definition.exerciseKey} terminal state must preserve critical metric ${metric}`,
      );
    }
    assert.equal(
      completed.predicates.some(
        (predicate) =>
          predicate.metric === "valid_hold_duration_ms" &&
          predicate.operator === "gte" &&
          predicate.value === definition.targetHoldDurationMs,
      ),
      true,
    );
    assert.equal(definition.stateMachine.holdAccumulator.pauseWhenActivePredicatesFail, true);
  }

  const unsafeRemoteHold = {
    ...TREE_POSE_DEFINITION,
    states: TREE_POSE_DEFINITION.states.map((state) =>
      state.terminal
        ? {
            ...state,
            predicates: [{ metric: "pose_confidence", operator: "gte", value: 0.65 }],
          }
        : state,
    ),
  };
  assert.equal(exerciseDefinitionSchema.safeParse(unsafeRemoteHold).success, false);
});

test("remote definitions reject tampering, unknown keys, and downgrade attempts", async () => {
  const definitionBytes = Buffer.from(JSON.stringify(BODY_SQUAT_DEFINITION));
  const sha256 = createHash("sha256").update(definitionBytes).digest("hex");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const unsignedEntry = {
    exerciseKey: "body_squat",
    exerciseDefinitionVersion: 1,
    minimumAppVersion: "0.1.0",
    rollbackExerciseDefinitionVersion: null,
    contentUrl: "https://content.example/body-squat.json",
    sha256,
    signature: "x".repeat(86),
  };
  const unsignedManifest = {
    schemaVersion: 1,
    catalogVersion: "2026.07.16",
    generatedAt: "2026-07-16T10:00:00.000Z",
    keyId: "content-key-1",
    entries: [unsignedEntry],
  };
  const signature = sign(
    null,
    Buffer.from(canonicalManifestEntryPayload(unsignedManifest, unsignedEntry)),
    privateKey,
  ).toString("base64url");
  const manifest = exerciseDefinitionManifestSchema.parse({
    ...unsignedManifest,
    entries: [{ ...unsignedEntry, signature }],
  });
  const crypto = {
    decodeUtf8(content) {
      return Buffer.from(content).toString("utf8");
    },
    async sha256Hex(content) {
      return createHash("sha256").update(content).digest("hex");
    },
    async verifySignature(input) {
      return verify(null, Buffer.from(input.canonicalPayload), publicKey, Buffer.from(input.signature, "base64url"));
    },
  };
  const policy = {
    appVersion: "0.1.0",
    trustedKeyIds: new Set(["content-key-1"]),
    currentDefinitionVersions: { body_squat: 1 },
    currentDefinitionDigests: { body_squat: sha256 },
    availableRollbackVersions: { body_squat: new Set([1]) },
  };
  const verified = await verifyRemoteExerciseDefinition({
    manifest,
    entry: manifest.entries[0],
    definitionBytes,
    policy,
    crypto,
  });
  assert.equal(verified.exerciseKey, "body_squat");

  await assert.rejects(() => verifyRemoteExerciseDefinition({
    manifest,
    entry: manifest.entries[0],
    definitionBytes: Buffer.from(`${definitionBytes.toString()} `),
    policy,
    crypto,
  }));
  await assert.rejects(() => verifyRemoteExerciseDefinition({
    manifest,
    entry: manifest.entries[0],
    definitionBytes,
    policy: { ...policy, trustedKeyIds: new Set(["another-key"]) },
    crypto,
  }));
  await assert.rejects(() => verifyRemoteExerciseDefinition({
    manifest,
    entry: manifest.entries[0],
    definitionBytes,
    policy: { ...policy, currentDefinitionVersions: { body_squat: 2 } },
    crypto,
  }));
  await assert.rejects(() => verifyRemoteExerciseDefinition({
    manifest,
    entry: manifest.entries[0],
    definitionBytes,
    policy: { ...policy, appVersion: "0.1.0-beta.1" },
    crypto,
  }));
});

test("uploaded derived results are bounded and prove every required rep phase", () => {
  const safeMeasurements = (definition) => definition.rules.map((rule) => ({
    ruleId: rule.id,
    actualValue:
      rule.idealRange.minimum !== undefined && rule.idealRange.maximum !== undefined
        ? (rule.idealRange.minimum + rule.idealRange.maximum) / 2
        : rule.idealRange.minimum ?? rule.idealRange.maximum,
  }));
  const summary = {
    resultMode: "repetition",
    exerciseKey: "body_squat",
    exerciseDefinitionVersion: 1,
    scoringVersion: 1,
    poseModelVersion: BODY_SQUAT_DEFINITION.poseModelVersion,
    targetRepetitions: 1,
    attemptedRepetitions: 1,
    validRepetitions: 1,
    repResults: [{
      repIndex: 1,
      valid: true,
      formScore: 90,
      completion: 100,
      control: 90,
      confidence: 0.9,
      durationMs: 2_000,
      completedStateIds: BODY_SQUAT_DEFINITION.states.map((state) => state.id),
      failedCriticalRuleIds: [],
      measurements: safeMeasurements(BODY_SQUAT_DEFINITION),
    }],
    formScore: 90,
    completionPercent: 100,
    controlScore: 90,
    consistencyScore: 100,
    averageTrackingConfidence: 0.9,
    confidenceEligible: true,
    criticalRulesPassed: true,
    failedCriticalRuleIds: [],
    ruleMeasurements: safeMeasurements(BODY_SQUAT_DEFINITION),
    safety: { painReported: false, perceivedDifficulty: 5, stopReason: "completed" },
  };
  assert.equal(validateExerciseResultAgainstDefinition(summary, BODY_SQUAT_DEFINITION).formScore, 90);

  const skippedBottom = structuredClone(summary);
  skippedBottom.repResults[0].completedStateIds = ["ready", "descending", "ascending", "complete"];
  assert.throws(() => validateExerciseResultAgainstDefinition(skippedBottom, BODY_SQUAT_DEFINITION));

  const uncertainButScored = { ...summary, confidenceEligible: false };
  assert.equal(exerciseResultSummarySchema.safeParse(uncertainButScored).success, false);
  assert.equal(
    exerciseResultSummarySchema.safeParse({ ...summary, rawLandmarks: [{ x: 0, y: 0 }] }).success,
    false,
  );

  const duplicatedEvidence = structuredClone(summary);
  duplicatedEvidence.ruleMeasurements.push(duplicatedEvidence.ruleMeasurements[0]);
  assert.equal(exerciseResultSummarySchema.safeParse(duplicatedEvidence).success, false);

  const hiddenCriticalFailure = structuredClone(summary);
  hiddenCriticalFailure.repResults[0].measurements.find(
    (measurement) => measurement.ruleId === "squat_knee_control",
  ).actualValue = 0.9;
  assert.throws(() => validateExerciseResultAgainstDefinition(hiddenCriticalFailure, BODY_SQUAT_DEFINITION));

  const holdSummary = {
    resultMode: "hold",
    exerciseKey: TREE_POSE_DEFINITION.exerciseKey,
    exerciseDefinitionVersion: TREE_POSE_DEFINITION.exerciseDefinitionVersion,
    scoringVersion: TREE_POSE_DEFINITION.scoringVersion,
    poseModelVersion: TREE_POSE_DEFINITION.poseModelVersion,
    validHoldDurationMs: TREE_POSE_DEFINITION.targetHoldDurationMs,
    targetHoldDurationMs: TREE_POSE_DEFINITION.targetHoldDurationMs,
    holdPauseCount: 2,
    formScore: 92,
    completionPercent: 100,
    controlScore: 90,
    consistencyScore: 88,
    averageTrackingConfidence: 0.91,
    confidenceEligible: true,
    criticalRulesPassed: true,
    failedCriticalRuleIds: [],
    ruleMeasurements: safeMeasurements(TREE_POSE_DEFINITION),
    safety: { painReported: false, perceivedDifficulty: 4, stopReason: "completed" },
  };
  assert.equal(
    validateExerciseResultAgainstDefinition(holdSummary, TREE_POSE_DEFINITION).resultMode,
    "hold",
  );

  const hiddenHoldFailure = structuredClone(holdSummary);
  hiddenHoldFailure.ruleMeasurements.find(
    (measurement) => measurement.ruleId === "tree_balance",
  ).actualValue = 0.1;
  assert.throws(() => validateExerciseResultAgainstDefinition(hiddenHoldFailure, TREE_POSE_DEFINITION));
});
