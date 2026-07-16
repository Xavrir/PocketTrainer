import type {
  ExerciseDefinition,
  ExerciseStateDefinition,
  MetricPredicate,
  PoseMetric,
} from "@pockettrainer/contracts";

export type ExerciseRuntimeState = Readonly<{
  stateId: string;
  stateEnteredAtMs: number;
  lastFrameAtMs: number;
  pendingStateId: string | null;
  pendingStateSinceMs: number | null;
  validHoldDurationMs: number;
  trackingLostAtMs: number | null;
  alignmentLostAtMs: number | null;
  activePredicatesPassedLastFrame: boolean;
  cycleStartedAtMs: number | null;
}>;

export type ExerciseMetricFrame = Readonly<{
  timestampMs: number;
  trackingEligible: boolean;
  metrics: Readonly<Partial<Record<PoseMetric, number>>>;
}>;

export type StateMachineStep = Readonly<{
  runtime: ExerciseRuntimeState;
  transitioned: boolean;
  completed: boolean;
  reset: boolean;
}>;

export function createExerciseRuntimeState(
  definition: ExerciseDefinition,
  startedAtMs: number,
): ExerciseRuntimeState {
  assertTimestamp(startedAtMs, "startedAtMs");
  return freezeRuntime({
    stateId: definition.stateMachine.initialStateId,
    stateEnteredAtMs: startedAtMs,
    lastFrameAtMs: startedAtMs,
    pendingStateId: null,
    pendingStateSinceMs: null,
    validHoldDurationMs: 0,
    trackingLostAtMs: null,
    alignmentLostAtMs: null,
    activePredicatesPassedLastFrame: false,
    cycleStartedAtMs: null,
  });
}

export function advanceExerciseState(
  definition: ExerciseDefinition,
  runtime: ExerciseRuntimeState,
  frame: ExerciseMetricFrame,
): StateMachineStep {
  assertFrame(runtime, frame);
  if (!frame.trackingEligible) {
    return handleTrackingLoss(definition, runtime, frame.timestampMs);
  }
  if (
    definition.maximumRepDurationMs !== undefined &&
    runtime.cycleStartedAtMs !== null &&
    frame.timestampMs - runtime.cycleStartedAtMs > definition.maximumRepDurationMs
  ) {
    return resetRuntime(definition, runtime, frame.timestampMs);
  }

  const hold = definition.stateMachine.holdAccumulator;
  const activeState = hold === undefined
    ? undefined
    : definition.states.find((state) => state.id === hold.activeStateId);
  const isActive = activeState?.id === runtime.stateId;
  const activePasses = isActive && activeState !== undefined
    ? predicatesPass(activeState, frame.metrics, true)
    : false;
  const elapsedMs = frame.timestampMs - runtime.lastFrameAtMs;
  const validHoldDurationMs =
    isActive && activePasses && runtime.activePredicatesPassedLastFrame
      ? runtime.validHoldDurationMs + elapsedMs
      : runtime.validHoldDurationMs;

  if (isActive && !activePasses && hold !== undefined) {
    const alignmentLostAtMs = runtime.alignmentLostAtMs ?? frame.timestampMs;
    if (frame.timestampMs - alignmentLostAtMs >= hold.resetAfterAlignmentLossMs) {
      return resetRuntime(definition, runtime, frame.timestampMs);
    }
    return stableStep({
      ...runtime,
      lastFrameAtMs: frame.timestampMs,
      pendingStateId: null,
      pendingStateSinceMs: null,
      trackingLostAtMs: null,
      alignmentLostAtMs,
      activePredicatesPassedLastFrame: false,
    });
  }

  const metrics = { ...frame.metrics, valid_hold_duration_ms: validHoldDurationMs };
  const candidate = findTransitionCandidate(definition, runtime.stateId, metrics);
  if (candidate === undefined) {
    return stableStep({
      ...runtime,
      lastFrameAtMs: frame.timestampMs,
      validHoldDurationMs,
      pendingStateId: null,
      pendingStateSinceMs: null,
      trackingLostAtMs: null,
      alignmentLostAtMs: null,
      activePredicatesPassedLastFrame: activePasses,
    });
  }

  const pendingSince = runtime.pendingStateId === candidate.id && runtime.pendingStateSinceMs !== null
    ? runtime.pendingStateSinceMs
    : frame.timestampMs;
  if (frame.timestampMs - pendingSince < candidate.minimumDurationMs) {
    return stableStep({
      ...runtime,
      lastFrameAtMs: frame.timestampMs,
      validHoldDurationMs,
      pendingStateId: candidate.id,
      pendingStateSinceMs: pendingSince,
      trackingLostAtMs: null,
      alignmentLostAtMs: null,
      activePredicatesPassedLastFrame: activePasses,
    });
  }

  const transitionedRuntime = freezeRuntime({
    ...runtime,
    stateId: candidate.id,
    stateEnteredAtMs: frame.timestampMs,
    lastFrameAtMs: frame.timestampMs,
    validHoldDurationMs,
    pendingStateId: null,
    pendingStateSinceMs: null,
    trackingLostAtMs: null,
    alignmentLostAtMs: null,
    activePredicatesPassedLastFrame: candidate.id === hold?.activeStateId,
    cycleStartedAtMs:
      candidate.id === definition.stateMachine.initialStateId
        ? null
        : (runtime.cycleStartedAtMs ?? frame.timestampMs),
  });
  return Object.freeze({
    runtime: transitionedRuntime,
    transitioned: true,
    completed: candidate.terminal,
    reset: false,
  });
}

