import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { ApiError } from '../common/api-error';
import { createCatalog } from '../catalog/catalog.seed';
import { APP_CONFIG, type AppConfig } from '../config';
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
  SkillMastery,
  WorkoutCompletion,
  WorkoutPlan,
  WorkoutSession,
} from '../domain/domain.types';
import { calculateStreakCounts } from '../domain/progress-policy';
import {
  accessContext,
  canonicalizeWorkoutResults,
  evaluateLessonAccess,
  evaluateWorkoutResults,
  findCanonicalWorkout,
  isLessonLaunchable,
  launchableLessonIds,
  validateWorkoutResults,
  type CanonicalWorkout,
  type LessonAccessContext,
} from '../domain/workout-policy';
import {
  PocketTrainerRepository,
  type CompleteWorkoutInput,
  type CreateWorkoutInput,
  type UpdateConsentInput,
  type UpdateProfileInput,
} from './pocket-trainer.repository';

const XP_PER_LEVEL = 500;
const DAILY_WORKOUT_XP_CAP = 500;

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

function localDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function asObject<T>(value: unknown): T {
  return value as T;
}

@Injectable()
export class PostgresPocketTrainerRepository extends PocketTrainerRepository implements OnApplicationShutdown {
  private readonly pool: Pool;
  private readonly fallbackCatalog: Catalog;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    if (!config.DATABASE_URL) throw new Error('DATABASE_URL is required for the PostgreSQL repository.');
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: config.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
      application_name: 'pockettrainer-api',
    });
    this.fallbackCatalog = createCatalog(config.CONTENT_BASE_URL);
  }

  async onApplicationShutdown(): Promise<void> { await this.close(); }
  async close(): Promise<void> { await this.pool.end(); }
  async ping(): Promise<boolean> { const result = await this.pool.query<{ ok: number }>('select 1 as ok'); return result.rows[0]?.ok === 1; }
  async processOutboxBatch(): Promise<number> {
    const result = await this.pool.query<{ processed_count: number }>('select process_outbox_batch(50) as processed_count');
    return Number(result.rows[0]?.processed_count ?? 0);
  }

  async resolveIdentity(authSubject: string): Promise<Identity> {
    const result = await this.pool.query<{ user_id: string }>('select user_id from resolve_auth_identity($1)', [authSubject]);
    const row = result.rows[0];
    if (!row) throw new ApiError('AUTH_IDENTITY_REJECTED', 'The authenticated identity is not active.', HttpStatus.UNAUTHORIZED, true);
    return { id: row.user_id, authSubject, roles: ['USER'] };
  }

  async getBootstrap(userId: string): Promise<Bootstrap> {
    const [profile, consents, catalog, progress, currentPlan] = await Promise.all([
      this.getProfile(userId), this.getConsents(userId), this.getCatalog(), this.getProgress(userId), this.getCurrentPlan(userId),
    ]);
    return { serverTime: new Date().toISOString(), profile, consents, catalog, progress, currentPlan };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.readUser(userId, async (client) => {
      const result = await client.query(`select display_name, locale, timezone, primary_goal, experience_level,
        equipment, limitations, schedule_days, session_duration_minutes, onboarding_completed, updated_at
        from profiles where user_id = $1`, [userId]);
      const row = result.rows[0] as QueryResultRow | undefined;
      return row ? this.mapProfile(row) : null;
    });
  }

  async updateProfile(userId: string, key: string, input: UpdateProfileInput): Promise<IdempotencyResult<Profile>> {
    return this.idempotent(userId, key, 'profile.update', input, async (client) => {
      const result = await client.query(`insert into profiles
        (user_id, display_name, locale, timezone, primary_goal, experience_level, equipment, limitations,
         schedule_days, session_duration_minutes, onboarding_completed)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (user_id) do update set display_name=excluded.display_name, locale=excluded.locale,
          timezone=excluded.timezone, primary_goal=excluded.primary_goal, experience_level=excluded.experience_level,
          equipment=excluded.equipment, limitations=excluded.limitations, schedule_days=excluded.schedule_days,
          session_duration_minutes=excluded.session_duration_minutes,
          onboarding_completed=excluded.onboarding_completed, updated_at=now()
        returning display_name, locale, timezone, primary_goal, experience_level, equipment, limitations,
          schedule_days, session_duration_minutes, onboarding_completed, updated_at`,
      [userId, input.displayName, input.locale, input.timezone, input.primaryGoal, input.experienceLevel,
        input.equipment, input.limitations, input.schedule.days, input.schedule.durationMinutes, input.onboardingCompleted]);
      return this.mapProfile(result.rows[0]!);
    });
  }

  async getConsents(userId: string): Promise<Consent[]> {
    return this.readUser(userId, async (client) => {
      const result = await client.query('select consent_type, granted, version, updated_at from consents where user_id=$1 order by consent_type', [userId]);
      return result.rows.map((row) => this.mapConsent(row));
    });
  }

  async updateConsent(userId: string, type: Consent['type'], key: string, input: UpdateConsentInput): Promise<IdempotencyResult<Consent>> {
    return this.idempotent(userId, key, `consent.${type}.update`, input, async (client) => {
      const result = await client.query(`insert into consents (user_id, consent_type, granted, version)
        values ($1,$2,$3,$4) on conflict (user_id, consent_type) do update
        set granted=excluded.granted, version=excluded.version, updated_at=now()
        returning consent_type, granted, version, updated_at`, [userId, type, input.granted, input.version]);
      await client.query(`insert into outbox_events (user_id, aggregate_type, aggregate_id, event_type, payload)
        values ($1,'user',$1,'ConsentChanged',$2)`, [userId, JSON.stringify({ type, granted: input.granted, version: input.version })]);
      return this.mapConsent(result.rows[0]!);
    });
  }

  async getCatalog(): Promise<Catalog> {
    const version = await this.pool.query<{ version: number; published_at: Date }>(`select version, published_at from catalog_versions where status='published' order by version desc limit 1`);
    if (!version.rows[0]) return this.fallbackCatalog;
    const result = await this.pool.query<{ manifest: Catalog }>('select build_catalog_manifest($1) as manifest', [version.rows[0].version]);
    return result.rows[0]?.manifest ?? this.fallbackCatalog;
  }

  async getCourse(userId: string, courseId: string): Promise<{ course: Course; lessonStates: Record<string, string> } | null> {
    const catalog = await this.getCatalog();
    const course = catalog.tracks.flatMap((track) => track.courses).find((item) => item.id === courseId || item.slug === courseId);
    if (!course) return null;
    const [progress, profile] = await Promise.all([this.getProgress(userId), this.getProfile(userId)]);
    const context = accessContext(progress, profile);
    const lessonStates = Object.fromEntries(course.units.flatMap((unit) => unit.lessons).map((lesson) => [lesson.id, evaluateLessonAccess(lesson, context)]));
    return { course, lessonStates };
  }

  async getProgress(userId: string): Promise<Progress> {
    return this.readUser(userId, (client) => this.readProgress(client, userId));
  }

  async getPrivacyExport(userId: string): Promise<PrivacyExport> {
    return this.readUser(userId, async (client) => {
      const profile = await this.getProfileFromClient(client, userId);
      const consentsResult = await client.query('select consent_type, granted, version, updated_at from consents where user_id=$1 order by consent_type', [userId]);
      const assessmentsResult = await client.query('select id, status, assessment_version, started_at, completed_at, result from assessment_sessions where user_id=$1 order by started_at', [userId]);
      const planResult = await client.query('select id,revision,status,generated_at,reason,lesson_ids from workout_plans where user_id=$1 and status=\'active\' order by revision desc limit 1');
      const sessionsResult = await client.query('select id,lesson_id,status,started_at,completed_at from workout_sessions where user_id=$1 order by started_at', [userId]);
      const workouts: WorkoutSession[] = [];
      for (const row of sessionsResult.rows) {
        const results = await client.query('select * from exercise_results where workout_session_id=$1 order by set_number,created_at', [row.id]);
        workouts.push(this.mapWorkout(row, results.rows.map((result) => this.mapExerciseResult(result))));
      }
      return {
        formatVersion: 1,
        generatedAt: new Date().toISOString(),
        user: { id: userId, authSubject: 'supabase-subject-redacted' },
        profile,
        consents: consentsResult.rows.map((row) => this.mapConsent(row)),
        assessments: assessmentsResult.rows.map((row) => this.mapAssessment(row)),
        currentPlan: planResult.rows[0] ? this.mapPlan(planResult.rows[0]) : null,
        progress: await this.readProgress(client, userId),
        workouts,
        manifest: {
          includes: ['profile', 'consents', 'assessments', 'currentPlan', 'progress', 'workouts'],
          excludes: ['raw_camera_frames', 'pose_landmarks', 'access_tokens'],
        },
      };
    });
  }

  async deleteAccount(userId: string, key: string): Promise<IdempotencyResult<PrivacyDeletion>> {
    return this.idempotent(userId, key, 'privacy.account.delete', {}, async (client) => {
      const completedAt = new Date().toISOString();
      const manifest = {
        deleted: ['profile', 'consents', 'assessments', 'plans', 'workouts', 'progress', 'idempotency_records'],
        retained: ['account_deletion_audit_marker', 'supabase_identity_tombstone'],
      };
      await client.query(`insert into privacy_action_log (user_id, action, idempotency_key, manifest)
        values ($1,'account_deleted',$2,$3) on conflict (user_id,action) do nothing`, [userId, key, JSON.stringify(manifest)]);
      await client.query('delete from exercise_results where user_id=$1', [userId]);
      await client.query('delete from lesson_attempts where user_id=$1', [userId]);
      await client.query('delete from workout_sessions where user_id=$1', [userId]);
      await client.query('delete from workout_plans where user_id=$1', [userId]);
      await client.query('delete from assessment_sessions where user_id=$1', [userId]);
      for (const table of ['user_course_progress', 'skill_mastery', 'unlock_events', 'xp_ledger', 'streak_days', 'user_achievements', 'outbox_events', 'processed_client_events', 'devices', 'consents', 'profiles']) {
        await client.query(`delete from ${table} where user_id=$1`, [userId]);
      }
      await client.query("update users set status='deleted', deleted_at=$2, updated_at=now() where id=$1", [userId, completedAt]);
      return { action: 'account_deleted', completedAt, manifest };
    });
  }

  private async readProgress(client: PoolClient, userId: string): Promise<Progress> {
      const [xpResult, profileResult, completedResult, masteryResult, streakResult, achievementsResult] = await Promise.all([
        client.query<{ total: string }>('select coalesce(sum(points),0)::text as total from xp_ledger where user_id=$1', [userId]),
        client.query<{ timezone: string }>("select coalesce((select timezone from profiles where user_id=$1),'Asia/Jakarta') as timezone", [userId]),
        client.query<{ lesson_id: string }>('select lesson_id from lesson_attempts where user_id=$1 and completed=true', [userId]),
        client.query('select exercise_key, best_form_score, qualifying_sessions, mastered, restricted, updated_at from skill_mastery where user_id=$1 order by exercise_key', [userId]),
        client.query<{ local_date: string; status: string }>('select local_date::text, status from streak_days where user_id=$1 order by local_date desc', [userId]),
        client.query<{ achievement_key: string; unlocked_at: Date }>('select achievement_key, unlocked_at from user_achievements where user_id=$1 order by unlocked_at', [userId]),
      ]);
      const total = Number(xpResult.rows[0]?.total ?? 0);
      const timezone = profileResult.rows[0]?.timezone ?? 'Asia/Jakarta';
      const today = localDate(new Date().toISOString(), timezone);
      const todayXpResult = await client.query<{ total: string }>('select coalesce(sum(points),0)::text as total from xp_ledger where user_id=$1 and local_date=$2', [userId, today]);
      const days = new Set(streakResult.rows.filter((row) => row.status !== 'missed').map((row) => row.local_date));
      const streak = calculateStreakCounts(days, today);
      return {
        xp: { total, today: Number(todayXpResult.rows[0]?.total ?? 0), dailyCap: DAILY_WORKOUT_XP_CAP, level: Math.floor(total / XP_PER_LEVEL) + 1, currentLevelXp: total % XP_PER_LEVEL, nextLevelXp: XP_PER_LEVEL },
        streak: { current: streak.current, longest: streak.longest, todayStatus: days.has(today) ? 'active' : 'open' },
        completedLessonIds: completedResult.rows.map((row) => row.lesson_id),
        mastery: masteryResult.rows.map((row) => this.mapMastery(row)),
        achievements: achievementsResult.rows.map((row) => ({ key: row.achievement_key, unlockedAt: row.unlocked_at.toISOString() })),
      };
  }

  private async getProfileFromClient(client: PoolClient, userId: string): Promise<Profile | null> {
    const result = await client.query(`select display_name, locale, timezone, primary_goal, experience_level,
      equipment, limitations, schedule_days, session_duration_minutes, onboarding_completed, updated_at
      from profiles where user_id = $1`, [userId]);
    const row = result.rows[0] as QueryResultRow | undefined;
    return row ? this.mapProfile(row) : null;
  }

  async createAssessment(userId: string, key: string): Promise<IdempotencyResult<Assessment>> {
    return this.idempotent(userId, key, 'assessment.create', {}, async (client) => {
      const result = await client.query(`insert into assessment_sessions (user_id, assessment_version, status)
        values ($1,'1.0.0','in_progress') returning id, status, assessment_version, started_at`, [userId]);
      return this.mapAssessment(result.rows[0]!);
    });
  }

  async completeAssessment(userId: string, assessmentId: string, key: string, input: AssessmentResult) {
    return this.idempotent(userId, key, 'assessment.complete', { assessmentId, input }, async (client) => {
      const result = await client.query(`update assessment_sessions set status='completed', completed_at=now(), result=$3
        where id=$1 and user_id=$2 and status='in_progress'
        returning id, status, assessment_version, started_at, completed_at, result`, [assessmentId, userId, JSON.stringify(input)]);
      const row = result.rows[0];
      if (!row) {
        const existing = await client.query('select status from assessment_sessions where id=$1 and user_id=$2', [assessmentId, userId]);
        throw new ApiError(existing.rows[0] ? 'ASSESSMENT_ALREADY_COMPLETED' : 'ASSESSMENT_NOT_FOUND', existing.rows[0] ? 'This assessment is already complete.' : 'Assessment was not found.', existing.rows[0] ? HttpStatus.CONFLICT : HttpStatus.NOT_FOUND);
      }
      const completedAt = (row.completed_at as Date).toISOString();
      const timezone = await this.userTimezone(client, userId);
      await client.query(`insert into xp_ledger (user_id,event_type,event_id,points,idempotency_key,local_date)
        values ($1,'ASSESSMENT_COMPLETED',$2,75,$3,$4) on conflict (user_id,idempotency_key) do nothing`, [userId, assessmentId, key, localDate(completedAt, timezone)]);
      for (const restriction of input.restrictions) {
        await client.query(`insert into skill_mastery (user_id,exercise_key,restricted)
          values ($1,$2,true) on conflict (user_id,exercise_key) do update set restricted=true,updated_at=now()`, [userId, restriction]);
      }
      const lessonIds = this.fallbackCatalog.tracks.map((track) => track.courses[0]!.units[0]!.lessons[0]!.id);
      await client.query("update workout_plans set status='superseded', updated_at=now() where user_id=$1 and status='active'", [userId]);
      const planResult = await client.query(`insert into workout_plans (user_id,revision,status,reason,lesson_ids,assessment_session_id)
        select $1,coalesce(max(revision),0)+1,'active',$2,$3,$4 from workout_plans where user_id=$1
        returning id,revision,status,generated_at,reason,lesson_ids`, [userId, JSON.stringify({ id: 'Dibuat dari hasil asesmen gerak Anda.', en: 'Generated from your movement assessment.' }), lessonIds, assessmentId]);
      await client.query(`insert into outbox_events (user_id,aggregate_type,aggregate_id,event_type,payload)
        values ($1,'assessment',$2,'AssessmentCompleted',$3)`, [userId, assessmentId, JSON.stringify({ userId, recommendedLevel: input.recommendedLevel })]);
      return { assessment: this.mapAssessment(row), xpAwarded: 75, currentPlan: this.mapPlan(planResult.rows[0]!) };
    });
  }

  async getCurrentPlan(userId: string): Promise<WorkoutPlan | null> {
    return this.readUser(userId, async (client) => {
      const result = await client.query(`select id,revision,status,generated_at,reason,lesson_ids from workout_plans
        where user_id=$1 and status='active' order by revision desc limit 1`, [userId]);
      return result.rows[0] ? this.mapPlan(result.rows[0]) : null;
    });
  }

  async createWorkout(userId: string, key: string, input: CreateWorkoutInput): Promise<IdempotencyResult<WorkoutSession>> {
    return this.idempotent(userId, key, 'workout.create', input, async (client) => {
      const canonical = findCanonicalWorkout(this.fallbackCatalog, input.lessonId);
      if (!canonical) throw new ApiError('LESSON_NOT_FOUND', 'Lesson was not found.', HttpStatus.NOT_FOUND);
      const accessState = evaluateLessonAccess(canonical.lesson, await this.loadAccessContext(client, userId));
      if (!isLessonLaunchable(accessState)) {
        throw new ApiError('LESSON_NOT_LAUNCHABLE', 'This lesson is not currently launchable.', HttpStatus.CONFLICT, true, { accessState });
      }
      const result = await client.query(`insert into workout_sessions
        (user_id,lesson_id,status,started_at,device_id,application_version,client_idempotency_key)
        values ($1,$2,'in_progress',$3,$4,$5,$6)
        returning id,lesson_id,status,started_at,completed_at`, [userId, input.lessonId, input.startedAt, input.deviceId ?? null, input.applicationVersion, key]);
      return this.mapWorkout(result.rows[0], []);
    });
  }

  async saveWorkoutResults(userId: string, sessionId: string, key: string, results: ExerciseResultInput[]): Promise<IdempotencyResult<WorkoutSession>> {
    return this.idempotent(userId, key, 'workout.results', { sessionId, results }, async (client) => {
      const sessionResult = await client.query('select id,lesson_id,status,started_at,completed_at from workout_sessions where id=$1 and user_id=$2 for update', [sessionId, userId]);
      const session = sessionResult.rows[0];
      if (!session) throw new ApiError('WORKOUT_NOT_FOUND', 'Workout was not found.', HttpStatus.NOT_FOUND);
      if (session.status !== 'in_progress') throw new ApiError('WORKOUT_NOT_ACTIVE', 'Workout results cannot be changed after completion.', HttpStatus.CONFLICT);
      const canonical = this.requireCanonicalWorkout(String(session.lesson_id));
      this.assertCanonicalResults(canonical, results);
      for (const result of canonicalizeWorkoutResults(canonical, results)) {
        await client.query(`insert into exercise_results
          (user_id,workout_session_id,client_result_id,exercise_definition_id,exercise_definition_version,
           scoring_version,pose_model_version,set_number,total_reps,valid_reps,form_score,completion_score,
           control_score,consistency_score,main_feedback_code,tracking_eligible,duration_ms)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          on conflict (workout_session_id,client_result_id) do update
          set exercise_definition_id=excluded.exercise_definition_id,
            exercise_definition_version=excluded.exercise_definition_version,
            scoring_version=excluded.scoring_version,pose_model_version=excluded.pose_model_version,
            set_number=excluded.set_number,total_reps=excluded.total_reps,
            valid_reps=excluded.valid_reps,form_score=excluded.form_score,completion_score=excluded.completion_score,
            control_score=excluded.control_score,consistency_score=excluded.consistency_score,
            main_feedback_code=excluded.main_feedback_code,tracking_eligible=excluded.tracking_eligible,
            duration_ms=excluded.duration_ms`,
        [userId, sessionId, result.clientResultId, result.exerciseDefinitionId, result.exerciseDefinitionVersion,
          result.scoringVersion, result.poseModelVersion, result.setNumber, result.totalReps, result.validReps,
          result.formScore ?? null, result.completionScore, result.controlScore, result.consistencyScore,
          result.mainFeedbackCode ?? null, result.trackingEligible, result.durationMs]);
      }
      const all = await client.query('select * from exercise_results where workout_session_id=$1 order by set_number,created_at', [sessionId]);
      return this.mapWorkout(session, all.rows.map((row) => this.mapExerciseResult(row)));
    });
  }

  async completeWorkout(userId: string, sessionId: string, key: string, input: CompleteWorkoutInput): Promise<IdempotencyResult<WorkoutCompletion>> {
    return this.idempotent(userId, key, 'workout.complete', { sessionId, input }, async (client) => {
      const sessionResult = await client.query('select id,lesson_id,status from workout_sessions where id=$1 and user_id=$2 for update', [sessionId, userId]);
      const session = sessionResult.rows[0];
      if (!session) throw new ApiError('WORKOUT_NOT_FOUND', 'Workout was not found.', HttpStatus.NOT_FOUND);
      if (session.status !== 'in_progress') throw new ApiError('WORKOUT_ALREADY_COMPLETED', 'This workout has already been completed.', HttpStatus.CONFLICT);
      const resultRows = await client.query('select er.* from exercise_results er where er.workout_session_id=$1', [sessionId]);
      if (resultRows.rowCount === 0) throw new ApiError('WORKOUT_RESULTS_REQUIRED', 'Upload at least one exercise result before completion.', HttpStatus.UNPROCESSABLE_ENTITY, true);
      const canonical = this.requireCanonicalWorkout(String(session.lesson_id));
      const results = resultRows.rows.map((row) => this.mapExerciseResult(row));
      this.assertCanonicalResults(canonical, results);
      const evaluation = evaluateWorkoutResults(canonical, results, input);
      const before = launchableLessonIds(this.fallbackCatalog, await this.loadAccessContext(client, userId));
      const masteryChanges: SkillMastery[] = [];
      if (evaluation.masteryQualifies && evaluation.averageForm !== null) {
        const updated = await client.query(`insert into skill_mastery
          (user_id,exercise_key,best_form_score,qualifying_sessions,mastered)
          values ($1,$2,$3,1,false) on conflict (user_id,exercise_key) do update
          set best_form_score=greatest(skill_mastery.best_form_score,excluded.best_form_score),
            qualifying_sessions=skill_mastery.qualifying_sessions+1,
            mastered=(skill_mastery.qualifying_sessions+1)>=2,updated_at=now()
          returning exercise_key,best_form_score,qualifying_sessions,mastered,restricted,updated_at`,
        [userId, canonical.exercise.exerciseKey, Math.round(evaluation.averageForm)]);
        masteryChanges.push(this.mapMastery(updated.rows[0]!));
      }
      if (!evaluation.progressionSuppressed) {
        await client.query(`insert into lesson_attempts (user_id,lesson_id,workout_session_id,completed,form_score,completion_score,perceived_difficulty)
          values ($1,$2,$3,true,$4,$5,$6) on conflict (user_id,workout_session_id) do nothing`,
        [userId, session.lesson_id, sessionId, evaluation.averageForm, evaluation.completionScore, input.perceivedDifficulty]);
      }
      const requestedXp = evaluation.progressionSuppressed
        ? 0
        : canonical.lesson.xpReward + (evaluation.averageForm !== null && evaluation.averageForm >= 90 ? 20 : 0);
      const timezone = await this.userTimezone(client, userId);
      const day = localDate(input.completedAt, timezone);
      const todayResult = await client.query<{ total: string }>("select coalesce(sum(points),0)::text total from xp_ledger where user_id=$1 and event_type like 'WORKOUT%' and local_date=$2", [userId, day]);
      const earnedToday = Number(todayResult.rows[0]?.total ?? 0);
      const xpAwarded = Math.max(0, Math.min(requestedXp, DAILY_WORKOUT_XP_CAP - earnedToday));
      if (xpAwarded > 0) await client.query(`insert into xp_ledger (user_id,event_type,event_id,points,idempotency_key,local_date)
        values ($1,'WORKOUT_COMPLETED',$2,$3,$4,$5)`, [userId, sessionId, xpAwarded, key, day]);
      if (!evaluation.progressionSuppressed) {
        await client.query(`insert into streak_days (user_id,local_date,day_type,status,source_event_id,timezone)
          values ($1,$2,'workout','completed',$3,$4) on conflict (user_id,local_date) do update
          set day_type='workout',status='completed',source_event_id=excluded.source_event_id,timezone=excluded.timezone`, [userId, day, sessionId, timezone]);
        await client.query(`insert into user_achievements (user_id,achievement_key) values ($1,'first_step') on conflict do nothing`, [userId]);
      }
      await client.query(`update workout_sessions set status=$3,completed_at=$4,average_form_score=$5,completion_score=$6,
        perceived_difficulty=$7,pain_reported=$8 where id=$1 and user_id=$2`,
      [sessionId, userId, input.painReported ? 'stopped_for_safety' : 'completed', input.completedAt, evaluation.averageForm, evaluation.completionScore, input.perceivedDifficulty, input.painReported]);
      await client.query(`insert into outbox_events (user_id,aggregate_type,aggregate_id,event_type,payload)
        values ($1,'workout_session',$2,'WorkoutSessionCompleted',$3)`, [userId, sessionId, JSON.stringify({ userId, xpAwarded, progressionSuppressed: evaluation.progressionSuppressed })]);
      const totalResult = await client.query<{ total: string }>('select coalesce(sum(points),0)::text total from xp_ledger where user_id=$1', [userId]);
      const planResult = await client.query<{ revision: number }>("select revision from workout_plans where user_id=$1 and status='active' order by revision desc limit 1", [userId]);
      const after = launchableLessonIds(this.fallbackCatalog, await this.loadAccessContext(client, userId));
      const totalXp = Number(totalResult.rows[0]?.total ?? 0);
      return {
        xpAwarded, xpCapped: xpAwarded < requestedXp, totalXp, level: Math.floor(totalXp / XP_PER_LEVEL) + 1,
        masteryChanges, newlyUnlockedLessonIds: [...after].filter((id) => !before.has(id)), planRevision: planResult.rows[0]?.revision ?? 0,
        progressionSuppressed: evaluation.progressionSuppressed,
        ...(input.painReported ? { safetyMessage: { id: 'Hentikan latihan ini. Pilih variasi yang lebih ringan dan cari bantuan profesional bila nyeri berlanjut.', en: 'Stop this exercise. Choose a safer variation and seek professional help if pain continues.' } } : {}),
      };
    });
  }

  private async readUser<T>(userId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.current_user_id',$1,true)", [userId]);
      await client.query("set local statement_timeout='5s'");
      const result = await action(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }

  private async idempotent<T>(userId: string, key: string, operation: string, payload: unknown, action: (client: PoolClient) => Promise<T>): Promise<IdempotencyResult<T>> {
    const payloadHash = stableHash(payload);
    return this.readUser(userId, async (client) => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${userId}:${key}`]);
      const existing = await client.query<{ event_type: string; payload_hash: string; response: T }>('select event_type,payload_hash,response from processed_client_events where user_id=$1 and idempotency_key=$2', [userId, key]);
      const row = existing.rows[0];
      if (row) {
        if (row.event_type !== operation || row.payload_hash !== payloadHash) throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request.', HttpStatus.CONFLICT);
        return { replayed: true, value: row.response };
      }
      const value = await action(client);
      await client.query(`insert into processed_client_events (user_id,idempotency_key,event_type,payload_hash,response)
        values ($1,$2,$3,$4,$5)`, [userId, key, operation, payloadHash, JSON.stringify(value)]);
      return { replayed: false, value };
    });
  }

  private async userTimezone(client: PoolClient, userId: string): Promise<string> {
    const result = await client.query<{ timezone: string }>("select coalesce((select timezone from profiles where user_id=$1),'Asia/Jakarta') timezone", [userId]);
    return result.rows[0]?.timezone ?? 'Asia/Jakarta';
  }

  private async loadAccessContext(client: PoolClient, userId: string): Promise<LessonAccessContext> {
    const [xpResult, profileResult, completedResult, masteryResult] = await Promise.all([
      client.query<{ total: string }>('select coalesce(sum(points),0)::text as total from xp_ledger where user_id=$1', [userId]),
      client.query<{ equipment: string[] }>('select equipment from profiles where user_id=$1', [userId]),
      client.query<{ lesson_id: string }>('select lesson_id from lesson_attempts where user_id=$1 and completed=true', [userId]),
      client.query('select exercise_key,best_form_score,qualifying_sessions,mastered,restricted,updated_at from skill_mastery where user_id=$1', [userId]),
    ]);
    const totalXp = Number(xpResult.rows[0]?.total ?? 0);
    return {
      level: Math.floor(totalXp / XP_PER_LEVEL) + 1,
      equipment: profileResult.rows[0]?.equipment ?? [],
      completedLessonIds: new Set(completedResult.rows.map((row) => row.lesson_id)),
      mastery: masteryResult.rows.map((row) => this.mapMastery(row)),
    };
  }

  private requireCanonicalWorkout(lessonId: string): CanonicalWorkout {
    const canonical = findCanonicalWorkout(this.fallbackCatalog, lessonId);
    if (!canonical) throw new ApiError('LESSON_NOT_FOUND', 'Lesson was not found.', HttpStatus.NOT_FOUND);
    return canonical;
  }

  private assertCanonicalResults(canonical: CanonicalWorkout, results: readonly ExerciseResultInput[]): void {
    const issue = validateWorkoutResults(canonical, results);
    if (issue) throw new ApiError(issue.code, issue.message, HttpStatus.UNPROCESSABLE_ENTITY, true);
  }

  private mapProfile(row: QueryResultRow): Profile {
    return { displayName: String(row.display_name), locale: row.locale as Profile['locale'], timezone: String(row.timezone), primaryGoal: row.primary_goal as Profile['primaryGoal'], experienceLevel: row.experience_level as Profile['experienceLevel'], equipment: asObject<string[]>(row.equipment), limitations: asObject<string[]>(row.limitations), schedule: { days: asObject<string[]>(row.schedule_days), durationMinutes: Number(row.session_duration_minutes) }, onboardingCompleted: Boolean(row.onboarding_completed), updatedAt: (row.updated_at as Date).toISOString() };
  }
  private mapConsent(row: QueryResultRow): Consent { return { type: row.consent_type as Consent['type'], granted: Boolean(row.granted), version: String(row.version), updatedAt: (row.updated_at as Date).toISOString() }; }
  private mapAssessment(row: QueryResultRow): Assessment { return { id: String(row.id), status: row.status as Assessment['status'], assessmentVersion: String(row.assessment_version), startedAt: (row.started_at as Date).toISOString(), ...(row.completed_at ? { completedAt: (row.completed_at as Date).toISOString() } : {}), ...(row.result ? { result: asObject<AssessmentResult>(row.result) } : {}) }; }
  private mapPlan(row: QueryResultRow): WorkoutPlan { return { id: String(row.id), revision: Number(row.revision), status: 'active', generatedAt: (row.generated_at as Date).toISOString(), reason: asObject<WorkoutPlan['reason']>(row.reason), lessonIds: asObject<string[]>(row.lesson_ids) }; }
  private mapMastery(row: QueryResultRow): SkillMastery { return { exerciseKey: String(row.exercise_key), bestFormScore: Number(row.best_form_score), qualifyingSessions: Number(row.qualifying_sessions), mastered: Boolean(row.mastered), restricted: Boolean(row.restricted), updatedAt: (row.updated_at as Date).toISOString() }; }
  private mapWorkout(row: QueryResultRow, results: ExerciseResultInput[]): WorkoutSession { return { id: String(row.id), lessonId: String(row.lesson_id), status: row.status as WorkoutSession['status'], startedAt: (row.started_at as Date).toISOString(), ...(row.completed_at ? { completedAt: (row.completed_at as Date).toISOString() } : {}), results }; }
  private mapExerciseResult(row: QueryResultRow): ExerciseResultInput { return { clientResultId: String(row.client_result_id), exerciseDefinitionId: String(row.exercise_definition_id), exerciseDefinitionVersion: Number(row.exercise_definition_version), scoringVersion: String(row.scoring_version), poseModelVersion: String(row.pose_model_version), setNumber: Number(row.set_number), totalReps: Number(row.total_reps), validReps: Number(row.valid_reps), ...(row.form_score === null ? {} : { formScore: Number(row.form_score) }), completionScore: Number(row.completion_score), controlScore: Number(row.control_score), consistencyScore: Number(row.consistency_score), ...(row.main_feedback_code ? { mainFeedbackCode: String(row.main_feedback_code) } : {}), trackingEligible: Boolean(row.tracking_eligible), durationMs: Number(row.duration_ms) }; }
}
