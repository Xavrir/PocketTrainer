import type { LiveCoachSessionSummary } from '../native/sessionSummary';

type MeasurementSource = Pick<
  LiveCoachSessionSummary,
  | 'activeDurationMs'
  | 'elapsedTimeMs'
  | 'repetitionCount'
  | 'targetType'
>;

export type WorkoutMeasurement = Readonly<{
  durationMs: number;
  totalReps: number;
  validReps: number;
}>;

export function createWorkoutMeasurement(
  summary: MeasurementSource,
): WorkoutMeasurement {
  if (summary.targetType === 'repetitions') {
    // Guided repetitions are user-confirmed completion, not posture validation.
    // `trackingEligible` and `formScore` carry the separate scoring claim.
    return {
      durationMs: summary.elapsedTimeMs,
      totalReps: summary.repetitionCount,
      validReps: summary.repetitionCount,
    };
  }

  return {
    durationMs: summary.activeDurationMs,
    totalReps: 0,
    validReps: 0,
  };
}
