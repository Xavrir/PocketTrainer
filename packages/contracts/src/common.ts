export type Uuid = string;
export type IsoDateTime = string;
export type LocalDate = string;
export type Locale = "id-ID" | "en-US";

export type LocalizedText = Readonly<{
  "id-ID": string;
  "en-US": string;
}>;

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type FitnessGoal =
  | "build_strength"
  | "improve_mobility"
  | "learn_yoga"
  | "general_fitness";

export type ExperienceLevel = "foundation" | "beginner" | "intermediate";
export type TrainingLocation = "home" | "gym" | "both";

export type Equipment =
  | "none"
  | "wall"
  | "chair"
  | "bench"
  | "yoga_mat"
  | "resistance_band"
  | "dumbbell";

export type AssessmentCapability =
  | "lower_body_control"
  | "upper_body_control"
  | "balance"
  | "mobility"
  | "core_stability";

export type RestrictionTag =
  | "knee_flexion"
  | "wrist_loading"
  | "shoulder_overhead"
  | "single_leg_balance"
  | "spinal_flexion"
  | "floor_transition"
  | (string & {});

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "CATALOG_VERSION_UNSUPPORTED"
  | "EXERCISE_DEFINITION_UNSUPPORTED"
  | "INTERNAL_ERROR";

export type ApiErrorDto = Readonly<{
  error: Readonly<{
    code: ApiErrorCode;
    message: string;
    recoverable: boolean;
    requestId: string;
    details?: unknown;
  }>;
}>;
