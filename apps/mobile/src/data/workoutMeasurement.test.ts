import { createWorkoutMeasurement } from './workoutMeasurement';

describe('createWorkoutMeasurement', () => {
  it('uploads guided repetitions as completion without inventing a score', () => {
    expect(
      createWorkoutMeasurement({
        activeDurationMs: 18_000,
        elapsedTimeMs: 20_000,
        repetitionCount: 8,
        targetType: 'repetitions',
      }),
    ).toEqual({ durationMs: 20_000, totalReps: 8, validReps: 8 });
  });

  it('uploads only active hold time rather than paused wall-clock time', () => {
    expect(
      createWorkoutMeasurement({
        activeDurationMs: 20_000,
        elapsedTimeMs: 35_000,
        repetitionCount: 0,
        targetType: 'duration_ms',
      }),
    ).toEqual({ durationMs: 20_000, totalReps: 0, validReps: 0 });
  });
});
