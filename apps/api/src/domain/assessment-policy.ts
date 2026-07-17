import type {
  AssessmentEvidenceV2,
  AssessmentResultV1,
  AssessmentResultV2,
  Catalog,
  ExerciseResultInput,
} from './domain.types';
import { evaluateLessonAccess, isLessonLaunchable, type LessonAccessContext } from './workout-policy';

export const ASSESSMENT_VERSION_V2 = '2.0.0';
export const ASSESSMENT_XP_REWARD = 75;

export type AssessmentWorkoutObservation = {
  exerciseKey: string;
  validReps: number;
  durationMs: number;
  confidenceEligible: boolean;
  formScore: number | null;
};

export type AssessmentEvidenceIssue = {
  code: 'ASSESSMENT_EXERCISE_UNSUPPORTED' | 'ASSESSMENT_EVIDENCE_MISMATCH';
  message: string;
};

export function isAssessmentEvidenceV2(input: AssessmentResultV1 | AssessmentEvidenceV2): input is AssessmentEvidenceV2 {
  return 'squatSessionId' in input;
}

export function summarizeAssessmentWorkout(exerciseKey: string, results: readonly ExerciseResultInput[]): AssessmentWorkoutObservation {
  const validReps = results.reduce((total, result) => total + result.validReps, 0);
  const durationMs = results.reduce((total, result) => total + result.durationMs, 0);
  const confidenceEligible = results.length > 0
    && results.every((result) => result.trackingEligible && result.formScore !== undefined);

  return {
    exerciseKey,
    validReps,
    durationMs,
    confidenceEligible,
    formScore: confidenceEligible ? roundScore(weightedAverageForm(results)) : null,
  };
}

export function validateAssessmentEvidence(
  evidence: AssessmentEvidenceV2,
  observed: AssessmentWorkoutObservation,
): AssessmentEvidenceIssue | null {
  if (observed.exerciseKey !== 'body_squat') {
    return {
      code: 'ASSESSMENT_EXERCISE_UNSUPPORTED',
      message: 'Only a body-squat session can be used for the scored movement assessment.',
    };
  }
  if (
    evidence.validReps !== observed.validReps
    || evidence.durationMs !== observed.durationMs
    || evidence.confidenceEligible !== observed.confidenceEligible
  ) {
    return {
      code: 'ASSESSMENT_EVIDENCE_MISMATCH',
      message: 'Assessment evidence does not match the server-backed squat session.',
    };
  }
  if (
    evidence.confidenceEligible
    && !evidence.painReported
    && (evidence.formScore === null || observed.formScore === null || Math.abs(evidence.formScore - observed.formScore) > 0.01)
  ) {
    return {
      code: 'ASSESSMENT_EVIDENCE_MISMATCH',
      message: 'Assessment form score does not match the server-backed squat session.',
    };
  }
  return null;
}

export function deriveAssessmentResultV2(evidence: AssessmentEvidenceV2): AssessmentResultV2 {
  const progressionSuppressed = evidence.painReported
    || !evidence.confidenceEligible
    || evidence.validReps < evidence.targetReps
    || evidence.formScore === null;

  return {
    version: 2,
    evidence,
    lowerBodyControl: progressionSuppressed ? null : evidence.formScore,
    upperBodyControl: null,
    balance: null,
    mobility: null,
    coreStability: null,
    recommendedLevel: progressionSuppressed ? null : 'foundation',
    progressionSuppressed,
  };
}

export function v1ProgressionSuppressed(result: AssessmentResultV1): boolean {
  return !result.trackingEligible || result.restrictions.length > 0;
}

export function foundationPlanLessonIds(catalog: Catalog, context: LessonAccessContext): string[] {
  return catalog.tracks.flatMap((track) => {
    const lesson = track.courses
      .flatMap((course) => course.units)
      .flatMap((unit) => unit.lessons)
      .find((candidate) => isLessonLaunchable(evaluateLessonAccess(candidate, context)));
    return lesson ? [lesson.id] : [];
  });
}

function weightedAverageForm(results: readonly ExerciseResultInput[]): number {
  const weighted = results.reduce(
    (total, result) => {
      const weight = Math.max(result.validReps, 1);
      return { score: total.score + result.formScore! * weight, weight: total.weight + weight };
    },
    { score: 0, weight: 0 },
  );
  return weighted.score / weighted.weight;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
