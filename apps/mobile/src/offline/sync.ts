import {
  ApiClientError,
  completeWorkoutFlow,
  type CompleteWorkoutFlowInput,
  type CompleteWorkoutFlowResult,
} from '../api';
import { offlineStore } from './offlineStore';
import type { DurableWorkoutCompletion, SyncedWorkout } from './types';

const MAX_BACKOFF_MS = 15 * 60 * 1000;

function clientSessionId(input: CompleteWorkoutFlowInput): string {
  const suffix = ':create';
  if (!input.createIdempotencyKey.endsWith(suffix)) {
    throw new Error('Workout create idempotency key is not session-scoped.');
  }
  return input.createIdempotencyKey.slice(0, -suffix.length);
}

function retryAt(attemptCount: number): number {
  const exponent = Math.min(Math.max(0, attemptCount), 8);
  return Date.now() + Math.min(MAX_BACKOFF_MS, 2 ** exponent * 1_000);
}

function errorCode(error: unknown): string {
  if (error instanceof ApiClientError) return error.code;
  return error instanceof Error ? error.name : 'UNKNOWN_SYNC_ERROR';
}

function canRemainOffline(error: unknown): boolean {
  return !(error instanceof ApiClientError) || error.recoverable;
}

export async function queueAndCompleteWorkout(
  input: CompleteWorkoutFlowInput,
  summary: unknown,
): Promise<DurableWorkoutCompletion> {
  const sessionId = clientSessionId(input);
  const alreadyConfirmed = typeof offlineStore.getSyncedWorkout === 'function'
    ? await offlineStore.getSyncedWorkout(sessionId)
    : null;
  if (alreadyConfirmed) {
    return {
      outcome: 'server_confirmed',
      result: JSON.parse(alreadyConfirmed) as CompleteWorkoutFlowResult,
    };
  }
  await offlineStore.enqueueWorkout(
    sessionId,
    JSON.stringify(input),
    JSON.stringify(summary),
  );

  try {
    const result = await completeWorkoutFlow(input);
    await offlineStore.markWorkoutSynced(sessionId, JSON.stringify(result));
    return { outcome: 'server_confirmed', result };
  } catch (error) {
    await offlineStore.recordAttemptFailure(
      sessionId,
      errorCode(error),
      retryAt(0),
    );
    if (!canRemainOffline(error)) throw error;
    return { outcome: 'saved_offline' };
  }
}

export async function syncPendingWorkouts(
  onSynced: (workout: SyncedWorkout) => void,
): Promise<void> {
  const pending = await offlineStore.listPendingWorkouts(20);
  for (const workout of pending) {
    let input: CompleteWorkoutFlowInput;
    try {
      input = JSON.parse(workout.payloadJson) as CompleteWorkoutFlowInput;
    } catch {
      await offlineStore.recordAttemptFailure(
        workout.clientSessionId,
        'INVALID_LOCAL_PAYLOAD',
        retryAt(workout.attemptCount + 1),
      );
      continue;
    }

    try {
      const result: CompleteWorkoutFlowResult = await completeWorkoutFlow(
        input,
      );
      await offlineStore.markWorkoutSynced(
        workout.clientSessionId,
        JSON.stringify(result),
      );
      onSynced({ clientSessionId: workout.clientSessionId, result });
    } catch (error) {
      await offlineStore.recordAttemptFailure(
        workout.clientSessionId,
        errorCode(error),
        retryAt(workout.attemptCount + 1),
      );
      if (error instanceof ApiClientError && !error.recoverable) continue;
      break;
    }
  }
}
