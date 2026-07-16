import assert from "node:assert/strict";
import test from "node:test";

import { advanceExerciseState, createExerciseRuntimeState, predicatePasses } from "../dist/index.js";

const repetitionDefinition = {
  trackingLossResetMs: 1_000,
  maximumRepDurationMs: 1_000,
  states: [
    { id: "ready", predicates: [{ metric: "knee_angle", operator: "gt", value: 155 }], predicateMode: "all", minimumDurationMs: 0, allowedPreviousStates: ["complete"], terminal: false },
    { id: "descending", predicates: [{ metric: "knee_angular_velocity", operator: "lt", value: -12 }], predicateMode: "all", minimumDurationMs: 80, allowedPreviousStates: ["ready"], terminal: false },
    { id: "bottom", predicates: [{ metric: "knee_angle", operator: "between", value: 70, maximum: 110 }], predicateMode: "all", minimumDurationMs: 100, allowedPreviousStates: ["descending"], terminal: false },
    { id: "ascending", predicates: [{ metric: "knee_angular_velocity", operator: "gt", value: 12 }], predicateMode: "all", minimumDurationMs: 80, allowedPreviousStates: ["bottom"], terminal: false },
    { id: "complete", predicates: [{ metric: "knee_angle", operator: "gt", value: 155 }], predicateMode: "all", minimumDurationMs: 180, allowedPreviousStates: ["ascending"], terminal: true },
  ],
  stateMachine: {
    initialStateId: "ready",
    resetStateId: "ready",
    transitionPriority: ["complete", "ascending", "bottom", "descending", "ready"],
    invalidTransitionBehavior: "retain_current_state",
  },
};

const holdDefinition = {
  trackingLossResetMs: 2_500,
  states: [
    { id: "searching", predicates: [{ metric: "pose_confidence", operator: "gte", value: 0.65 }], predicateMode: "all", minimumDurationMs: 0, allowedPreviousStates: [], terminal: false },
    { id: "aligned", predicates: [{ metric: "single_leg_stability", operator: "gte", value: 0.72 }], predicateMode: "all", minimumDurationMs: 500, allowedPreviousStates: ["searching"], terminal: false },
    { id: "holding", predicates: [{ metric: "single_leg_stability", operator: "gte", value: 0.72 }], predicateMode: "all", minimumDurationMs: 500, allowedPreviousStates: ["aligned"], terminal: false },
    { id: "completed", predicates: [{ metric: "single_leg_stability", operator: "gte", value: 0.72 }, { metric: "valid_hold_duration_ms", operator: "gte", value: 15_000 }], predicateMode: "all", minimumDurationMs: 0, allowedPreviousStates: ["holding"], terminal: true },
  ],
  stateMachine: {
    initialStateId: "searching",
    resetStateId: "searching",
    transitionPriority: ["completed", "holding", "aligned", "searching"],
    invalidTransitionBehavior: "retain_current_state",
    holdAccumulator: {
      activeStateId: "holding",
      pauseWhenActivePredicatesFail: true,
      completionMetric: "valid_hold_duration_ms",
      resetAfterTrackingLossMs: 2_500,
      resetAfterAlignmentLossMs: 5_000,
    },
  },
};

const step = (definition, runtime, timestampMs, metrics, trackingEligible = true) =>
  advanceExerciseState(definition, runtime, { timestampMs, metrics, trackingEligible });

