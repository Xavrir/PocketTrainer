import type { LiveCoachSessionSummary } from '../native/sessionSummary';
import {
  createAssessmentEvidence,
  createAssessmentLiveRequest,
} from './evidence';

function summary(
  overrides: Partial<LiveCoachSessionSummary> = {},
): LiveCoachSessionSummary {
  return {
    sessionId: 'session-1',
    exerciseKey: 'body_squat',
    startedAt: '2026-07-17T00:00:00.000Z',
    completedAt: '2026-07-17T00:00:12.000Z',
    elapsedTimeMs: 12_000,
    targetType: 'repetitions',
    targetValue: 3,
    targetMet: true,
    coachingMode: 'posture_scored',
    repetitionCount: 3,
    repetitionSource: 'native',
    activeDurationMs: 8_000,
    durationSource: 'tracking_eligible',
    averageTrackingConfidence: 0.92,
    confidenceEligible: true,
    formScore: 84,
    painState: 'not_assessed',
    qualityState: 'awaiting_pain_check',
    progressionEligible: false,
    stopReason: 'completed',
    feedback: [],
    ...overrides,
  };
}

describe('assessment evidence', () => {
  it('creates the fixed three-rep squat launch contract', () => {
    expect(createAssessmentLiveRequest(' assessment-1 ')).toEqual({
      assessmentId: 'assessment-1',
      exerciseKey: 'body_squat',
      targetType: 'repetitions',
      targetValue: 3,
    });
  });

  it('submits observed squat evidence without a client-selected level', () => {
    const evidence = createAssessmentEvidence(
      ' server-workout-session-1 ',
      summary(),
      false,
    );

    expect(evidence).toEqual({
      squatSessionId: 'server-workout-session-1',
      targetReps: 3,
      validReps: 3,
      durationMs: 12_000,
      confidenceEligible: true,
      formScore: 84,
      painReported: false,
    });
    expect(evidence).not.toHaveProperty('recommendedLevel');
  });

  it('cannot expose a form score when confidence is ineligible', () => {
    expect(
      createAssessmentEvidence(
        'server-workout-session-1',
        summary({ confidenceEligible: false, formScore: null }),
        false,
      ),
    ).toMatchObject({
      confidenceEligible: false,
      formScore: null,
    });
  });

  it('preserves pain as progression-suppressing evidence', () => {
    expect(
      createAssessmentEvidence('server-workout-session-1', summary(), true),
    ).toMatchObject({
      painReported: true,
      formScore: null,
    });
  });

  it('rejects unsupported guided movements', () => {
    expect(() =>
      createAssessmentEvidence(
        'server-workout-session-1',
        summary({ exerciseKey: 'tree_pose', coachingMode: 'guided_practice' }),
        false,
      ),
    ).toThrow('only supported for posture-scored body squats');
  });
});
