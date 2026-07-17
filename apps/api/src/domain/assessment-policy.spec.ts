import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/catalog.seed';
import type { AssessmentEvidenceV2, ExerciseResultInput } from './domain.types';
import {
  deriveAssessmentResultV2,
  foundationPlanLessonIds,
  summarizeAssessmentWorkout,
  validateAssessmentEvidence,
} from './assessment-policy';

const evidence = (overrides: Partial<AssessmentEvidenceV2> = {}): AssessmentEvidenceV2 => ({
  squatSessionId: randomUUID(),
  targetReps: 3,
  validReps: 3,
  durationMs: 30_000,
  confidenceEligible: true,
  formScore: 88,
  painReported: false,
  ...overrides,
});

const result = (overrides: Partial<ExerciseResultInput> = {}): ExerciseResultInput => ({
  clientResultId: randomUUID(),
  exerciseDefinitionId: '10000000-0000-4000-8000-000000000001',
  exerciseDefinitionVersion: 1,
  scoringVersion: '1.0.0',
  poseModelVersion: 'mediapipe-pose-landmarker-1',
  setNumber: 1,
  totalReps: 3,
  validReps: 3,
  formScore: 88,
  completionScore: 37.5,
  controlScore: 88,
  consistencyScore: 88,
  trackingEligible: true,
  durationMs: 30_000,
  ...overrides,
});

describe('assessment v2 policy', () => {
  it('measures only lower-body control from eligible three-rep squat evidence', () => {
    expect(deriveAssessmentResultV2(evidence())).toEqual({
      version: 2,
      evidence: expect.objectContaining({ targetReps: 3, validReps: 3, formScore: 88 }),
      lowerBodyControl: 88,
      upperBodyControl: null,
      balance: null,
      mobility: null,
      coreStability: null,
      recommendedLevel: 'foundation',
      progressionSuppressed: false,
    });
  });

  it.each([
    evidence({ confidenceEligible: false, formScore: null }),
    evidence({ painReported: true, formScore: null }),
    evidence({ validReps: 2 }),
  ])('suppresses scoring and recommendation for unsafe or incomplete evidence', (unsafeEvidence) => {
    expect(deriveAssessmentResultV2(unsafeEvidence)).toMatchObject({
      lowerBodyControl: null,
      recommendedLevel: null,
      progressionSuppressed: true,
    });
  });

  it('matches client evidence to the server-backed result summary', () => {
    const observed = summarizeAssessmentWorkout('body_squat', [result()]);
    expect(observed).toMatchObject({ validReps: 3, durationMs: 30_000, confidenceEligible: true, formScore: 88 });
    expect(validateAssessmentEvidence(evidence(), observed)).toBeNull();
    expect(validateAssessmentEvidence(evidence({ validReps: 2 }), observed)?.code).toBe('ASSESSMENT_EVIDENCE_MISMATCH');
    expect(validateAssessmentEvidence(evidence(), { ...observed, exerciseKey: 'incline_push_up' })?.code).toBe('ASSESSMENT_EXERCISE_UNSUPPORTED');
  });

  it('selects only launchable foundation lessons for a new plan', () => {
    const catalog = createCatalog('https://content.example.test');
    const lessonIds = foundationPlanLessonIds(catalog, {
      level: 1,
      equipment: [],
      completedLessonIds: new Set(),
      mastery: [],
    });
    expect(lessonIds).toEqual([
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000006',
    ]);
  });
});
