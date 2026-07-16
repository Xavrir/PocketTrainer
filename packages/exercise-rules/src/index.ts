import type { ExerciseDefinition } from "@pockettrainer/contracts";
import { exerciseDefinitionSchema } from "@pockettrainer/validation";

import { BODY_SQUAT_DEFINITION } from "./body-squat.js";
import { INCLINE_PUSH_UP_DEFINITION } from "./incline-push-up.js";
import { TREE_POSE_DEFINITION } from "./tree-pose.js";
import { WARRIOR_II_DEFINITION } from "./warrior-ii.js";

export { BODY_SQUAT_DEFINITION } from "./body-squat.js";
export { INCLINE_PUSH_UP_DEFINITION } from "./incline-push-up.js";
export { TREE_POSE_DEFINITION } from "./tree-pose.js";
export { WARRIOR_II_DEFINITION } from "./warrior-ii.js";
export * from "./shared.js";

export const EXERCISE_DEFINITIONS = Object.freeze([
  BODY_SQUAT_DEFINITION,
  INCLINE_PUSH_UP_DEFINITION,
  WARRIOR_II_DEFINITION,
  TREE_POSE_DEFINITION,
]) satisfies readonly ExerciseDefinition[];

const DEFINITIONS_BY_KEY = new Map(
  EXERCISE_DEFINITIONS.map((definition) => [definition.exerciseKey, definition]),
);

export function getBundledExerciseDefinition(exerciseKey: string): ExerciseDefinition | undefined {
  return DEFINITIONS_BY_KEY.get(exerciseKey);
}

export function validateBundledExerciseDefinitions(): readonly ExerciseDefinition[] {
  return EXERCISE_DEFINITIONS.map((definition) => exerciseDefinitionSchema.parse(definition));
}
