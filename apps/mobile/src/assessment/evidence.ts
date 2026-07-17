import type { AssessmentEvidenceV2 } from '../api';
import type { LiveCoachSessionSummary } from '../native/sessionSummary';

export const ASSESSMENT_EXERCISE_KEY = 'body_squat' as const;
export const ASSESSMENT_TARGET_REPS = 3 as const;

export type AssessmentLiveRequest = Readonly<{
  assessmentId: string;
  exerciseKey: typeof ASSESSMENT_EXERCISE_KEY;
  targetType: 'repetitions';
  targetValue: typeof ASSESSMENT_TARGET_REPS;
}>;

export function createAssessmentLiveRequest(
  assessmentId: string,
): AssessmentLiveRequest {
  const normalizedId = assessmentId.trim();
  if (!normalizedId) throw new Error('Assessment ID is required.');
  return {
    assessmentId: normalizedId,
    exerciseKey: ASSESSMENT_EXERCISE_KEY,
    targetType: 'repetitions',
    targetValue: ASSESSMENT_TARGET_REPS,
  };
}

export function createAssessmentEvidence(
  workoutSessionId: string,
  summary: LiveCoachSessionSummary,
  painReported: boolean,
): AssessmentEvidenceV2 {
  const normalizedWorkoutSessionId = workoutSessionId.trim();
  if (!normalizedWorkoutSessionId) {
    throw new Error('A server-confirmed squat workout session is required.');
  }
  if (
    summary.exerciseKey !== ASSESSMENT_EXERCISE_KEY ||
    summary.coachingMode !== 'posture_scored'
  ) {
    throw new Error(
      'Assessment evidence is only supported for posture-scored body squats.',
    );
  }
  if (
    summary.targetType !== 'repetitions' ||
    summary.targetValue !== ASSESSMENT_TARGET_REPS
  ) {
    throw new Error('The movement assessment requires exactly three squats.');
  }

  const eligibleFormScore =
    summary.confidenceEligible &&
    summary.formScore !== null &&
    Number.isFinite(summary.formScore)
      ? Math.max(0, Math.min(100, summary.formScore))
      : null;
  if (!Number.isInteger(summary.elapsedTimeMs) || summary.elapsedTimeMs <= 0) {
    throw new Error(
      'Assessment evidence requires a positive whole-millisecond duration.',
    );
  }
  if (
    !Number.isInteger(summary.repetitionCount) ||
    summary.repetitionCount < 0 ||
    summary.repetitionCount > ASSESSMENT_TARGET_REPS
  ) {
    throw new Error(
      'Assessment evidence must contain zero to three valid reps.',
    );
  }

  return {
    squatSessionId: normalizedWorkoutSessionId,
    targetReps: ASSESSMENT_TARGET_REPS,
    validReps: summary.repetitionCount,
    durationMs: summary.elapsedTimeMs,
    confidenceEligible: eligibleFormScore !== null,
    formScore:
      painReported || summary.painState === 'reported'
        ? null
        : eligibleFormScore,
    painReported: painReported || summary.painState === 'reported',
  };
}
