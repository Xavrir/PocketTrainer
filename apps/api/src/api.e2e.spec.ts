import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

const userSubject = randomUUID();
const auth = { 'x-dev-auth-subject': userSubject };
const squatLessonId = '40000000-0000-4000-8000-000000000001';
const squatControlLessonId = '40000000-0000-4000-8000-000000000002';
const pushupLessonId = '40000000-0000-4000-8000-000000000003';
const squatDefinitionId = '10000000-0000-4000-8000-000000000001';
const pushupDefinitionId = '10000000-0000-4000-8000-000000000002';
const poseModelVersion = 'mediapipe-pose-landmarker-1';

const isolatedAuth = () => ({ 'x-dev-auth-subject': randomUUID() });

const squatResult = (overrides: Record<string, unknown> = {}) => ({
  clientResultId: randomUUID(),
  exerciseDefinitionId: squatDefinitionId,
  exerciseDefinitionVersion: 1,
  scoringVersion: '1.0.0',
  poseModelVersion,
  setNumber: 1,
  totalReps: 8,
  validReps: 8,
  formScore: 92,
  completionScore: 100,
  controlScore: 90,
  consistencyScore: 88,
  trackingEligible: true,
  durationMs: 45_000,
  ...overrides,
});

describe('PocketTrainer MVP API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATA_STORE = 'memory';
    process.env.ALLOW_INSECURE_DEV_AUTH = 'true';
    delete process.env.DEV_AUTH_SUBJECT;
    delete process.env.SUPABASE_URL;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => { if (app) await app.close(); });

  it('keeps health public and product routes authenticated', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect(({ body }) => expect(body.status).toBe('ok'));
    await request(app.getHttpServer()).get('/v1/bootstrap').expect(401).expect(({ body }) => expect(body.error.code).toBe('AUTH_REQUIRED'));
    await request(app.getHttpServer())
      .get('/v1/bootstrap')
      .set('Authorization', 'Bearer altered-or-expired-token')
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe('AUTH_TOKEN_INVALID'));
  });

  it('serves the four-movement, three-track catalog', async () => {
    const response = await request(app.getHttpServer()).get('/v1/catalog').set(auth).expect(200);
    expect(response.body.exercises).toHaveLength(4);
    expect(response.body.tracks.map((track: { slug: string }) => track.slug)).toEqual(['strength', 'yoga', 'mobility']);
  });

  it('rejects workout creation while the lesson is locked', async () => {
    await request(app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(isolatedAuth())
      .set('Idempotency-Key', randomUUID())
      .send({ lessonId: squatControlLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('LESSON_NOT_LAUNCHABLE');
        expect(body.error.details.accessState).toBe('locked_prerequisite');
      });
  });

  it('rejects result definition and version mismatches', async () => {
    const scenarioAuth = isolatedAuth();
    const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ lessonId: squatLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' }).expect(201);
    await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ results: [squatResult({ exerciseDefinitionId: pushupDefinitionId })] })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('WORKOUT_RESULT_DEFINITION_MISMATCH'));
    await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ results: [squatResult({ exerciseDefinitionVersion: 2 })] })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('WORKOUT_RESULT_VERSION_MISMATCH'));
  });

  it('rejects posture-scored incline-push-up results', async () => {
    const scenarioAuth = isolatedAuth();
    const profile = {
      displayName: 'Bima', locale: 'id', timezone: 'Asia/Jakarta', primaryGoal: 'build_strength', experienceLevel: 'foundation',
      equipment: ['bench_or_wall'], limitations: [], schedule: { days: ['monday'], durationMinutes: 20 }, onboardingCompleted: true,
    };
    await request(app.getHttpServer()).put('/v1/profile').set(scenarioAuth).set('Idempotency-Key', randomUUID()).send(profile).expect(200);
    const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ lessonId: pushupLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' }).expect(201);
    const trackedPushup = {
      clientResultId: randomUUID(), exerciseDefinitionId: pushupDefinitionId, exerciseDefinitionVersion: 1,
      scoringVersion: '1.0.0', poseModelVersion, setNumber: 1, totalReps: 6, validReps: 6,
      formScore: 90, completionScore: 100, controlScore: 90, consistencyScore: 90, trackingEligible: true, durationMs: 30_000,
    };
    await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ results: [trackedPushup] }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('WORKOUT_TRACKING_UNSUPPORTED'));
  });

  it('suppresses guidance-only incline-push-up progression', async () => {
    const scenarioAuth = isolatedAuth();
    const profile = {
      displayName: 'Bima', locale: 'id', timezone: 'Asia/Jakarta', primaryGoal: 'build_strength', experienceLevel: 'foundation',
      equipment: ['bench_or_wall'], limitations: [], schedule: { days: ['monday'], durationMinutes: 20 }, onboardingCompleted: true,
    };
    await request(app.getHttpServer()).put('/v1/profile').set(scenarioAuth).set('Idempotency-Key', randomUUID()).send(profile).expect(200);
    const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ lessonId: pushupLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' }).expect(201);
    await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ results: [{ clientResultId: randomUUID(), exerciseDefinitionId: pushupDefinitionId, exerciseDefinitionVersion: 1,
        scoringVersion: '1.0.0', poseModelVersion, setNumber: 1, totalReps: 6, validReps: 6,
        completionScore: 100, controlScore: 90, consistencyScore: 90, trackingEligible: false, durationMs: 30_000 }] }).expect(200);
    const completed = await request(app.getHttpServer()).post(`/v1/workout-sessions/${session.body.id}/complete`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ completedAt: new Date().toISOString(), perceivedDifficulty: 5, painReported: false }).expect(201);
    expect(completed.body).toMatchObject({ xpAwarded: 0, progressionSuppressed: true, masteryChanges: [], newlyUnlockedLessonIds: [] });
    await request(app.getHttpServer()).get('/v1/progress').set(scenarioAuth).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ xp: { total: 0 }, streak: { current: 0, longest: 0, todayStatus: 'open' } });
      expect(body.completedLessonIds).toEqual([]);
      expect(body.achievements).toEqual([]);
    });
  });

  it('updates profile exactly once and rejects key reuse with another payload', async () => {
    const key = randomUUID();
    const profile = {
      displayName: 'Ayu', locale: 'id', timezone: 'Asia/Jakarta', primaryGoal: 'build_strength', experienceLevel: 'foundation',
      equipment: ['bench_or_wall'], limitations: [], schedule: { days: ['monday', 'wednesday', 'friday'], durationMinutes: 30 }, onboardingCompleted: true,
    };
    await request(app.getHttpServer()).put('/v1/profile').set(auth).send(profile).expect(400);
    await request(app.getHttpServer()).put('/v1/profile').set(auth).set('Idempotency-Key', key).send(profile).expect(200).expect('Idempotency-Replayed', 'false');
    await request(app.getHttpServer()).put('/v1/profile').set(auth).set('Idempotency-Key', key).send(profile).expect(200).expect('Idempotency-Replayed', 'true');
    await request(app.getHttpServer()).put('/v1/profile').set(auth).set('Idempotency-Key', key).send({ ...profile, displayName: 'Different' }).expect(409).expect(({ body }) => expect(body.error.code).toBe('IDEMPOTENCY_KEY_REUSED'));
  });

  it('creates an assessment, awards XP once, and generates a plan', async () => {
    const created = await request(app.getHttpServer()).post('/v1/assessments').set(auth).set('Idempotency-Key', randomUUID()).expect(201);
    const key = randomUUID();
    const result = { lowerBodyControl: 82, upperBodyControl: 75, balance: 80, mobility: 78, coreStability: 76, recommendedLevel: 'foundation', trackingEligible: true, restrictions: [] };
    const first = await request(app.getHttpServer()).post(`/v1/assessments/${created.body.id}/complete`).set(auth).set('Idempotency-Key', key).send(result).expect(201);
    expect(first.body.xpAwarded).toBe(75);
    await request(app.getHttpServer()).post(`/v1/assessments/${created.body.id}/complete`).set(auth).set('Idempotency-Key', key).send(result).expect(201).expect('Idempotency-Replayed', 'true');
    const progress = await request(app.getHttpServer()).get('/v1/progress').set(auth).expect(200);
    expect(progress.body.xp.total).toBe(75);
    await request(app.getHttpServer()).get('/v1/plans/current').set(auth).expect(200).expect(({ body }) => expect(body.lessonIds).toHaveLength(3));
  });

  it('requires two high-quality sessions for mastery and never duplicates completion XP', async () => {
    const completeSession = async () => {
      const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(auth).set('Idempotency-Key', randomUUID()).send({ lessonId: squatLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.1.0' }).expect(201);
      const result = squatResult();
      await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(auth).set('Idempotency-Key', randomUUID()).send({ results: [result] }).expect(200);
      const completionKey = randomUUID();
      const body = { completedAt: new Date().toISOString(), perceivedDifficulty: 5, painReported: false };
      const completed = await request(app.getHttpServer()).post(`/v1/workout-sessions/${session.body.id}/complete`).set(auth).set('Idempotency-Key', completionKey).send(body).expect(201);
      await request(app.getHttpServer()).post(`/v1/workout-sessions/${session.body.id}/complete`).set(auth).set('Idempotency-Key', completionKey).send(body).expect(201).expect('Idempotency-Replayed', 'true');
      return completed.body;
    };
    const first = await completeSession();
    expect(first.masteryChanges[0].mastered).toBe(false);
    const second = await completeSession();
    expect(second.masteryChanges[0].mastered).toBe(true);
    const progress = await request(app.getHttpServer()).get('/v1/progress').set(auth).expect(200);
    expect(progress.body.xp.total).toBe(235);
    expect(progress.body.mastery[0].qualifyingSessions).toBe(2);
  });

  it('suppresses progression and XP when pain is reported', async () => {
    const scenarioAuth = isolatedAuth();
    const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(scenarioAuth).set('Idempotency-Key', randomUUID()).send({ lessonId: squatLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' }).expect(201);
    await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID()).send({ results: [squatResult()] }).expect(200);
    const completed = await request(app.getHttpServer()).post(`/v1/workout-sessions/${session.body.id}/complete`).set(scenarioAuth).set('Idempotency-Key', randomUUID()).send({ completedAt: new Date().toISOString(), perceivedDifficulty: 9, painReported: true }).expect(201);
    expect(completed.body).toMatchObject({ xpAwarded: 0, progressionSuppressed: true, masteryChanges: [], newlyUnlockedLessonIds: [] });
    expect(completed.body.safetyMessage.en).toMatch(/Stop/);
    await request(app.getHttpServer()).get('/v1/progress').set(scenarioAuth).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ xp: { total: 0 }, streak: { current: 0, longest: 0, todayStatus: 'open' } });
      expect(body.completedLessonIds).toEqual([]);
      expect(body.mastery).toEqual([]);
      expect(body.achievements).toEqual([]);
    });
  });

  it('suppresses all progression side effects for low-confidence results', async () => {
    const scenarioAuth = isolatedAuth();
    const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(scenarioAuth).set('Idempotency-Key', randomUUID()).send({ lessonId: squatLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' }).expect(201);
    await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ results: [squatResult({ trackingEligible: false, formScore: undefined })] }).expect(200);
    const completed = await request(app.getHttpServer()).post(`/v1/workout-sessions/${session.body.id}/complete`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ completedAt: new Date().toISOString(), perceivedDifficulty: 4, painReported: false }).expect(201);
    expect(completed.body).toMatchObject({ xpAwarded: 0, progressionSuppressed: true, masteryChanges: [], newlyUnlockedLessonIds: [] });
    await request(app.getHttpServer()).get('/v1/progress').set(scenarioAuth).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ xp: { total: 0 }, streak: { current: 0, longest: 0, todayStatus: 'open' } });
      expect(body.completedLessonIds).toEqual([]);
      expect(body.mastery).toEqual([]);
      expect(body.achievements).toEqual([]);
    });
  });

  it('does not trust a client completionScore when the canonical target is missed', async () => {
    const scenarioAuth = isolatedAuth();
    const session = await request(app.getHttpServer()).post('/v1/workout-sessions').set(scenarioAuth).set('Idempotency-Key', randomUUID()).send({ lessonId: squatLessonId, startedAt: new Date().toISOString(), applicationVersion: '0.2.0' }).expect(201);
    const saved = await request(app.getHttpServer()).put(`/v1/workout-sessions/${session.body.id}/results`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ results: [squatResult({ validReps: 7, completionScore: 100 })] }).expect(200);
    expect(saved.body.results[0].completionScore).toBe(87.5);
    const completed = await request(app.getHttpServer()).post(`/v1/workout-sessions/${session.body.id}/complete`).set(scenarioAuth).set('Idempotency-Key', randomUUID())
      .send({ completedAt: new Date().toISOString(), perceivedDifficulty: 4, painReported: false }).expect(201);
    expect(completed.body).toMatchObject({ xpAwarded: 0, progressionSuppressed: true, newlyUnlockedLessonIds: [] });
  });

  it('processes offline batch events and reports per-event replays', async () => {
    const eventKey = randomUUID();
    const payload = { events: [{ type: 'consent.update', idempotencyKey: eventKey, payload: { consentType: 'camera_processing', granted: true, version: '1.0' } }] };
    const first = await request(app.getHttpServer()).post('/v1/sync/batch').set(auth).set('Idempotency-Key', randomUUID()).send(payload).expect(201);
    expect(first.body.results[0].status).toBe('applied');
    const replay = await request(app.getHttpServer()).post('/v1/sync/batch').set(auth).set('Idempotency-Key', randomUUID()).send(payload).expect(201);
    expect(replay.body.results[0].status).toBe('replayed');
  });

  it('rejects unsafe idempotency keys and exposes a privacy export/deletion manifest', async () => {
    const scenarioAuth = isolatedAuth();
    await request(app.getHttpServer()).put('/v1/profile').set(scenarioAuth).set('Idempotency-Key', 'short').send({}).expect(400)
      .expect(({ body }) => expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED'));
    await request(app.getHttpServer()).get('/v1/privacy/export').set(scenarioAuth).expect(200).expect(({ body }) => {
      expect(body.formatVersion).toBe(1);
      expect(body.manifest.excludes).toEqual(expect.arrayContaining(['raw_camera_frames', 'pose_landmarks', 'access_tokens']));
    });
    const key = randomUUID();
    await request(app.getHttpServer()).delete('/v1/privacy/account').set(scenarioAuth).set('Idempotency-Key', key).expect(200)
      .expect('Idempotency-Replayed', 'false').expect(({ body }) => {
        expect(body.action).toBe('account_deleted');
        expect(body.manifest.deleted).toEqual(expect.arrayContaining(['workouts', 'progress']));
      });
    await request(app.getHttpServer()).get('/v1/bootstrap').set(scenarioAuth).expect(410)
      .expect(({ body }) => expect(body.error.code).toBe('ACCOUNT_DELETED'));
  });
});
