import type {
  Assessment,
  AssessmentResult,
  Bootstrap,
  Catalog,
  Consent,
  Course,
  ExerciseResultInput,
  IdempotencyResult,
  Identity,
  Profile,
  Progress,
  PrivacyDeletion,
  PrivacyExport,
  WorkoutCompletion,
  WorkoutPlan,
  WorkoutSession,
} from '../domain/domain.types';

export type UpdateProfileInput = Omit<Profile, 'updatedAt'>;
export type UpdateConsentInput = Pick<Consent, 'granted' | 'version'>;

export type CreateWorkoutInput = {
  lessonId: string;
  startedAt: string;
  deviceId?: string | undefined;
  applicationVersion: string;
};

export type CompleteWorkoutInput = {
  completedAt: string;
  perceivedDifficulty: number;
  painReported: boolean;
};

export abstract class PocketTrainerRepository {
  abstract close(): Promise<void>;
  abstract ping(): Promise<boolean>;
  abstract processOutboxBatch(): Promise<number>;
  abstract resolveIdentity(authSubject: string): Promise<Identity>;
  abstract getBootstrap(userId: string): Promise<Bootstrap>;
  abstract getProfile(userId: string): Promise<Profile | null>;
  abstract updateProfile(userId: string, key: string, input: UpdateProfileInput): Promise<IdempotencyResult<Profile>>;
  abstract getConsents(userId: string): Promise<Consent[]>;
  abstract updateConsent(userId: string, type: Consent['type'], key: string, input: UpdateConsentInput): Promise<IdempotencyResult<Consent>>;
  abstract getCatalog(): Promise<Catalog>;
  abstract getCourse(userId: string, courseId: string): Promise<{ course: Course; lessonStates: Record<string, string> } | null>;
  abstract getProgress(userId: string): Promise<Progress>;
  abstract getPrivacyExport(userId: string): Promise<PrivacyExport>;
  abstract deleteAccount(userId: string, key: string): Promise<IdempotencyResult<PrivacyDeletion>>;
  abstract createAssessment(userId: string, key: string): Promise<IdempotencyResult<Assessment>>;
  abstract completeAssessment(userId: string, assessmentId: string, key: string, result: AssessmentResult): Promise<IdempotencyResult<{ assessment: Assessment; xpAwarded: number; currentPlan: WorkoutPlan }>>;
  abstract getCurrentPlan(userId: string): Promise<WorkoutPlan | null>;
  abstract createWorkout(userId: string, key: string, input: CreateWorkoutInput): Promise<IdempotencyResult<WorkoutSession>>;
  abstract saveWorkoutResults(userId: string, sessionId: string, key: string, results: ExerciseResultInput[]): Promise<IdempotencyResult<WorkoutSession>>;
  abstract completeWorkout(userId: string, sessionId: string, key: string, input: CompleteWorkoutInput): Promise<IdempotencyResult<WorkoutCompletion>>;
}
