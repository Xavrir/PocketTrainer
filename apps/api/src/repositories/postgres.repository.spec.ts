import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config';

const database = vi.hoisted(() => {
  const queries: string[] = [];
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  const end = vi.fn(async () => undefined);
  return { queries, query, release, connect, end };
});

vi.mock('pg', () => ({
  Pool: class MockPool {
    connect = database.connect;
    end = database.end;
  },
}));

import { PostgresPocketTrainerRepository } from './postgres.repository';

const squatLessonId = '40000000-0000-4000-8000-000000000001';
const squatControlLessonId = '40000000-0000-4000-8000-000000000002';
const squatDefinitionId = '10000000-0000-4000-8000-000000000001';

function createRepository(): PostgresPocketTrainerRepository {
  return new PostgresPocketTrainerRepository(loadConfig({
    NODE_ENV: 'test',
    DATA_STORE: 'postgres',
    DATABASE_URL: 'postgresql://unit-test.invalid/pockettrainer',
    ALLOW_INSECURE_DEV_AUTH: 'true',
  }));
}

function resultRow(overrides: Record<string, unknown> = {}) {
  return {
    client_result_id: randomUUID(),
    exercise_definition_id: squatDefinitionId,
    exercise_definition_version: 1,
    scoring_version: '1.0.0',
    pose_model_version: 'mediapipe-pose-landmarker-1',
    set_number: 1,
    total_reps: 8,
    valid_reps: 8,
    form_score: null,
    completion_score: 100,
    control_score: 80,
    consistency_score: 80,
    main_feedback_code: null,
    tracking_eligible: false,
    duration_ms: 30_000,
    ...overrides,
  };
}

describe('PostgreSQL workout safety without an external database', () => {
  beforeEach(() => {
    database.queries.length = 0;
    database.query.mockReset();
    database.connect.mockClear();
    database.release.mockClear();
    database.end.mockClear();
    database.query.mockImplementation(async (text: string) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      database.queries.push(sql);
      if (sql.includes('from processed_client_events where')) return { rows: [], rowCount: 0 };
      if (sql.includes('select coalesce(sum(points)')) return { rows: [{ total: '0' }], rowCount: 1 };
      if (sql.includes('select equipment from profiles')) return { rows: [], rowCount: 0 };
      if (sql.includes('select lesson_id from lesson_attempts')) return { rows: [], rowCount: 0 };
      if (sql.includes('from skill_mastery where')) return { rows: [], rowCount: 0 };
      if (sql.includes("select coalesce((select timezone")) return { rows: [{ timezone: 'Asia/Jakarta' }], rowCount: 1 };
      if (sql.includes("select revision from workout_plans")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
  });

  it('rejects a locked lesson before PostgreSQL inserts a workout', async () => {
    const repository = createRepository();
    await expect(repository.createWorkout(randomUUID(), randomUUID(), {
      lessonId: squatControlLessonId,
      startedAt: new Date().toISOString(),
      applicationVersion: 'test',
    })).rejects.toMatchObject({ response: { code: 'LESSON_NOT_LAUNCHABLE' } });
    expect(database.queries.some((sql) => sql.includes('insert into workout_sessions'))).toBe(false);
    expect(database.queries.at(-1)).toBe('rollback');
    expect(database.queries).toContain("select set_config('app.current_user_id',$1,true)");
  });

  it('rejects idempotency-key reuse before a second mutation can run', async () => {
    const repository = createRepository();
    database.query.mockImplementation(async (text: string) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      database.queries.push(sql);
      if (sql.includes('from processed_client_events where')) {
        return { rows: [{ event_type: 'profile.update', payload_hash: 'different', response: {} }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(repository.updateProfile(randomUUID(), 'reused-key', {
      displayName: 'Ayu', locale: 'id', timezone: 'Asia/Jakarta', primaryGoal: 'build_strength',
      experienceLevel: 'foundation', equipment: [], limitations: [], schedule: { days: ['monday'], durationMinutes: 20 }, onboardingCompleted: true,
    })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(database.queries.some((sql) => sql.startsWith('insert into profiles'))).toBe(false);
    expect(database.queries.at(-1)).toBe('rollback');
  });

  it('finalizes low-confidence sessions without PostgreSQL progression inserts', async () => {
    const repository = createRepository();
    database.query.mockImplementation(async (text: string) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      database.queries.push(sql);
      if (sql.includes('from processed_client_events where')) return { rows: [], rowCount: 0 };
      if (sql.includes('from workout_sessions where id=$1')) return { rows: [{ id: randomUUID(), lesson_id: squatLessonId, status: 'in_progress' }], rowCount: 1 };
      if (sql.includes('from exercise_results er')) return { rows: [resultRow()], rowCount: 1 };
      if (sql.includes('select coalesce(sum(points)')) return { rows: [{ total: '0' }], rowCount: 1 };
      if (sql.includes('select equipment from profiles')) return { rows: [], rowCount: 0 };
      if (sql.includes('select lesson_id from lesson_attempts')) return { rows: [], rowCount: 0 };
      if (sql.includes('from skill_mastery where')) return { rows: [], rowCount: 0 };
      if (sql.includes("select coalesce((select timezone")) return { rows: [{ timezone: 'Asia/Jakarta' }], rowCount: 1 };
      if (sql.includes("select revision from workout_plans")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    const completion = (await repository.completeWorkout(randomUUID(), randomUUID(), randomUUID(), {
      completedAt: new Date().toISOString(),
      perceivedDifficulty: 4,
      painReported: false,
    })).value;

    expect(completion).toMatchObject({ xpAwarded: 0, progressionSuppressed: true, masteryChanges: [], newlyUnlockedLessonIds: [] });
    for (const table of ['xp_ledger', 'streak_days', 'user_achievements', 'lesson_attempts', 'skill_mastery']) {
      expect(database.queries.some((sql) => sql.startsWith(`insert into ${table}`))).toBe(false);
    }
  });
});
