import type {
  AssessmentCapability,
  Equipment,
  FitnessGoal,
  IsoDateTime,
  LocalDate,
  RestrictionTag,
  TrainingLocation,
  Uuid,
  Weekday,
  ExperienceLevel,
} from "./common.js";
import type { ExerciseResultSummary } from "./exercise.js";

export type RecommendedVariation = Readonly<{
  movementPattern: string;
  exerciseKey: string;
  reasonCode: string;
}>;

export type ExerciseRestriction = Readonly<{
  tag: RestrictionTag;
  source: "user_reported" | "assessment" | "pain_report";
  active: boolean;
  recordedAt: IsoDateTime;
}>;

export type MovementAssessmentResult = Readonly<{
  assessmentVersion: number;
  exerciseDefinitionVersions: Readonly<Record<string, number>>;
  scoringVersion: number;
  completedAt: IsoDateTime;
  lowerBodyControl: number;
  upperBodyControl: number;
  balance: number;
  mobility: number;
  coreStability: number;
  recommendedLevel: ExperienceLevel;
  recommendedVariations: readonly RecommendedVariation[];
  restrictions: readonly ExerciseRestriction[];
}>;

export type WorkoutSummary = Readonly<{
  workoutSessionId: Uuid;
  completedAt: IsoDateTime;
  results: readonly ExerciseResultSummary[];
}>;

export type PlanGenerationInput = Readonly<{
  primaryGoal: FitnessGoal;
  experience: ExperienceLevel;
  availableDays: readonly Weekday[];
  sessionDurationMinutes: number;
  location: TrainingLocation;
  equipment: readonly Equipment[];
  movementAssessment?: MovementAssessmentResult;
  exercisePreferences: readonly string[];
  exerciseRestrictions: readonly RestrictionTag[];
  recentWorkouts?: readonly WorkoutSummary[];
}>;

export type PlannedExercise = Readonly<{
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  sets: number;
  targetRepetitions?: number;
  targetHoldDurationMs?: number;
  restAfterMs: number;
}>;

export type WorkoutPlanDay = Readonly<{
  id: Uuid;
  localDate: LocalDate;
  dayType: "training" | "recovery";
  title: string;
  exercises: readonly PlannedExercise[];
}>;

export type WorkoutPlan = Readonly<{
  id: Uuid;
  revision: number;
  templateKey: string;
  generatedAt: IsoDateTime;
  validFrom: LocalDate;
  validThrough: LocalDate;
  days: readonly WorkoutPlanDay[];
}>;

export type PlanChange = Readonly<{
  changeType: "exercise_progression" | "exercise_maintenance" | "exercise_regression" | "exercise_exclusion";
  fromExerciseKey: string;
  toExerciseKey?: string;
  reasonCode:
    | "MASTERY_CRITERIA_MET"
    | "MASTERY_CRITERIA_PENDING"
    | "LOW_FORM_SCORE"
    | "LOW_VALID_REP_RATE"
    | "HIGH_DIFFICULTY"
    | "PAIN_REPORTED"
    | "LOW_TRACKING_CONFIDENCE"
    | "CRITICAL_FORM_RULE_FAILED";
  reasonText: string;
}>;

export type MasteryEvidence = Readonly<{
  workoutSessionId: Uuid;
  completedAt: IsoDateTime;
  formScore: number | null;
  completionPercent: number;
  perceivedDifficulty: number | null;
  validRepetitionRate: number;
  confidenceEligible: boolean;
  criticalRulesPassed: boolean;
  painReported: boolean;
}>;

export type MasteryDecision = Readonly<{
  action: "progress" | "maintain" | "regress" | "exclude";
  masteryScore: number;
  progressionCriteriaMet: boolean;
  qualifyingSessionIds: readonly Uuid[];
  reasonCodes: readonly PlanChange["reasonCode"][];
}>;

export type TrackingGateInput = Readonly<{
  poseConfidence: number;
  minimumPoseConfidence: number;
  requiredLandmarksPresent: boolean;
  bodyInsideFrame: boolean;
  detectedPeople: number;
  cameraOrientationValid: boolean;
  lightingSufficient: boolean;
}>;

export type TrackingGateReason =
  | "LOW_POSE_CONFIDENCE"
  | "MISSING_REQUIRED_LANDMARKS"
  | "BODY_OUTSIDE_FRAME"
  | "MULTIPLE_PEOPLE"
  | "WRONG_CAMERA_ORIENTATION"
  | "LOW_LIGHT";

export type TrackingGateDecision = Readonly<{
  eligible: boolean;
  reasons: readonly TrackingGateReason[];
  userMessageKey: "tracking.ready" | "tracking.paused.fullBodyNotVisible";
}>;

export type PainSafetyDecision = Readonly<{
  stopExercise: boolean;
  allowScore: boolean;
  allowProgression: boolean;
  excludeExercise: boolean;
  guidanceKey: "safety.continue" | "safety.stopPain";
}>;

export type XpEventType =
  | "WORKOUT_COMPLETED"
  | "DAILY_GOAL_COMPLETED"
  | "FORM_SCORE_BONUS"
  | "PERSONAL_BEST"
  | "ASSESSMENT_COMPLETED"
  | "WEEKLY_GOAL_COMPLETED";

export type XpCandidate = Readonly<{
  eventType: XpEventType;
  eventId: Uuid;
  requestedPoints: number;
  idempotencyKey: string;
}>;

export type XpLedgerEntry = Readonly<{
  id: Uuid;
  userId: Uuid;
  eventType: XpEventType;
  eventId: Uuid;
  points: number;
  idempotencyKey: string;
  createdAt: IsoDateTime;
}>;

export type XpAwardDecision = Readonly<{
  awardedPoints: number;
  cappedPoints: number;
  duplicate: boolean;
  dailyCappedTotalAfterAward: number;
}>;

export type StreakDayType = "WORKOUT" | "RECOVERY" | "ALTERNATIVE_ACTIVITY";
export type StreakDayStatus = "COMPLETED" | "PROTECTED" | "MISSED";

export type StreakDay = Readonly<{
  userId: Uuid;
  localDate: LocalDate;
  dayType: StreakDayType;
  status: StreakDayStatus;
  sourceEventId?: Uuid;
  timezone: string;
}>;

export type SkillMastery = Readonly<{
  exerciseKey: string;
  masteryScore: number;
  level: "unstarted" | "learning" | "mastered";
  updatedAt: IsoDateTime;
}>;

export type UserProgress = Readonly<{
  totalXp: number;
  accountLevel: number;
  currentStreakDays: number;
  longestStreakDays: number;
  completedLessonIds: readonly Uuid[];
  skillMastery: readonly SkillMastery[];
}>;
