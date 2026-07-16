import assert from "node:assert/strict";
import test from "node:test";

import {
  createMasteryEvidence,
  evaluateMastery,
  evaluatePainSafety,
  evaluateTrackingGate,
  isSessionScoringEligible,
  selectFeedbackCandidate,
} from "../dist/index.js";

const eligibleTrackingInput = {
  poseConfidence: 0.9,
  minimumPoseConfidence: 0.65,
  requiredLandmarksPresent: true,
  bodyInsideFrame: true,
  detectedPeople: 1,
  cameraOrientationValid: true,
  lightingSufficient: true,
};

const evidence = (id, completedAt, overrides = {}) => ({
  workoutSessionId: id,
  completedAt,
  formScore: 90,
  completionPercent: 95,
  perceivedDifficulty: 5,
  validRepetitionRate: 0.95,
  confidenceEligible: true,
  criticalRulesPassed: true,
  painReported: false,
  ...overrides,
});

test("tracking gates scoring for every unsafe camera condition", () => {
  const eligible = evaluateTrackingGate(eligibleTrackingInput);
  assert.equal(eligible.eligible, true);
  const paused = evaluateTrackingGate({
    ...eligibleTrackingInput,
    requiredLandmarksPresent: false,
    detectedPeople: 2,
  });
  assert.equal(paused.eligible, false);
  assert.deepEqual(paused.reasons, ["MISSING_REQUIRED_LANDMARKS", "MULTIPLE_PEOPLE"]);
  assert.equal(isSessionScoringEligible(paused, evaluatePainSafety(false)), false);
  assert.equal(evaluateTrackingGate({ ...eligibleTrackingInput, poseConfidence: Number.NaN }).eligible, false);
  assert.equal(evaluateTrackingGate({ ...eligibleTrackingInput, poseConfidence: Number.POSITIVE_INFINITY }).eligible, false);
});

test("pain stops, excludes, and suppresses both scoring and progression", () => {
  assert.deepEqual(evaluatePainSafety(true), {
    stopExercise: true,
    allowScore: false,
    allowProgression: false,
    excludeExercise: true,
    guidanceKey: "safety.stopPain",
  });
  assert.equal(isSessionScoringEligible(evaluateTrackingGate(eligibleTrackingInput), evaluatePainSafety(true)), false);
  assert.equal(
    evaluateMastery([evidence("latest", "2026-07-16T10:00:00.000Z", { painReported: true })]).action,
    "exclude",
  );
});

test("mastery requires both of the two most recent sessions to qualify", () => {
  const progressed = evaluateMastery([
    evidence("older", "2026-07-15T10:00:00.000Z"),
    evidence("latest", "2026-07-16T10:00:00.000Z"),
  ]);
  assert.equal(progressed.action, "progress");
  assert.deepEqual(progressed.qualifyingSessionIds, ["latest", "older"]);

  const maintained = evaluateMastery([
    evidence("older", "2026-07-15T10:00:00.000Z", { formScore: 84 }),
    evidence("latest", "2026-07-16T10:00:00.000Z"),
  ]);
  assert.equal(maintained.action, "maintain");
});

test("a genuinely poor latest result regresses while low confidence only pauses", () => {
  assert.equal(
    evaluateMastery([evidence("low", "2026-07-16T10:00:00.000Z", { formScore: 50 })]).action,
    "regress",
  );
  assert.deepEqual(
    evaluateMastery([
      evidence("uncertain", "2026-07-16T10:00:00.000Z", {
        formScore: null,
        confidenceEligible: false,
      }),
    ]).reasonCodes,
    ["LOW_TRACKING_CONFIDENCE"],
  );
});

test("a failed critical rule blocks progression even when the aggregate form score is high", () => {
  const mastery = evaluateMastery([
    evidence("critical-fail", "2026-07-16T10:00:00.000Z", {
      formScore: 95,
      completionPercent: 100,
      criticalRulesPassed: false,
    }),
  ]);
  assert.equal(mastery.action, "regress");
  assert.equal(mastery.masteryScore, 0);
  assert.deepEqual(mastery.reasonCodes, ["CRITICAL_FORM_RULE_FAILED"]);
});

