import assert from "node:assert/strict";
import test from "node:test";

import {
  BODY_SQUAT_DEFINITION,
  JUMPING_JACK_DEFINITION,
  LatestFrameWinsEvaluator,
  createMovementEvaluator,
  getBundledMovementDefinition,
} from "../dist/index.js";

const point = (x, y, z = 0, visibility = 1) => ({ x, y, z, visibility });

function squatLandmarks(depth = 0) {
  return {
    left_shoulder: point(-0.3, -1), right_shoulder: point(0.3, -1),
    left_hip: point(-0.3, 0, -depth), right_hip: point(0.3, 0, -depth),
    left_knee: point(-0.3, 1), right_knee: point(0.3, 1),
    left_ankle: point(-0.3, 2), right_ankle: point(0.3, 2),
  };
}

function frame(sequence, timestampMs, landmarks, overrides = {}) {
  return {
    sequence,
    timestampMs,
    poseConfidence: 0.95,
    peopleCount: 1,
    visible: true,
    landmarks,
    ...overrides,
  };
}

test("bundled loader exposes five versioned movement evaluators including jumping jack", () => {
  for (const definition of [
    "body_squat",
    "incline_push_up",
    "warrior_ii",
    "tree_pose",
    "jumping_jack",
  ]) {
    const loaded = getBundledMovementDefinition(definition);
    assert.equal(loaded?.exerciseDefinitionVersion, 1);
    const evaluation = createMovementEvaluator(loaded, { appVersion: "0.2.0" }).evaluate(
      frame(1, 0, squatLandmarks()),
    );
    assert.equal(evaluation.exerciseKey, definition);
    assert.equal(evaluation.contractVersion, 1);
  }
  assert.equal(JUMPING_JACK_DEFINITION.exerciseKey, "jumping_jack");
});

test("latest-frame-wins drops an out-of-order frame without mutating state", () => {
  const evaluator = new LatestFrameWinsEvaluator(
    createMovementEvaluator(BODY_SQUAT_DEFINITION, { appVersion: "0.2.0" }),
  );
  const first = evaluator.submit(frame(2, 100, squatLandmarks()));
  const dropped = evaluator.submit(frame(1, 50, squatLandmarks(1)));
  assert.equal(first.frameSequence, 2);
  assert.equal(dropped.droppedFrame, true);
  assert.equal(dropped.frameSequence, 2);
  assert.equal(dropped.state, first.state);
});

test("squat follows the ordered phases and produces a score only for eligible tracking", () => {
  const evaluator = createMovementEvaluator(BODY_SQUAT_DEFINITION, { appVersion: "0.2.0" });
  let sequence = 0;
  let timestampMs = 0;
  const submit = (depth, step = 100) => {
    timestampMs += step;
    return evaluator.evaluate(frame(++sequence, timestampMs, squatLandmarks(depth)));
  };

  submit(0, 500);
  submit(4, 100);
  for (let index = 0; index < 8; index += 1) submit(4, 100);
  submit(2, 100);
  submit(0, 100);
  for (let index = 0; index < 5; index += 1) submit(0, 100);
  const completed = submit(0, 250);

  assert.equal(completed.repCount, 1);
  assert.equal(completed.validRepCount, 1);
  assert.equal(completed.formScore !== null, true);
  assert.equal(completed.criticalRulesPassed, true);

  const lowConfidence = evaluator.evaluate(
    frame(++sequence, timestampMs + 100, squatLandmarks(), { poseConfidence: 0.4 }),
  );
  assert.equal(lowConfidence.confidenceEligible, false);
  assert.equal(lowConfidence.formScore, null);
});

test("low confidence cannot create a score or advance a fresh jumping-jack evaluator", () => {
  const evaluator = createMovementEvaluator(JUMPING_JACK_DEFINITION, { appVersion: "0.2.0" });
  const lowConfidence = evaluator.evaluate(
    frame(1, 0, squatLandmarks(), { poseConfidence: 0.3 }),
  );
  assert.equal(lowConfidence.trackingStatus, "paused");
  assert.equal(lowConfidence.repCount, 0);
  assert.equal(lowConfidence.formScore, null);
});
