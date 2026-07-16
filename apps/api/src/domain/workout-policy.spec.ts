import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/catalog.seed';
import type { ExerciseResultInput, SkillMastery } from './domain.types';
import {
  canonicalizeWorkoutResults,
  evaluateLessonAccess,
  evaluateWorkoutResults,
  findCanonicalWorkout,
  launchableLessonIds,
  validateWorkoutResults,
  type CanonicalWorkout,
  type LessonAccessContext,
} from './workout-policy';

const catalog = createCatalog('https://content.test');
const squatLessonId = '40000000-0000-4000-8000-000000000001';
const squatControlLessonId = '40000000-0000-4000-8000-000000000002';
const pushupLessonId = '40000000-0000-4000-8000-000000000003';
const warriorLessonId = '40000000-0000-4000-8000-000000000004';
const treeLessonId = '40000000-0000-4000-8000-000000000005';
const squat = findCanonicalWorkout(catalog, squatLessonId)!;
const squatControl = findCanonicalWorkout(catalog, squatControlLessonId)!;
const pushup = findCanonicalWorkout(catalog, pushupLessonId)!;
const warrior = findCanonicalWorkout(catalog, warriorLessonId)!;
const tree = findCanonicalWorkout(catalog, treeLessonId)!;
const unknown = { ...pushup, exercise: { ...pushup.exercise, exerciseKey: 'unknown_movement' } } satisfies CanonicalWorkout;

