import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { createCatalog } from '../catalog/catalog.seed';
import { APP_CONFIG, type AppConfig } from '../config';
import type {
  Assessment,
  AssessmentResult,
  Bootstrap,
  Consent,
  ExerciseResultInput,
  IdempotencyResult,
  Identity,
  Profile,
  Progress,
  SkillMastery,
  WorkoutCompletion,
  WorkoutPlan,
  WorkoutSession,
} from '../domain/domain.types';
import {
  PocketTrainerRepository,
  type CompleteWorkoutInput,
  type CreateWorkoutInput,
  type UpdateConsentInput,
  type UpdateProfileInput,
} from './pocket-trainer.repository';

type XpEntry = { points: number; eventType: 'assessment' | 'workout'; createdAt: string };
type UserState = {
  identity: Identity;
  profile: Profile | null;
  consents: Map<Consent['type'], Consent>;
  assessments: Map<string, Assessment>;
  plan: WorkoutPlan | null;
  workouts: Map<string, WorkoutSession>;
  xp: XpEntry[];
  completedLessons: Set<string>;
  mastery: Map<string, SkillMastery>;
  streakDays: Set<string>;
  achievements: Map<string, string>;
  processed: Map<string, { operation: string; payloadHash: string; value: unknown }>;
};

const DAILY_WORKOUT_XP_CAP = 500;
const XP_PER_LEVEL = 500;

function stableHash(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (typeof input === 'object' && input !== null) {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sort(child)]));
    }
    return input;
  };
  return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
}

