import type {
  AssessmentCapability,
  Equipment,
  IsoDateTime,
  LocalizedText,
  RestrictionTag,
  Uuid,
} from "./common.js";

export type ExerciseCategory = "strength" | "yoga" | "mobility";
export type ExerciseMode = "repetition" | "hold" | "assessment";
export type CameraView = "front" | "side" | "either";

export type LandmarkName =
  | "nose"
  | "left_eye"
  | "right_eye"
  | "left_ear"
  | "right_ear"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_index"
  | "right_index"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"
  | "left_heel"
  | "right_heel"
  | "left_foot_index"
  | "right_foot_index";

export type PoseMetric =
  | "knee_angle"
  | "knee_angular_velocity"
  | "hip_angle"
  | "elbow_angle"
  | "elbow_angular_velocity"
  | "torso_lean"
  | "body_line_deviation"
  | "hip_vertical_velocity"
  | "hip_tilt"
  | "shoulder_tilt"
  | "arm_horizontal_deviation_left"
  | "arm_horizontal_deviation_right"
  | "front_knee_ankle_offset"
  | "stance_width_ratio"
  | "single_leg_stability"
  | "raised_knee_lateral_rotation"
  | "center_displacement"
  | "valid_hold_duration_ms"
  | "pose_confidence";

export type PoseMetricSpecification = Readonly<{
  metric: PoseMetric;
  unit: "degrees" | "degrees_per_second" | "normalized_ratio" | "normalized_per_second" | "confidence" | "milliseconds";
  sideSelection:
    | "anatomical_left"
    | "anatomical_right"
    | "most_visible_side"
    | "bilateral"
    | "front_leg"
    | "not_applicable";
  selectionRule:
    | "highest_minimum_landmark_visibility_left_tie"
    | "smallest_knee_angle_left_tie"
    | "both_anatomical_sides"
    | "fixed_anatomical_side"
    | "none";
  normalization: "none" | "torso_length" | "shoulder_width";
  signedDirection: "unsigned" | "positive_extension" | "positive_up" | "positive_left_side_up";
  formulaId: string;
}>;

export type NormalizedPoseLandmark = Readonly<{
  x: number;
  y: number;
  z: number;
  visibility: number;
}>;

export type PoseMetricGoldenFixture = Readonly<{
  id: string;
  metricSpecificationVersion: 1;
  metric: PoseMetric;
  inputStage: "mirror_corrected_normalized_world";
  landmarks: Readonly<Partial<Record<LandmarkName, NormalizedPoseLandmark>>>;
  expectedValue: number;
  tolerance: number;
}>;

export type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "between";

export type MetricPredicate = Readonly<{
  metric: PoseMetric;
  operator: ComparisonOperator;
  value: number;
  maximum?: number;
  hysteresis?: number;
}>;

export type CalibrationRequirements = Readonly<{
  minimumPoseConfidence: number;
  minimumBodyCoverage: number;
  maximumPeople: 1;
  minimumReadyDurationMs: number;
  maximumCameraTiltDegrees: number;
  minimumLuminance: number;
}>;

export type ExerciseStateDefinition = Readonly<{
  id: string;
  predicates: readonly MetricPredicate[];
  predicateMode: "all" | "any";
  minimumDurationMs: number;
  allowedPreviousStates: readonly string[];
  terminal: boolean;
}>;

export type ExerciseStateMachineDefinition = Readonly<{
  initialStateId: string;
  resetStateId: string;
  transitionPriority: readonly string[];
  invalidTransitionBehavior: "retain_current_state";
  holdAccumulator?: Readonly<{
    activeStateId: string;
    pauseWhenActivePredicatesFail: true;
    completionMetric: "valid_hold_duration_ms";
    resetAfterTrackingLossMs: number;
    resetAfterAlignmentLossMs: number;
  }>;
}>;

export type NumericRange = Readonly<{
  minimum?: number;
  maximum?: number;
}>;

export type FormRule = Readonly<{
  id: string;
  phases: readonly string[];
  metric: PoseMetric;
  idealRange: NumericRange;
  hardRange: NumericRange;
  weight: number;
  phaseWeight: number;
  critical: boolean;
  feedbackKey: string;
}>;

export type ScoreWeights = Readonly<{
  formAccuracy: number;
  completion: number;
  control: number;
  consistency: number;
}>;

