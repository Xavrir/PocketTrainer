import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { InMemoryPocketTrainerRepository } from './in-memory.repository';

const lessonId = '40000000-0000-4000-8000-000000000001';
const exerciseDefinitionId = '10000000-0000-4000-8000-000000000001';

function createRepository() {
  return new InMemoryPocketTrainerRepository(loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', ALLOW_INSECURE_DEV_AUTH: 'true' }));
}

describe('offline progression safety', () => {
  it('does not complete lessons or advance mastery without eligible tracking', async () => {
    const repository = createRepository();
    const user = await repository.resolveIdentity(randomUUID());
    const session = (await repository.createWorkout(user.id, randomUUID(), { lessonId, startedAt: new Date().toISOString(), applicationVersion: 'test' })).value;
    await repository.saveWorkoutResults(user.id, session.id, randomUUID(), [{
      clientResultId: randomUUID(), exerciseDefinitionId, exerciseDefinitionVersion: 1, scoringVersion: '1.0.0', poseModelVersion: 'mediapipe-pose-landmarker-1',
      setNumber: 1, totalReps: 8, validReps: 8, completionScore: 100, controlScore: 90, consistencyScore: 90,
      trackingEligible: false, durationMs: 30_000,
    }]);
    const completion = (await repository.completeWorkout(user.id, session.id, randomUUID(), { completedAt: new Date().toISOString(), perceivedDifficulty: 4, painReported: false })).value;
    const progress = await repository.getProgress(user.id);
    expect(completion.progressionSuppressed).toBe(true);
    expect(completion).toMatchObject({ xpAwarded: 0, masteryChanges: [], newlyUnlockedLessonIds: [] });
    expect(progress.xp.total).toBe(0);
    expect(progress.streak).toMatchObject({ current: 0, longest: 0, todayStatus: 'open' });
    expect(progress.achievements).toEqual([]);
    expect(progress.completedLessonIds).not.toContain(lessonId);
    expect(progress.mastery).toEqual([]);
  });

  it('caps workout XP at 500 per local day', async () => {
    const repository = createRepository();
    const user = await repository.resolveIdentity(randomUUID());
    for (let index = 0; index < 10; index += 1) {
      const session = (await repository.createWorkout(user.id, randomUUID(), { lessonId, startedAt: new Date().toISOString(), applicationVersion: 'test' })).value;
      await repository.saveWorkoutResults(user.id, session.id, randomUUID(), [{
        clientResultId: randomUUID(), exerciseDefinitionId, exerciseDefinitionVersion: 1, scoringVersion: '1.0.0', poseModelVersion: 'mediapipe-pose-landmarker-1',
        setNumber: 1, totalReps: 8, validReps: 8, formScore: 75, completionScore: 0, controlScore: 75, consistencyScore: 75,
        trackingEligible: true, durationMs: 30_000,
      }]);
      await repository.completeWorkout(user.id, session.id, randomUUID(), { completedAt: new Date().toISOString(), perceivedDifficulty: 8, painReported: false });
    }
    const progress = await repository.getProgress(user.id);
    expect(progress.xp.total).toBe(500);
    expect(progress.xp.today).toBe(500);
    expect(progress.mastery).toEqual([]);
  });

  it('rejects a workout for a lesson that is still locked', async () => {
    const repository = createRepository();
    const user = await repository.resolveIdentity(randomUUID());
    await expect(repository.createWorkout(user.id, randomUUID(), {
      lessonId: '40000000-0000-4000-8000-000000000002',
      startedAt: new Date().toISOString(),
      applicationVersion: 'test',
    })).rejects.toMatchObject({ response: { code: 'LESSON_NOT_LAUNCHABLE' } });
  });

  it('reports the longest historical streak independently from the current streak', async () => {
    const repository = createRepository();
    const user = await repository.resolveIdentity(randomUUID());
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const completionTime = (offset: number) => {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      return `${date.toISOString().slice(0, 10)}T05:00:00.000Z`;
    };

    for (const offset of [-6, -5, -4, 0]) {
      const completedAt = completionTime(offset);
      const session = (await repository.createWorkout(user.id, randomUUID(), { lessonId, startedAt: completedAt, applicationVersion: 'test' })).value;
      await repository.saveWorkoutResults(user.id, session.id, randomUUID(), [{
        clientResultId: randomUUID(), exerciseDefinitionId, exerciseDefinitionVersion: 1, scoringVersion: '1.0.0', poseModelVersion: 'mediapipe-pose-landmarker-1',
        setNumber: 1, totalReps: 8, validReps: 8, formScore: 75, completionScore: 0, controlScore: 75, consistencyScore: 75,
        trackingEligible: true, durationMs: 30_000,
      }]);
      await repository.completeWorkout(user.id, session.id, randomUUID(), { completedAt, perceivedDifficulty: 8, painReported: false });
    }

    expect((await repository.getProgress(user.id)).streak).toMatchObject({ current: 1, longest: 3, todayStatus: 'active' });
  });
});