test("repetition state machine rejects a skipped required phase", () => {
  let runtime = createExerciseRuntimeState(repetitionDefinition, 0);
  runtime = step(repetitionDefinition, runtime, 100, { knee_angular_velocity: -20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 180, { knee_angular_velocity: -20 }).runtime;
  assert.equal(runtime.stateId, "descending");
  runtime = step(repetitionDefinition, runtime, 300, { knee_angular_velocity: 20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 500, { knee_angle: 170 }).runtime;
  assert.equal(runtime.stateId, "descending");
});

test("repetition state machine completes only the direction-aware full sequence", () => {
  let runtime = createExerciseRuntimeState(repetitionDefinition, 0);
  runtime = step(repetitionDefinition, runtime, 100, { knee_angular_velocity: -20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 180, { knee_angular_velocity: -20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 200, { knee_angle: 90 }).runtime;
  runtime = step(repetitionDefinition, runtime, 300, { knee_angle: 90 }).runtime;
  runtime = step(repetitionDefinition, runtime, 400, { knee_angular_velocity: 20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 480, { knee_angular_velocity: 20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 500, { knee_angle: 165 }).runtime;
  const completed = step(repetitionDefinition, runtime, 680, { knee_angle: 165 });
  assert.equal(completed.completed, true);
  assert.equal(completed.runtime.stateId, "complete");
});

test("an overlong repetition resets instead of becoming a late valid rep", () => {
  let runtime = createExerciseRuntimeState(repetitionDefinition, 0);
  runtime = step(repetitionDefinition, runtime, 100, { knee_angular_velocity: -20 }).runtime;
  runtime = step(repetitionDefinition, runtime, 180, { knee_angular_velocity: -20 }).runtime;
  const reset = step(repetitionDefinition, runtime, 1_181, { knee_angle: 90 });
  assert.equal(reset.reset, true);
  assert.equal(reset.runtime.stateId, "ready");
});

test("hold timer pauses on alignment loss and resumes without counting the gap", () => {
  const aligned = { pose_confidence: 0.9, single_leg_stability: 0.9 };
  let runtime = createExerciseRuntimeState(holdDefinition, 0);
  runtime = step(holdDefinition, runtime, 0, aligned).runtime;
  runtime = step(holdDefinition, runtime, 500, aligned).runtime;
  runtime = step(holdDefinition, runtime, 600, aligned).runtime;
  runtime = step(holdDefinition, runtime, 1_100, aligned).runtime;
  assert.equal(runtime.stateId, "holding");
  runtime = step(holdDefinition, runtime, 6_100, aligned).runtime;
  assert.equal(runtime.validHoldDurationMs, 5_000);
  runtime = step(holdDefinition, runtime, 7_100, { ...aligned, single_leg_stability: 0.2 }).runtime;
  runtime = step(holdDefinition, runtime, 8_100, aligned).runtime;
  assert.equal(runtime.validHoldDurationMs, 5_000);
  const completed = step(holdDefinition, runtime, 18_100, aligned);
  assert.equal(completed.completed, true);
  assert.equal(completed.runtime.validHoldDurationMs, 15_000);
});

test("prolonged tracking loss resets hold progress", () => {
  const aligned = { pose_confidence: 0.9, single_leg_stability: 0.9 };
  let runtime = createExerciseRuntimeState(holdDefinition, 0);
  runtime = step(holdDefinition, runtime, 0, aligned).runtime;
  runtime = step(holdDefinition, runtime, 500, aligned).runtime;
  runtime = step(holdDefinition, runtime, 600, aligned).runtime;
  runtime = step(holdDefinition, runtime, 1_100, aligned).runtime;
  runtime = step(holdDefinition, runtime, 3_100, aligned).runtime;
  runtime = step(holdDefinition, runtime, 3_200, {}, false).runtime;
  const reset = step(holdDefinition, runtime, 5_700, {}, false);
  assert.equal(reset.reset, true);
  assert.equal(reset.runtime.stateId, "searching");
  assert.equal(reset.runtime.validHoldDurationMs, 0);
});

test("hysteresis retains an active phase without weakening entry thresholds", () => {
  const predicate = {
    metric: "single_leg_stability",
    operator: "gte",
    value: 0.72,
    hysteresis: 0.08,
  };
  assert.equal(predicatePasses(predicate, { single_leg_stability: 0.68 }), false);
  assert.equal(predicatePasses(predicate, { single_leg_stability: 0.68 }, true), true);
});
