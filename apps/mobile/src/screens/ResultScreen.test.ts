import { describeResultMetric, type ResultSessionData } from './ResultScreen';

const baseSession: ResultSessionData = {
  exerciseLabel: 'Incline Push-up',
  exerciseKey: 'incline_push_up',
  targetType: 'reps',
  targetValue: 8,
  completedValue: 8,
  totalReps: 8,
  validReps: 0,
  durationMs: 30_000,
  formScore: null,
  trackingEligible: false,
  scoringSupported: false,
};

describe('describeResultMetric', () => {
  it('shows completed guided repetitions without inventing valid reps', () => {
    expect(describeResultMetric(baseSession)).toEqual({
      caption: 'MODE TERPANDU',
      metric: '8 / 8',
      scoreEligible: false,
      targetUnit: 'repetisi terpandu',
    });
  });

  it('labels low-confidence squat repetitions as unscored', () => {
    expect(
      describeResultMetric({
        ...baseSession,
        exerciseKey: 'body_squat',
        exerciseLabel: 'Body Squat',
        scoringSupported: true,
      }),
    ).toEqual({
      caption: 'TIDAK DINILAI',
      metric: '8 / 8',
      scoreEligible: false,
      targetUnit: 'repetisi selesai (tidak dinilai)',
    });
  });
});
