import assert from "node:assert/strict";
import test from "node:test";

import {
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
  assert.deepEqual(mastery.reasonCodes, ["CRITICAL_FORM_RULE_FAILED"]);
});

test("feedback arbitration emits only the highest eligible correction", () => {
  const selected = selectFeedbackCandidate([
    {
      feedbackKey: "minor",
      normalizedDeviation: 0.2,
      ruleImportance: 1,
      phaseImportance: 1,
      trackingConfidence: 0.9,
      persistedForMs: 500,
      minimumErrorDurationMs: 400,
      cooldownRemainingMs: 0,
      oppositeCorrectionShownRecently: false,
      relevantToCurrentPhase: true,
    },
    {
      feedbackKey: "major",
      normalizedDeviation: 0.8,
      ruleImportance: 1,
      phaseImportance: 1.2,
      trackingConfidence: 0.9,
      persistedForMs: 500,
      minimumErrorDurationMs: 400,
      cooldownRemainingMs: 0,
      oppositeCorrectionShownRecently: false,
      relevantToCurrentPhase: true,
    },
  ]);
  assert.equal(selected?.feedbackKey, "major");
});