export type FeedbackDefinition = Readonly<{
  key: string;
  ruleId: string;
  severity: "coaching" | "important" | "safety";
  message: LocalizedText;
  minimumErrorDurationMs: number;
  cooldownMs: number;
  minimumDisplayDurationMs: number;
}>;

export type ExerciseProgression = Readonly<{
  easierVariationKey?: string;
  harderVariationKey?: string;
  requiredEquipment: readonly Equipment[];
  requiredCapabilities: Readonly<Partial<Record<AssessmentCapability, number>>>;
  contraindicationTags: readonly RestrictionTag[];
}>;

export type ExerciseDefinition = Readonly<{
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  schemaVersion: number;
  scoringVersion: number;
  metricSpecificationVersion: 1;
  poseModelVersion: string;
  minimumAppVersion: string;
  rollbackExerciseDefinitionVersion: number | null;
  displayName: LocalizedText;
  category: ExerciseCategory;
  mode: ExerciseMode;
  cameraView: CameraView;
  requiredLandmarks: readonly LandmarkName[];
  calibration: CalibrationRequirements;
  states: readonly ExerciseStateDefinition[];
  stateMachine: ExerciseStateMachineDefinition;
  maximumRepDurationMs?: number;
  targetHoldDurationMs?: number;
  trackingLossResetMs: number;
  rules: readonly FormRule[];
  scoreWeights: ScoreWeights;
  feedback: readonly FeedbackDefinition[];
  progression: ExerciseProgression;
}>;

export type ExerciseDefinitionManifestEntry = Readonly<{
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  minimumAppVersion: string;
  rollbackExerciseDefinitionVersion: number | null;
  contentUrl: string;
  sha256: string;
  signature: string;
}>;

export type ExerciseDefinitionManifest = Readonly<{
  schemaVersion: number;
  catalogVersion: string;
  generatedAt: IsoDateTime;
  keyId: string;
  entries: readonly ExerciseDefinitionManifestEntry[];
}>;

export type RuleMeasurement = Readonly<{
  ruleId: string;
  actualValue: number;
}>;

export type RepResult = Readonly<{
  repIndex: number;
  valid: boolean;
  formScore: number | null;
  completion: number;
  control: number;
  confidence: number;
  durationMs: number;
  completedStateIds: readonly string[];
  failedCriticalRuleIds: readonly string[];
  measurements: readonly RuleMeasurement[];
}>;

export type SessionScoringInput = Readonly<{
  ruleScores: readonly Readonly<{
    ruleId: string;
    score: number;
    weight: number;
    phaseWeight: number;
    critical: boolean;
    passed: boolean;
  }>[];
  completion: number;
  control: number;
  repetitionFormScores: readonly number[];
  confidenceEligible: boolean;
}>;

export type SessionScore = Readonly<{
  formAccuracy: number;
  completion: number;
  control: number;
  consistency: number;
  total: number;
  criticalRulesPassed: boolean;
}>;

export type ExerciseSafetyReport = Readonly<{
  painReported: boolean;
  perceivedDifficulty: number | null;
  stopReason: "completed" | "pain_reported" | "tracking_unavailable" | "user_stopped";
}>;

type ExerciseResultBase = Readonly<{
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  scoringVersion: number;
  poseModelVersion: string;
  formScore: number | null;
  completionPercent: number;
  controlScore: number | null;
  consistencyScore: number | null;
  averageTrackingConfidence: number;
  confidenceEligible: boolean;
  criticalRulesPassed: boolean;
  failedCriticalRuleIds: readonly string[];
  ruleMeasurements: readonly RuleMeasurement[];
  safety: ExerciseSafetyReport;
}>;

export type RepetitionExerciseResultSummary = ExerciseResultBase &
  Readonly<{
    resultMode: "repetition";
    targetRepetitions: number;
    attemptedRepetitions: number;
    validRepetitions: number;
    repResults: readonly RepResult[];
  }>;

export type HoldExerciseResultSummary = ExerciseResultBase &
  Readonly<{
    resultMode: "hold";
    validHoldDurationMs: number;
    targetHoldDurationMs: number;
    holdPauseCount: number;
  }>;

export type ExerciseResultSummary =
  | RepetitionExerciseResultSummary
  | HoldExerciseResultSummary;

export type PoseSessionSummary = Readonly<{
  sessionId: Uuid;
  startedAt: IsoDateTime;
  completedAt: IsoDateTime;
  result: ExerciseResultSummary;
}>;