test("mastery rejects impossible numeric evidence instead of progressing", () => {
  assert.throws(
    () => evaluateMastery([evidence("invalid", "2026-07-16T10:00:00.000Z", { formScore: 999 })]),
    RangeError,
  );
  assert.throws(
    () => evaluateMastery([evidence("invalid", "2026-07-16T10:00:00.000Z", { validRepetitionRate: 9 })]),
    RangeError,
  );
  assert.throws(
    () => evaluateMastery([evidence("invalid", "2026-07-16T10:00:00.000Z", { perceivedDifficulty: -1 })]),
    RangeError,
  );
});

test("uploaded exercise summaries preserve confidence, critical rules, and per-exercise pain", () => {
  const converted = createMasteryEvidence(
    "session-1",
    "2026-07-16T10:00:00.000Z",
    {
      resultMode: "repetition",
      exerciseKey: "body_squat",
      exerciseDefinitionVersion: 1,
      scoringVersion: 1,
      poseModelVersion: "model@1",
      targetRepetitions: 10,
      attemptedRepetitions: 10,
      validRepetitions: 9,
      repResults: [],
      formScore: 92,
      completionPercent: 90,
      controlScore: 90,
      consistencyScore: 90,
      averageTrackingConfidence: 0.9,
      confidenceEligible: true,
      criticalRulesPassed: false,
      failedCriticalRuleIds: ["squat_knee_control"],
      ruleMeasurements: [],
      safety: {
        painReported: true,
        perceivedDifficulty: 7,
        stopReason: "pain_reported",
      },
    },
  );
  assert.equal(converted.validRepetitionRate, 0.9);
  assert.equal(converted.criticalRulesPassed, false);
  assert.equal(converted.painReported, true);
  assert.equal(converted.perceivedDifficulty, 7);
});

test("feedback arbitration emits only the highest eligible correction", () => {
  const selected = selectFeedbackCandidate([
    {
      feedbackKey: "minor",
      severity: "coaching",
      critical: false,
      normalizedDeviation: 0.2,
      ruleImportance: 1,
      phaseImportance: 1,
      trackingConfidence: 0.9,
      minimumTrackingConfidence: 0.65,
      persistedForMs: 500,
      minimumErrorDurationMs: 400,
      cooldownRemainingMs: 0,
      oppositeCorrectionShownRecently: false,
      relevantToCurrentPhase: true,
    },
    {
      feedbackKey: "major",
      severity: "important",
      critical: true,
      normalizedDeviation: 0.8,
      ruleImportance: 1,
      phaseImportance: 1.2,
      trackingConfidence: 0.9,
      minimumTrackingConfidence: 0.65,
      persistedForMs: 500,
      minimumErrorDurationMs: 400,
      cooldownRemainingMs: 0,
      oppositeCorrectionShownRecently: false,
      relevantToCurrentPhase: true,
    },
  ]);
  assert.equal(selected?.feedbackKey, "major");
});

test("feedback suppresses low confidence and always prioritizes eligible safety guidance", () => {
  const base = {
    critical: false,
    normalizedDeviation: 1,
    ruleImportance: 1,
    phaseImportance: 1,
    trackingConfidence: 0.9,
    minimumTrackingConfidence: 0.65,
    persistedForMs: 500,
    minimumErrorDurationMs: 400,
    cooldownRemainingMs: 0,
    oppositeCorrectionShownRecently: false,
    relevantToCurrentPhase: true,
  };
  assert.equal(
    selectFeedbackCandidate([{ ...base, feedbackKey: "hidden", severity: "safety", trackingConfidence: 0.2 }]),
    null,
  );
  assert.equal(
    selectFeedbackCandidate([{ ...base, feedbackKey: "invalid", severity: "safety", normalizedDeviation: Number.NaN }]),
    null,
  );
  const selected = selectFeedbackCandidate([
    { ...base, feedbackKey: "cosmetic", severity: "coaching", normalizedDeviation: 1 },
    { ...base, feedbackKey: "protect-knee", severity: "safety", normalizedDeviation: 0.1, critical: true },
  ]);
  assert.equal(selected?.feedbackKey, "protect-knee");
});
