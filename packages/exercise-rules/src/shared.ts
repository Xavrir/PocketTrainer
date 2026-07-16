import type { ExerciseDefinition } from "@pockettrainer/contracts";

export const DEFAULT_SCORE_WEIGHTS = Object.freeze({
  formAccuracy: 0.5,
  completion: 0.25,
  control: 0.15,
  consistency: 0.1,
}) satisfies ExerciseDefinition["scoreWeights"];

export const DEFAULT_CALIBRATION = Object.freeze({
  minimumPoseConfidence: 0.65,
  minimumBodyCoverage: 0.82,
  maximumPeople: 1,
  minimumReadyDurationMs: 800,
  maximumCameraTiltDegrees: 8,
  minimumLuminance: 0.22,
}) satisfies ExerciseDefinition["calibration"];

export const DEFAULT_FEEDBACK_TIMING = Object.freeze({
  minimumErrorDurationMs: 400,
  cooldownMs: 1_500,
  minimumDisplayDurationMs: 800,
});

export type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}