function mastery(overrides: Partial<SkillMastery> = {}): SkillMastery {
  return {
    exerciseKey: 'body_squat',
    bestFormScore: 90,
    qualifyingSessions: 2,
    mastered: true,
    restricted: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function context(overrides: Partial<LessonAccessContext> = {}): LessonAccessContext {
  return {
    level: 1,
    equipment: [],
    completedLessonIds: new Set(),
    mastery: [],
    ...overrides,
  };
}

function resultFor(canonical: CanonicalWorkout, overrides: Partial<ExerciseResultInput> = {}): ExerciseResultInput {
  return {
    clientResultId: randomUUID(),
    exerciseDefinitionId: canonical.exercise.id,
    exerciseDefinitionVersion: canonical.exercise.version,
    scoringVersion: canonical.exercise.scoringVersion,
    poseModelVersion: canonical.exercise.poseModelVersion,
    setNumber: 1,
    totalReps: 8,
    validReps: 8,
    formScore: 92,
    completionScore: 0,
    controlScore: 90,
    consistencyScore: 90,
    trackingEligible: true,
    durationMs: 30_000,
    ...overrides,
  };
}

function result(overrides: Partial<ExerciseResultInput> = {}): ExerciseResultInput {
  return resultFor(squat, overrides);
}

describe('authoritative workout policy', () => {
  it('evaluates every lesson access requirement before launch', () => {
    expect(evaluateLessonAccess(pushup.lesson, context())).toBe('gated_equipment');
    expect(evaluateLessonAccess(squatControl.lesson, context())).toBe('locked_prerequisite');
    expect(evaluateLessonAccess(squatControl.lesson, context({ completedLessonIds: new Set([squatLessonId]) }))).toBe('locked_mastery');
    expect(evaluateLessonAccess(squatControl.lesson, context({ completedLessonIds: new Set([squatLessonId]), mastery: [mastery()] }))).toBe('locked_level');
    expect(evaluateLessonAccess(squatControl.lesson, context({ level: 2, completedLessonIds: new Set([squatLessonId]), mastery: [mastery()] }))).toBe('available');
    expect(evaluateLessonAccess(squatControl.lesson, context({ level: 2, completedLessonIds: new Set([squatLessonId]), mastery: [mastery({ restricted: true })] }))).toBe('locked_mastery');
  });

  it('finds unlocks by comparing complete before and after access evaluations', () => {
    const before = launchableLessonIds(catalog, context({ completedLessonIds: new Set([squatLessonId]), mastery: [mastery()] }));
    const after = launchableLessonIds(catalog, context({ level: 2, completedLessonIds: new Set([squatLessonId]), mastery: [mastery()] }));
    expect(before.has(squatControlLessonId)).toBe(false);
    expect([...after].filter((id) => !before.has(id))).toContain(squatControlLessonId);
  });

  it('rejects definition and version mismatches', () => {
    expect(validateWorkoutResults(squat, [result({ exerciseDefinitionId: pushup.exercise.id })])?.code).toBe('WORKOUT_RESULT_DEFINITION_MISMATCH');
    expect(validateWorkoutResults(squat, [result({ exerciseDefinitionVersion: 2 })])?.code).toBe('WORKOUT_RESULT_VERSION_MISMATCH');
    expect(validateWorkoutResults(squat, [result({ scoringVersion: 'attacker-version' })])?.code).toBe('WORKOUT_RESULT_VERSION_MISMATCH');
    expect(validateWorkoutResults(squat, [result({ poseModelVersion: 'unknown-model' })])?.code).toBe('WORKOUT_RESULT_VERSION_MISMATCH');
  });

  it('accepts native tracking/form scores and keeps unknown movements unsupported', () => {
    for (const canonical of [squat, pushup, warrior, tree]) {
      expect(validateWorkoutResults(canonical, [resultFor(canonical)])).toBeNull();
      expect(evaluateWorkoutResults(canonical, [resultFor(canonical)], { painReported: false, perceivedDifficulty: 5 })).toMatchObject({
        progressionSuppressed: false,
        targetMet: true,
      });
    }
    expect(validateWorkoutResults(unknown, [resultFor(unknown)])?.code).toBe('WORKOUT_TRACKING_UNSUPPORTED');
    expect(validateWorkoutResults(unknown, [resultFor(unknown, { trackingEligible: false, formScore: undefined })])).toBeNull();
    expect(evaluateWorkoutResults(unknown, [resultFor(unknown, { trackingEligible: false, formScore: undefined })], { painReported: false, perceivedDifficulty: 5 })).toMatchObject({
      progressionSuppressed: true,
      averageForm: null,
    });
  });

  it('derives target completion from valid reps instead of client completionScore', () => {
    const complete = canonicalizeWorkoutResults(squat, [result({ completionScore: 0 })]);
    expect(complete[0]?.completionScore).toBe(100);
    expect(evaluateWorkoutResults(squat, complete, { painReported: false, perceivedDifficulty: 5 })).toMatchObject({
      completionScore: 100,
      targetMet: true,
      progressionSuppressed: false,
      masteryQualifies: true,
    });

    const short = canonicalizeWorkoutResults(squat, [result({ validReps: 7, completionScore: 100 })]);
    expect(short[0]?.completionScore).toBe(87.5);
    expect(evaluateWorkoutResults(squat, short, { painReported: false, perceivedDifficulty: 5 })).toMatchObject({
      completionScore: 87.5,
      targetMet: false,
      progressionSuppressed: true,
    });
  });

  it('suppresses pain and low-confidence results even when the canonical target is met', () => {
    expect(evaluateWorkoutResults(squat, [result()], { painReported: true, perceivedDifficulty: 5 }).progressionSuppressed).toBe(true);
    expect(evaluateWorkoutResults(squat, [result({ trackingEligible: false, formScore: undefined })], { painReported: false, perceivedDifficulty: 5 }).progressionSuppressed).toBe(true);
    expect(evaluateWorkoutResults(pushup, [resultFor(pushup)], { painReported: true, perceivedDifficulty: 5 }).progressionSuppressed).toBe(true);
    expect(evaluateWorkoutResults(pushup, [resultFor(pushup, { trackingEligible: false, formScore: undefined })], { painReported: false, perceivedDifficulty: 5 }).progressionSuppressed).toBe(true);
  });
});
