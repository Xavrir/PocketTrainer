import type {
  Equipment,
  FitnessGoal,
  IsoDateTime,
  Locale,
  RestrictionTag,
  TrainingLocation,
  Uuid,
  Weekday,
  ExperienceLevel,
} from "./common.js";
import type { Course, CourseCatalog, LessonUnlockDecision } from "./catalog.js";
import type { ExerciseResultSummary } from "./exercise.js";
import type {
  MovementAssessmentResult,
  PlanChange,
  SkillMastery,
  UserProgress,
  WorkoutPlan,
  XpLedgerEntry,
} from "./progression.js";

export type UserProfileDto = Readonly<{
  userId: Uuid;
  displayName: string;
  locale: Locale;
  timezone: string;
  primaryGoal: FitnessGoal;
  experience: ExperienceLevel;
  availableDays: readonly Weekday[];
  sessionDurationMinutes: number;
  location: TrainingLocation;
  equipment: readonly Equipment[];
  exerciseRestrictions: readonly RestrictionTag[];
  onboardingCompleted: boolean;
  updatedAt: IsoDateTime;
}>;

export type UpdateProfileRequest = Readonly<
  Omit<UserProfileDto, "userId" | "updatedAt">
>;

export type ConsentType = "privacy" | "camera_processing" | "fitness_guidance";

export type ConsentDto = Readonly<{
  type: ConsentType;
  version: string;
  granted: boolean;
  recordedAt: IsoDateTime;
}>;

export type UpdateConsentRequest = Readonly<{
  version: string;
  granted: boolean;
}>;

export type BootstrapResponse = Readonly<{
  serverTime: IsoDateTime;
  minimumSupportedAppVersion: string;
  profile: UserProfileDto | null;
  consents: readonly ConsentDto[];
  catalog: CourseCatalog;
  progress: UserProgress;
  currentPlan: WorkoutPlan | null;
}>;

export type CatalogResponse = Readonly<{
  catalog: CourseCatalog;
  lessonAccess: Readonly<Record<Uuid, LessonUnlockDecision>>;
}>;

export type CourseResponse = Readonly<{
  course: Course;
  lessonAccess: Readonly<Record<Uuid, LessonUnlockDecision>>;
}>;

export type ProgressResponse = Readonly<{
  progress: UserProgress;
  mastery: readonly SkillMastery[];
  movementPassport: readonly Readonly<{
    exerciseKey: string;
    bestFormScore: number | null;
    completedSessions: number;
    masteryScore: number;
  }>[];
}>;

export type CreateAssessmentRequest = Readonly<{
  assessmentVersion: number;
  exerciseKeys: readonly string[];
  startedAt: IsoDateTime;
}>;

export type CreateAssessmentResponse = Readonly<{
  assessmentId: Uuid;
  uploadRevision: number;
}>;

export type CompleteAssessmentRequest = Readonly<{
  idempotencyKey: string;
  uploadRevision: number;
  completedAt: IsoDateTime;
  results: readonly ExerciseResultSummary[];
}>;

export type CompleteAssessmentResponse = Readonly<{
  assessment: MovementAssessmentResult;
  awardedXp: number;
  currentPlan: WorkoutPlan;
}>;

export type CurrentPlanResponse = Readonly<{
  plan: WorkoutPlan | null;
}>;

export type CreateWorkoutSessionRequest = Readonly<{
  idempotencyKey: string;
  clientSessionId: Uuid;
  lessonId: Uuid | null;
  planId: Uuid | null;
  planRevision: number | null;
  startedAt: IsoDateTime;
}>;

export type CreateWorkoutSessionResponse = Readonly<{
  workoutSessionId: Uuid;
  clientSessionId: Uuid;
  uploadRevision: number;
}>;

export type PutWorkoutResultsRequest = Readonly<{
  idempotencyKey: string;
  uploadRevision: number;
  results: readonly ExerciseResultSummary[];
}>;

export type PutWorkoutResultsResponse = Readonly<{
  workoutSessionId: Uuid;
  uploadRevision: number;
  acceptedResultCount: number;
}>;

export type CompleteWorkoutSessionRequest = Readonly<{
  idempotencyKey: string;
  uploadRevision: number;
  completedAt: IsoDateTime;
  perceivedDifficulty: number | null;
  painReported: boolean;
}>;

export type CompleteWorkoutSessionResponse = Readonly<{
  workoutSessionId: Uuid;
  awardedXp: number;
  xpEntries: readonly XpLedgerEntry[];
  masteryChanges: readonly SkillMastery[];
  planChanges: readonly PlanChange[];
  newlyUnlockedLessonIds: readonly Uuid[];
  currentPlanRevision: number;
}>;

export type SyncEventType =
  | "assessment.started"
  | "assessment.completed"
  | "workout.started"
  | "workout.results"
  | "workout.completed"
  | "profile.updated"
  | "consent.updated";

type SyncEventBase<EventType extends SyncEventType, Payload> = Readonly<{
  clientEventId: Uuid;
  idempotencyKey: string;
  type: EventType;
  occurredAt: IsoDateTime;
  payload: Payload;
}>;

export type SyncEventDto =
  | SyncEventBase<"assessment.started", CreateAssessmentRequest>
  | SyncEventBase<
      "assessment.completed",
      Readonly<{ assessmentId: Uuid; request: CompleteAssessmentRequest }>
    >
  | SyncEventBase<"workout.started", CreateWorkoutSessionRequest>
  | SyncEventBase<
      "workout.results",
      Readonly<{ workoutSessionId: Uuid; request: PutWorkoutResultsRequest }>
    >
  | SyncEventBase<
      "workout.completed",
      Readonly<{ workoutSessionId: Uuid; request: CompleteWorkoutSessionRequest }>
    >
  | SyncEventBase<"profile.updated", UpdateProfileRequest>
  | SyncEventBase<
      "consent.updated",
      Readonly<{ type: ConsentType; request: UpdateConsentRequest }>
    >;

export type SyncBatchRequest = Readonly<{
  deviceId: Uuid;
  events: readonly SyncEventDto[];
}>;

export type SyncEventResult = Readonly<{
  clientEventId: Uuid;
  status: "applied" | "duplicate" | "rejected";
  serverEventId?: Uuid;
  errorCode?: string;
  result?: unknown;
}>;

export type SyncBatchResponse = Readonly<{
  serverTime: IsoDateTime;
  results: readonly SyncEventResult[];
  authoritativeProgress: UserProgress;
  currentPlanRevision: number | null;
}>;