function localDate(iso: string, timezone = 'Asia/Jakarta'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

@Injectable()
export class InMemoryPocketTrainerRepository extends PocketTrainerRepository {
  private readonly catalog;
  private readonly bySubject = new Map<string, string>();
  private readonly users = new Map<string, UserState>();

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.catalog = createCatalog(config.CONTENT_BASE_URL);
  }

  async close(): Promise<void> {}

  async resolveIdentity(authSubject: string): Promise<Identity> {
    const existingId = this.bySubject.get(authSubject);
    if (existingId) return this.requireUser(existingId).identity;
    const id = randomUUID();
    const identity: Identity = { id, authSubject, roles: ['USER'] };
    this.bySubject.set(authSubject, id);
    this.users.set(id, {
      identity,
      profile: null,
      consents: new Map(),
      assessments: new Map(),
      plan: null,
      workouts: new Map(),
      xp: [],
      completedLessons: new Set(),
      mastery: new Map(),
      streakDays: new Set(),
      achievements: new Map(),
      processed: new Map(),
    });
    return identity;
  }

  async getBootstrap(userId: string): Promise<Bootstrap> {
    const user = this.requireUser(userId);
    return {
      serverTime: new Date().toISOString(),
      profile: user.profile,
      consents: [...user.consents.values()],
      catalog: this.catalog,
      progress: this.buildProgress(user),
      currentPlan: user.plan,
    };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.requireUser(userId).profile;
  }

  async updateProfile(userId: string, key: string, input: UpdateProfileInput): Promise<IdempotencyResult<Profile>> {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, 'profile.update', input, () => {
      const profile = { ...input, updatedAt: new Date().toISOString() };
      user.profile = profile;
      return profile;
    });
  }

  async getConsents(userId: string): Promise<Consent[]> {
    return [...this.requireUser(userId).consents.values()];
  }

  async updateConsent(userId: string, type: Consent['type'], key: string, input: UpdateConsentInput): Promise<IdempotencyResult<Consent>> {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, `consent.${type}.update`, input, () => {
      const consent: Consent = { type, ...input, updatedAt: new Date().toISOString() };
      user.consents.set(type, consent);
      return consent;
    });
  }

  async getCatalog() { return this.catalog; }

  async getCourse(userId: string, courseId: string) {
    const course = this.catalog.tracks.flatMap((track) => track.courses).find((item) => item.id === courseId || item.slug === courseId);
    if (!course) return null;
    const user = this.requireUser(userId);
    const progress = this.buildProgress(user);
    const lessonStates = Object.fromEntries(course.units.flatMap((unit) => unit.lessons).map((lesson) => [lesson.id, this.lessonState(lesson, progress, user.profile)]));
    return { course, lessonStates };
  }

  async getProgress(userId: string): Promise<Progress> {
    return this.buildProgress(this.requireUser(userId));
  }

  async createAssessment(userId: string, key: string): Promise<IdempotencyResult<Assessment>> {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, 'assessment.create', {}, () => {
      const assessment: Assessment = { id: randomUUID(), status: 'in_progress', assessmentVersion: '1.0.0', startedAt: new Date().toISOString() };
      user.assessments.set(assessment.id, assessment);
      return assessment;
    });
  }

  async completeAssessment(userId: string, assessmentId: string, key: string, result: AssessmentResult) {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, 'assessment.complete', { assessmentId, result }, () => {
      const assessment = user.assessments.get(assessmentId);
      if (!assessment) throw new ApiError('ASSESSMENT_NOT_FOUND', 'Assessment was not found.', HttpStatus.NOT_FOUND);
      if (assessment.status === 'completed') throw new ApiError('ASSESSMENT_ALREADY_COMPLETED', 'This assessment is already complete.', HttpStatus.CONFLICT);
      const completed: Assessment = { ...assessment, status: 'completed', completedAt: new Date().toISOString(), result };
      user.assessments.set(assessmentId, completed);
      user.xp.push({ points: 75, eventType: 'assessment', createdAt: completed.completedAt! });
      for (const restriction of result.restrictions) {
        const existing = user.mastery.get(restriction) ?? this.emptyMastery(restriction);
        user.mastery.set(restriction, { ...existing, restricted: true, updatedAt: completed.completedAt! });
      }
      const firstLessons = this.catalog.tracks.map((track) => track.courses[0]!.units[0]!.lessons[0]!.id);
      const currentPlan: WorkoutPlan = {
        id: randomUUID(), revision: 1, status: 'active', generatedAt: completed.completedAt!, lessonIds: firstLessons,
        reason: { id: 'Dibuat dari hasil asesmen gerak Anda.', en: 'Generated from your movement assessment.' },
      };
      user.plan = currentPlan;
      return { assessment: completed, xpAwarded: 75, currentPlan };
    });
  }

  async getCurrentPlan(userId: string): Promise<WorkoutPlan | null> {
    return this.requireUser(userId).plan;
  }

  async createWorkout(userId: string, key: string, input: CreateWorkoutInput) {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, 'workout.create', input, () => {
      if (!this.findLesson(input.lessonId)) throw new ApiError('LESSON_NOT_FOUND', 'Lesson was not found.', HttpStatus.NOT_FOUND);
      const session: WorkoutSession = { id: randomUUID(), lessonId: input.lessonId, status: 'in_progress', startedAt: input.startedAt, results: [] };
      user.workouts.set(session.id, session);
      return session;
    });
  }

  async saveWorkoutResults(userId: string, sessionId: string, key: string, results: ExerciseResultInput[]) {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, 'workout.results', { sessionId, results }, () => {
      const session = this.requireWorkout(user, sessionId);
      if (session.status !== 'in_progress') throw new ApiError('WORKOUT_NOT_ACTIVE', 'Workout results cannot be changed after completion.', HttpStatus.CONFLICT);
      const byId = new Map(session.results.map((result) => [result.clientResultId, result]));
      for (const result of results) byId.set(result.clientResultId, result);
      session.results = [...byId.values()];
      return session;
    });
  }

  async completeWorkout(userId: string, sessionId: string, key: string, input: CompleteWorkoutInput): Promise<IdempotencyResult<WorkoutCompletion>> {
    const user = this.requireUser(userId);
    return this.idempotent(user, key, 'workout.complete', { sessionId, input }, () => {
      const session = this.requireWorkout(user, sessionId);
      if (session.status !== 'in_progress') throw new ApiError('WORKOUT_ALREADY_COMPLETED', 'This workout has already been completed.', HttpStatus.CONFLICT);
      if (session.results.length === 0) throw new ApiError('WORKOUT_RESULTS_REQUIRED', 'Upload at least one exercise result before completion.', HttpStatus.UNPROCESSABLE_ENTITY, true);

      const eligible = session.results.filter((result) => result.trackingEligible && result.formScore !== undefined);
      const averageForm = eligible.length ? eligible.reduce((sum, result) => sum + result.formScore!, 0) / eligible.length : null;
      const averageCompletion = session.results.reduce((sum, result) => sum + result.completionScore, 0) / session.results.length;
      const progressionSuppressed = input.painReported || eligible.length !== session.results.length || averageForm === null;
      const before = this.unlockedLessons(user);
      const masteryChanges: SkillMastery[] = [];

      if (input.painReported) {
        for (const result of session.results) {
          const exercise = this.catalog.exercises.find((item) => item.id === result.exerciseDefinitionId);
          if (!exercise) continue;
          const existing = user.mastery.get(exercise.exerciseKey) ?? this.emptyMastery(exercise.exerciseKey);
          const changed = { ...existing, restricted: true, updatedAt: input.completedAt };
          user.mastery.set(exercise.exerciseKey, changed);
          masteryChanges.push(changed);
        }
      } else if (!progressionSuppressed && averageForm >= 85 && averageCompletion >= 90 && input.perceivedDifficulty <= 6) {
        for (const result of session.results) {
          const exercise = this.catalog.exercises.find((item) => item.id === result.exerciseDefinitionId);
          if (!exercise || result.formScore === undefined) continue;
          const existing = user.mastery.get(exercise.exerciseKey) ?? this.emptyMastery(exercise.exerciseKey);
          const changed: SkillMastery = {
            ...existing,
            bestFormScore: Math.max(existing.bestFormScore, Math.round(result.formScore)),
            qualifyingSessions: existing.qualifyingSessions + 1,
            mastered: existing.qualifyingSessions + 1 >= 2,
            updatedAt: input.completedAt,
          };
          user.mastery.set(exercise.exerciseKey, changed);
          masteryChanges.push(changed);
        }
      }

      if (!input.painReported && averageCompletion >= 90) user.completedLessons.add(session.lessonId);
      const lesson = this.findLesson(session.lessonId)!;
      const requestedXp = input.painReported ? 0 : lesson.xpReward + (averageForm !== null && averageForm >= 90 ? 20 : 0);
      const day = localDate(input.completedAt, user.profile?.timezone);
      const earnedToday = user.xp.filter((entry) => entry.eventType === 'workout' && localDate(entry.createdAt, user.profile?.timezone) === day).reduce((sum, entry) => sum + entry.points, 0);
      const xpAwarded = Math.max(0, Math.min(requestedXp, DAILY_WORKOUT_XP_CAP - earnedToday));
      if (xpAwarded > 0) user.xp.push({ points: xpAwarded, eventType: 'workout', createdAt: input.completedAt });
      user.streakDays.add(day);
      if (user.completedLessons.size >= 1 && !user.achievements.has('first_step')) user.achievements.set('first_step', input.completedAt);

      const newStatus: WorkoutSession['status'] = input.painReported ? 'stopped_for_safety' : 'completed';
      const after = this.unlockedLessons(user);
      const totalXp = user.xp.reduce((sum, entry) => sum + entry.points, 0);
      const completion: WorkoutCompletion = {
        xpAwarded,
        xpCapped: xpAwarded < requestedXp,
        totalXp,
        level: Math.floor(totalXp / XP_PER_LEVEL) + 1,
        masteryChanges,
        newlyUnlockedLessonIds: [...after].filter((id) => !before.has(id)),
        planRevision: user.plan?.revision ?? 0,
        progressionSuppressed,
        ...(input.painReported ? { safetyMessage: { id: 'Hentikan latihan ini. Pilih variasi yang lebih ringan dan cari bantuan profesional bila nyeri berlanjut.', en: 'Stop this exercise. Choose a safer variation and seek professional help if pain continues.' } } : {}),
      };
      user.workouts.set(sessionId, { ...session, status: newStatus, completedAt: input.completedAt, summary: completion });
      return completion;
    });
  }

  private requireUser(userId: string): UserState {
    const user = this.users.get(userId);
    if (!user) throw new ApiError('USER_NOT_FOUND', 'User was not found.', HttpStatus.NOT_FOUND);
    return user;
  }

  private requireWorkout(user: UserState, sessionId: string): WorkoutSession {
    const workout = user.workouts.get(sessionId);
    if (!workout) throw new ApiError('WORKOUT_NOT_FOUND', 'Workout was not found.', HttpStatus.NOT_FOUND);
    return workout;
  }

  private idempotent<T>(user: UserState, key: string, operation: string, payload: unknown, action: () => T): IdempotencyResult<T> {
    const payloadHash = stableHash(payload);
    const existing = user.processed.get(key);
    if (existing) {
      if (existing.operation !== operation || existing.payloadHash !== payloadHash) {
        throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request.', HttpStatus.CONFLICT);
      }
      return { replayed: true, value: existing.value as T };
    }
    const value = action();
    user.processed.set(key, { operation, payloadHash, value });
    return { replayed: false, value };
  }

  private buildProgress(user: UserState): Progress {
    const now = new Date().toISOString();
    const today = localDate(now, user.profile?.timezone);
    const total = user.xp.reduce((sum, entry) => sum + entry.points, 0);
    const todayXp = user.xp.filter((entry) => localDate(entry.createdAt, user.profile?.timezone) === today).reduce((sum, entry) => sum + entry.points, 0);
    const streak = this.calculateStreak(user.streakDays, today);
    return {
      xp: { total, today: todayXp, dailyCap: DAILY_WORKOUT_XP_CAP, level: Math.floor(total / XP_PER_LEVEL) + 1, currentLevelXp: total % XP_PER_LEVEL, nextLevelXp: XP_PER_LEVEL },
      streak: { current: streak, longest: streak, todayStatus: user.streakDays.has(today) ? 'active' : 'open' },
      completedLessonIds: [...user.completedLessons],
      mastery: [...user.mastery.values()],
      achievements: [...user.achievements].map(([key, unlockedAt]) => ({ key, unlockedAt })),
    };
  }

  private calculateStreak(days: Set<string>, today: string): number {
    let count = 0;
    const cursor = new Date(`${today}T12:00:00Z`);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      count += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return count;
  }

  private emptyMastery(exerciseKey: string): SkillMastery {
    return { exerciseKey, bestFormScore: 0, qualifyingSessions: 0, mastered: false, restricted: false, updatedAt: new Date(0).toISOString() };
  }

  private findLesson(id: string) {
    return this.catalog.tracks.flatMap((track) => track.courses).flatMap((course) => course.units).flatMap((unit) => unit.lessons).find((lesson) => lesson.id === id);
  }

  private lessonState(lesson: ReturnType<InMemoryPocketTrainerRepository['findLesson']> & {}, progress: Progress, profile: Profile | null): string {
    if (progress.completedLessonIds.includes(lesson.id)) return 'completed';
    if (lesson.requirements.requiredEquipment.some((equipment) => !profile?.equipment.includes(equipment))) return 'gated_equipment';
    if (lesson.requirements.prerequisiteLessonIds.some((id) => !progress.completedLessonIds.includes(id))) return 'locked_prerequisite';
    if (lesson.requirements.requiredMasteryKeys.some((key) => !progress.mastery.some((item) => item.exerciseKey === key && item.mastered && !item.restricted))) return 'locked_mastery';
    if (progress.xp.level < lesson.requirements.minimumLevel) return 'locked_level';
    return 'available';
  }

  private unlockedLessons(user: UserState): Set<string> {
    const progress = this.buildProgress(user);
    return new Set(this.catalog.tracks.flatMap((track) => track.courses).flatMap((course) => course.units).flatMap((unit) => unit.lessons).filter((lesson) => this.lessonState(lesson, progress, user.profile) === 'available').map((lesson) => lesson.id));
  }
}
