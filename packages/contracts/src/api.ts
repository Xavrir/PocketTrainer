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
  Omit<UserProfileDto, "userId" | "updatedAt" | "onboardingCompleted">
>;

export type IdempotentMutation<RequestBody> = Readonly<{
  idempotencyKey: string;
  body: RequestBody;
}>;

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
  uploadRevision: number;
  results: readonly ExerciseResultSummary[];
}>;

export type PutWorkoutResultsResponse = Readonly<{
  workoutSessionId: Uuid;
  uploadRevision: number;
  acceptedResultCount: number;
}>;

export type CompleteWorkoutSessionRequest = Readonly<{
  uploadRevision: number;
  completedAt: IsoDateTime;
  stopReason: "completed" | "pain_reported" | "tracking_unavailable" | "user_stopped";
}>;

export type UpdateProfileMutation = IdempotentMutation<UpdateProfileRequest>;
export type UpdateConsentMutation = IdempotentMutation<UpdateConsentRequest>;
export type CreateAssessmentMutation = IdempotentMutation<CreateAssessmentRequest>;
export type CompleteAssessmentMutation = IdempotentMutation<CompleteAssessmentRequest>;
export type CreateWorkoutSessionMutation = IdempotentMutation<CreateWorkoutSessionRequest>;
export type PutWorkoutResultsMutation = IdempotentMutation<PutWorkoutResultsRequest>;
export type CompleteWorkoutSessionMutation = IdempotentMutation<CompleteWorkoutSessionRequest>;

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

type AppliedSyncEventResult<EventType extends SyncEventType, Result> = Readonly<{
  clientEventId: Uuid;
  type: EventType;
  status: "applied" | "duplicate";
  serverEventId: Uuid;
  result: Result;
}>;

type RejectedSyncEventResult = Readonly<{
  clientEventId: Uuid;
  type: SyncEventType;
  status: "rejected";
  errorCode: string;
}>;

export type SyncEventResult =
  | AppliedSyncEventResult<"assessment.started", CreateAssessmentResponse>
  | AppliedSyncEventResult<"assessment.completed", CompleteAssessmentResponse>
  | AppliedSyncEventResult<"workout.started", CreateWorkoutSessionResponse>
  | AppliedSyncEventResult<"workout.results", PutWorkoutResultsResponse>
  | AppliedSyncEventResult<"workout.completed", CompleteWorkoutSessionResponse>
  | AppliedSyncEventResult<"profile.updated", UserProfileDto>
  | AppliedSyncEventResult<"consent.updated", ConsentDto>
  | RejectedSyncEventResult;

export type SyncBatchResponse = Readonly<{
  serverTime: IsoDateTime;
  results: readonly SyncEventResult[];
  authoritativeProgress: UserProgress;
  currentPlanRevision: number | null;
}>;