export function predicatePasses(
  predicate: MetricPredicate,
  metrics: Readonly<Partial<Record<PoseMetric, number>>>,
  applyHysteresis = false,
): boolean {
  const actual = metrics[predicate.metric];
  if (actual === undefined || !Number.isFinite(actual)) return false;
  const margin = applyHysteresis ? (predicate.hysteresis ?? 0) : 0;
  if (predicate.operator === "gt") return actual > predicate.value - margin;
  if (predicate.operator === "gte") return actual >= predicate.value - margin;
  if (predicate.operator === "lt") return actual < predicate.value + margin;
  if (predicate.operator === "lte") return actual <= predicate.value + margin;
  return predicate.maximum !== undefined &&
    actual >= predicate.value - margin &&
    actual <= predicate.maximum + margin;
}

function predicatesPass(
  state: ExerciseStateDefinition,
  metrics: Readonly<Partial<Record<PoseMetric, number>>>,
  applyHysteresis = false,
): boolean {
  return state.predicateMode === "all"
    ? state.predicates.every((predicate) => predicatePasses(predicate, metrics, applyHysteresis))
    : state.predicates.some((predicate) => predicatePasses(predicate, metrics, applyHysteresis));
}

function findTransitionCandidate(
  definition: ExerciseDefinition,
  currentStateId: string,
  metrics: Readonly<Partial<Record<PoseMetric, number>>>,
): ExerciseStateDefinition | undefined {
  const statesById = new Map(definition.states.map((state) => [state.id, state]));
  for (const stateId of definition.stateMachine.transitionPriority) {
    const state = statesById.get(stateId);
    if (
      state !== undefined &&
      state.id !== currentStateId &&
      state.allowedPreviousStates.includes(currentStateId) &&
      predicatesPass(state, metrics)
    ) {
      return state;
    }
  }
  return undefined;
}

function handleTrackingLoss(
  definition: ExerciseDefinition,
  runtime: ExerciseRuntimeState,
  timestampMs: number,
): StateMachineStep {
  const lostAt = runtime.trackingLostAtMs ?? timestampMs;
  const resetAfterMs =
    definition.stateMachine.holdAccumulator?.resetAfterTrackingLossMs ?? definition.trackingLossResetMs;
  if (timestampMs - lostAt >= resetAfterMs) {
    return resetRuntime(definition, runtime, timestampMs);
  }
  return stableStep({
    ...runtime,
    lastFrameAtMs: timestampMs,
    pendingStateId: null,
    pendingStateSinceMs: null,
    trackingLostAtMs: lostAt,
    activePredicatesPassedLastFrame: false,
  });
}

function resetRuntime(
  definition: ExerciseDefinition,
  runtime: ExerciseRuntimeState,
  timestampMs: number,
): StateMachineStep {
  return Object.freeze({
    runtime: freezeRuntime({
      ...runtime,
      stateId: definition.stateMachine.resetStateId,
      stateEnteredAtMs: timestampMs,
      lastFrameAtMs: timestampMs,
      pendingStateId: null,
      pendingStateSinceMs: null,
      validHoldDurationMs: 0,
      trackingLostAtMs: null,
      alignmentLostAtMs: null,
      activePredicatesPassedLastFrame: false,
      cycleStartedAtMs: null,
    }),
    transitioned: true,
    completed: false,
    reset: true,
  });
}

function stableStep(runtime: Omit<ExerciseRuntimeState, never>): StateMachineStep {
  return Object.freeze({
    runtime: freezeRuntime(runtime),
    transitioned: false,
    completed: false,
    reset: false,
  });
}

function freezeRuntime(runtime: ExerciseRuntimeState): ExerciseRuntimeState {
  return Object.freeze(runtime);
}

function assertFrame(runtime: ExerciseRuntimeState, frame: ExerciseMetricFrame): void {
  assertTimestamp(frame.timestampMs, "frame.timestampMs");
  if (frame.timestampMs < runtime.lastFrameAtMs) {
    throw new RangeError("frame timestamps must be monotonic");
  }
}

function assertTimestamp(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}
