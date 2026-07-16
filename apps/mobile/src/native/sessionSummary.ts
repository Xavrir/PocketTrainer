export const MINIMUM_SCORING_CONFIDENCE = 0.6;

export const POSTURE_SCORING_EXERCISE_KEYS = [
  'body_squat',
  'incline_push_up',
  'warrior_ii',
  'tree_pose',
  'jumping_jack',
] as const;

export type LiveCoachTargetType = 'repetitions' | 'duration_ms';
export type LiveCoachPainState = 'not_assessed' | 'none' | 'reported';
export type LiveCoachMode = 'posture_scored' | 'guided_practice';
export type LiveCoachQualityState =
  | 'scored'
  | 'guided_practice'
  | 'insufficient_tracking'
  | 'awaiting_pain_check'
  | 'pain_reported'
  | 'safety_stopped'
  | 'user_stopped';

export type LiveCoachFeedback = Readonly<{
  message: string;
  severity: 'info' | 'caution' | 'stop';
}>;

export type LiveCoachSessionSummary = Readonly<{
  sessionId: string;
  exerciseKey: string;
  startedAt: string;
  completedAt: string;
  elapsedTimeMs: number;
  targetType: LiveCoachTargetType;
  targetValue: number;
  targetMet: boolean;
  coachingMode: LiveCoachMode;
  repetitionCount: number;
  repetitionSource: 'native' | 'user_confirmed' | 'none';
  activeDurationMs: number;
  durationSource: 'tracking_eligible' | 'session_timer';
  averageTrackingConfidence: number | null;
  confidenceEligible: boolean;
  formScore: number | null;
  painState: LiveCoachPainState;
  qualityState: LiveCoachQualityState;
  progressionEligible: boolean;
  stopReason:
    | 'completed'
    | 'pain_reported'
    | 'tracking_unavailable'
    | 'user_stopped';
  feedback: readonly LiveCoachFeedback[];
}>;

export type LiveCoachSummaryInput = Readonly<{
  sessionId: string;
  exerciseKey: string;
  startedAtMs: number;
  completedAtMs: number;
  elapsedTimeMs: number;
  targetType: LiveCoachTargetType;
  targetValue: number;
  repetitionCount: number;
  activeDurationMs: number;
  nativeCameraAvailable: boolean;
  trackingConfidenceTotal: number;
  trackingSampleCount: number;
  eligibleTrackingSampleCount: number;
  eligibleFormScores: readonly number[];
  painState: LiveCoachPainState;
  safetyStopped: boolean;
  requestedStopReason: 'completed' | 'user_stopped';
  feedback: readonly LiveCoachFeedback[];
}>;

export function isPostureScoringSupported(exerciseKey: string): boolean {
  return (POSTURE_SCORING_EXERCISE_KEYS as readonly string[]).includes(exerciseKey);
}

export function createLiveCoachSessionSummary(
  input: LiveCoachSummaryInput,
): LiveCoachSessionSummary {
  const coachingMode: LiveCoachMode =
    input.nativeCameraAvailable && isPostureScoringSupported(input.exerciseKey)
      ? 'posture_scored'
      : 'guided_practice';
  const targetMet =
    input.targetValue > 0 &&
    (input.targetType === 'repetitions'
      ? input.repetitionCount >= input.targetValue
      : input.activeDurationMs >= input.targetValue);
  const averageTrackingConfidence = input.trackingSampleCount
    ? input.trackingConfidenceTotal / input.trackingSampleCount
    : null;
  const confidenceEligible =
    averageTrackingConfidence !== null &&
    averageTrackingConfidence >= MINIMUM_SCORING_CONFIDENCE &&
    input.eligibleTrackingSampleCount / input.trackingSampleCount >= 0.8;
  const formScore =
    coachingMode === 'posture_scored' &&
    confidenceEligible &&
    input.eligibleFormScores.length
      ? input.eligibleFormScores.reduce((total, score) => total + score, 0) /
        input.eligibleFormScores.length
      : null;

  const stopReason = resolveStopReason(input, confidenceEligible);
  const qualityState = resolveQualityState({
    coachingMode,
    confidenceEligible,
    formScore,
    painState: input.painState,
    safetyStopped: input.safetyStopped,
    stopReason,
  });
  const progressionEligible =
    stopReason === 'completed' &&
    targetMet &&
    input.painState === 'none' &&
    coachingMode === 'posture_scored' &&
    confidenceEligible &&
    formScore !== null;

  return {
    sessionId: input.sessionId,
    exerciseKey: input.exerciseKey,
    startedAt: new Date(input.startedAtMs).toISOString(),
    completedAt: new Date(input.completedAtMs).toISOString(),
    elapsedTimeMs: Math.max(0, Math.round(input.elapsedTimeMs)),
    targetType: input.targetType,
    targetValue: input.targetValue,
    targetMet,
    coachingMode,
    repetitionCount: input.repetitionCount,
    repetitionSource:
      input.targetType !== 'repetitions'
        ? 'none'
        : coachingMode === 'posture_scored'
        ? 'native'
        : 'user_confirmed',
    activeDurationMs: Math.max(0, Math.round(input.activeDurationMs)),
    durationSource: input.nativeCameraAvailable
      ? 'tracking_eligible'
      : 'session_timer',
    averageTrackingConfidence,
    confidenceEligible,
    formScore,
    painState: input.painState,
    qualityState,
    progressionEligible,
    stopReason,
    feedback: input.feedback,
  };
}

export function applyPainAssessment(
  summary: LiveCoachSessionSummary,
  painReported: boolean,
): LiveCoachSessionSummary {
  if (painReported) {
    return {
      ...summary,
      painState: 'reported',
      progressionEligible: false,
      qualityState: 'pain_reported',
      stopReason: 'pain_reported',
    };
  }

  const progressionEligible =
    summary.stopReason === 'completed' &&
    summary.targetMet &&
    summary.coachingMode === 'posture_scored' &&
    summary.confidenceEligible &&
    summary.formScore !== null;

  return {
    ...summary,
    painState: 'none',
    progressionEligible,
    qualityState:
      summary.coachingMode === 'guided_practice'
        ? 'guided_practice'
        : progressionEligible
        ? 'scored'
        : 'insufficient_tracking',
  };
}

function resolveStopReason(
  input: LiveCoachSummaryInput,
  confidenceEligible: boolean,
): LiveCoachSessionSummary['stopReason'] {
  if (input.painState === 'reported') return 'pain_reported';
  if (input.requestedStopReason === 'user_stopped') return 'user_stopped';
  if (
    input.nativeCameraAvailable &&
    isPostureScoringSupported(input.exerciseKey) &&
    !confidenceEligible
  ) {
    return 'tracking_unavailable';
  }
  return 'completed';
}

function resolveQualityState(input: {
  coachingMode: LiveCoachMode;
  confidenceEligible: boolean;
  formScore: number | null;
  painState: LiveCoachPainState;
  safetyStopped: boolean;
  stopReason: LiveCoachSessionSummary['stopReason'];
}): LiveCoachQualityState {
  if (input.painState === 'reported') return 'pain_reported';
  if (input.safetyStopped) return 'safety_stopped';
  if (input.stopReason === 'user_stopped') return 'user_stopped';
  if (input.coachingMode === 'guided_practice') return 'guided_practice';
  if (!input.confidenceEligible || input.formScore === null) {
    return 'insufficient_tracking';
  }
  if (input.painState === 'not_assessed') return 'awaiting_pain_check';
  return 'scored';
}
