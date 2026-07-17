import {
  applyPainAssessment,
  createLiveCoachSessionSummary,
  isPostureScoringSupported,
  LiveCoachSummaryInput,
} from './sessionSummary';

const BASE_INPUT: LiveCoachSummaryInput = {
  sessionId: 'session-1',
  exerciseKey: 'body_squat',
  startedAtMs: 1_000,
  completedAtMs: 11_000,
  elapsedTimeMs: 10_000,
  targetType: 'repetitions',
  targetValue: 2,
  repetitionCount: 2,
  activeDurationMs: 8_000,
  nativeCameraAvailable: true,
  trackingConfidenceTotal: 2.7,
  trackingSampleCount: 3,
  eligibleTrackingSampleCount: 3,
  eligibleFormScores: [80, 90],
  painState: 'none',
  safetyStopped: false,
  requestedStopReason: 'completed',
  feedback: [{ message: 'Jaga kontrol.', severity: 'info' }],
};

it('creates a scored squat summary only after the target is met', () => {
  const summary = createLiveCoachSessionSummary(BASE_INPUT);

  expect(summary.targetMet).toBe(true);
  expect(summary.formScore).toBe(85);
  expect(summary.progressionEligible).toBe(true);
  expect(summary.repetitionSource).toBe('native');
});

it('recognizes only squat as posture-scored', () => {
  expect(isPostureScoringSupported('body_squat')).toBe(true);
  expect(
    ['incline_push_up', 'warrior_ii', 'tree_pose', 'jumping_jack'].some(
      isPostureScoringSupported,
    ),
  ).toBe(false);
  expect(isPostureScoringSupported('unsupported_movement')).toBe(false);
});

it('keeps incline push-up guided and unscored even if native form data arrives', () => {
  const summary = createLiveCoachSessionSummary({
    ...BASE_INPUT,
    exerciseKey: 'incline_push_up',
    eligibleFormScores: [100],
  });

  expect(summary.coachingMode).toBe('guided_practice');
  expect(summary.formScore).toBeNull();
  expect(summary.progressionEligible).toBe(false);
  expect(summary.repetitionSource).toBe('user_confirmed');
  expect(summary.stopReason).toBe('completed');
});

it('rejects scoring when tracking confidence is low', () => {
  const summary = createLiveCoachSessionSummary({
    ...BASE_INPUT,
    trackingConfidenceTotal: 1.5,
    eligibleTrackingSampleCount: 1,
  });

  expect(summary.confidenceEligible).toBe(false);
  expect(summary.formScore).toBeNull();
  expect(summary.progressionEligible).toBe(false);
  expect(summary.stopReason).toBe('tracking_unavailable');
});

it('uses guided timer completion for yoga without a fake form score', () => {
  const summary = createLiveCoachSessionSummary({
    ...BASE_INPUT,
    exerciseKey: 'warrior_ii',
    targetType: 'duration_ms',
    targetValue: 20_000,
    repetitionCount: 0,
    activeDurationMs: 20_000,
    eligibleFormScores: [88, 92],
  });

  expect(summary.targetMet).toBe(true);
  expect(summary.repetitionSource).toBe('none');
  expect(summary.activeDurationMs).toBe(20_000);
  expect(summary.durationSource).toBe('session_timer');
  expect(summary.formScore).toBeNull();
  expect(summary.coachingMode).toBe('guided_practice');
  expect(summary.progressionEligible).toBe(false);
  expect(summary.stopReason).toBe('completed');
});

it('keeps low-confidence guided holds unscored without misreporting tracking failure', () => {
  const summary = createLiveCoachSessionSummary({
    ...BASE_INPUT,
    exerciseKey: 'tree_pose',
    targetType: 'duration_ms',
    targetValue: 15_000,
    repetitionCount: 0,
    activeDurationMs: 15_000,
    trackingConfidenceTotal: 1.5,
    eligibleTrackingSampleCount: 1,
    eligibleFormScores: [100],
  });

  expect(summary.confidenceEligible).toBe(false);
  expect(summary.formScore).toBeNull();
  expect(summary.progressionEligible).toBe(false);
  expect(summary.stopReason).toBe('completed');
  expect(summary.qualityState).toBe('guided_practice');
});

it('fails unknown movements closed as guided and unscored', () => {
  const summary = createLiveCoachSessionSummary({
    ...BASE_INPUT,
    exerciseKey: 'unknown_movement',
    eligibleFormScores: [100],
  });

  expect(summary.coachingMode).toBe('guided_practice');
  expect(summary.formScore).toBeNull();
  expect(summary.progressionEligible).toBe(false);
  expect(summary.repetitionSource).toBe('user_confirmed');
});

it('keeps progression suppressed until pain is assessed and after pain', () => {
  const pending = createLiveCoachSessionSummary({
    ...BASE_INPUT,
    painState: 'not_assessed',
  });

  expect(pending.qualityState).toBe('awaiting_pain_check');
  expect(pending.progressionEligible).toBe(false);
  expect(applyPainAssessment(pending, false).progressionEligible).toBe(true);

  const painful = applyPainAssessment(pending, true);
  expect(painful.qualityState).toBe('pain_reported');
  expect(painful.progressionEligible).toBe(false);
  expect(painful.stopReason).toBe('pain_reported');
});
