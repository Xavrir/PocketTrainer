import assert from "node:assert/strict";
import test from "node:test";

import { exerciseDefinitionSchema } from "@pockettrainer/validation";
import {
  BODY_SQUAT_DEFINITION,
  EXERCISE_DEFINITIONS,
  TREE_POSE_DEFINITION,
  WARRIOR_II_DEFINITION,
  getBundledExerciseDefinition,
  validateBundledExerciseDefinitions,
} from "../dist/index.js";

test("all four bundled definitions are unique, versioned, and schema-valid", () => {
  const parsed = validateBundledExerciseDefinitions();
  assert.equal(parsed.length, 4);
  assert.equal(new Set(parsed.map((definition) => definition.exerciseKey)).size, 4);
  assert.deepEqual(
    parsed.map((definition) => definition.exerciseKey),
    ["body_squat", "incline_push_up", "warrior_ii", "tree_pose"],
  );
  for (const definition of parsed) {
    assert.equal(definition.exerciseDefinitionVersion, 1);
    assert.equal(definition.scoringVersion, 1);
    assert.equal(definition.schemaVersion, 1);
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
    assert.ok(completed.minimumDurationMs >= definition.targetHoldDurationMs);
  }
});
