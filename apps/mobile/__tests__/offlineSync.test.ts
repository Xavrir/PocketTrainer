import {
  ApiClientError,
  completeWorkoutFlow,
  type CompleteWorkoutFlowInput,
  type CompleteWorkoutFlowResult,
} from '../src/api';
import { offlineStore } from '../src/offline/offlineStore';
import {
  queueAndCompleteWorkout,
  syncPendingWorkouts,
} from '../src/offline/sync';

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return { ...actual, completeWorkoutFlow: jest.fn() };
});

jest.mock('../src/offline/offlineStore', () => ({
  offlineStore: {
    enqueueWorkout: jest.fn(),
    listPendingWorkouts: jest.fn(),
    markWorkoutSynced: jest.fn(),
    recordAttemptFailure: jest.fn(),
  },
}));

const attempt: CompleteWorkoutFlowInput = {
  createIdempotencyKey: 'session-1:create',
  resultsIdempotencyKey: 'session-1:results',
  completionIdempotencyKey: 'session-1:complete',
  create: {
    applicationVersion: '0.2.0',
    lessonId: 'lesson-1',
    startedAt: '2026-07-16T12:00:00.000Z',
  },
  results: { results: [] },
  completion: {
    completedAt: '2026-07-16T12:01:00.000Z',
    painReported: false,
    perceivedDifficulty: 5,
  },
};

const workoutSession = {
  id: 'server-session-1',
  lessonId: 'lesson-1',
  status: 'in_progress' as const,
  startedAt: '2026-07-16T12:00:00.000Z',
  results: [],
};

const result: CompleteWorkoutFlowResult = {
  createdSession: workoutSession,
  sessionWithResults: workoutSession,
  completion: {
    xpAwarded: 40,
    xpCapped: false,
    totalXp: 140,
    level: 2,
    masteryChanges: [],
    newlyUnlockedLessonIds: [],
    planRevision: 3,
    progressionSuppressed: false,
  },
};

beforeEach(() => jest.clearAllMocks());

it('commits the encrypted queue before attempting the network workflow', async () => {
  const order: string[] = [];
  jest.mocked(offlineStore.enqueueWorkout).mockImplementation(async () => {
    order.push('local');
  });
  jest.mocked(completeWorkoutFlow).mockImplementation(async () => {
    order.push('network');
    return result;
  });

  const completed = await queueAndCompleteWorkout(attempt, {
    repetitionCount: 8,
  });

  expect(order).toEqual(['local', 'network']);
  expect(completed).toEqual({ outcome: 'server_confirmed', result });
  expect(offlineStore.markWorkoutSynced).toHaveBeenCalledWith(
    'session-1',
    JSON.stringify(result),
  );
});

it('shows saved offline only after a durable insert and recoverable failure', async () => {
  jest.mocked(completeWorkoutFlow).mockRejectedValue(
    new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'offline',
      recoverable: true,
      status: 0,
    }),
  );

  await expect(
    queueAndCompleteWorkout(attempt, { repetitionCount: 8 }),
  ).resolves.toEqual({ outcome: 'saved_offline' });
  expect(offlineStore.enqueueWorkout).toHaveBeenCalledTimes(1);
  expect(offlineStore.recordAttemptFailure).toHaveBeenCalledWith(
    'session-1',
    'NETWORK_ERROR',
    expect.any(Number),
  );
});

it('replays the immutable workflow and acknowledges the authoritative result once', async () => {
  jest.mocked(offlineStore.listPendingWorkouts).mockResolvedValue([
    {
      attemptCount: 2,
      clientSessionId: 'session-1',
      nextAttemptAt: 0,
      payloadJson: JSON.stringify(attempt),
      summaryJson: JSON.stringify({ repetitionCount: 8 }),
    },
  ]);
  jest.mocked(completeWorkoutFlow).mockResolvedValue(result);
  const onSynced = jest.fn();

  await syncPendingWorkouts(onSynced);

  expect(completeWorkoutFlow).toHaveBeenCalledWith(attempt);
  expect(offlineStore.markWorkoutSynced).toHaveBeenCalledWith(
    'session-1',
    JSON.stringify(result),
  );
  expect(onSynced).toHaveBeenCalledWith({
    clientSessionId: 'session-1',
    result,
  });
});

it('recovers an ambiguous completion after process restart with the same keys', async () => {
  jest.mocked(completeWorkoutFlow).mockRejectedValueOnce(
    new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'The server committed but the response was lost.',
      recoverable: true,
      status: 0,
    }),
  );

  await expect(
    queueAndCompleteWorkout(attempt, { repetitionCount: 8 }),
  ).resolves.toEqual({ outcome: 'saved_offline' });

  jest.mocked(offlineStore.listPendingWorkouts).mockResolvedValue([
    {
      attemptCount: 1,
      clientSessionId: 'session-1',
      nextAttemptAt: 0,
      payloadJson: JSON.stringify(attempt),
      summaryJson: JSON.stringify({ repetitionCount: 8 }),
    },
  ]);
  jest.mocked(completeWorkoutFlow).mockResolvedValueOnce(result);

  const onSynced = jest.fn();
  await syncPendingWorkouts(onSynced);

  expect(completeWorkoutFlow).toHaveBeenNthCalledWith(1, attempt);
  expect(completeWorkoutFlow).toHaveBeenNthCalledWith(2, attempt);
  expect(offlineStore.markWorkoutSynced).toHaveBeenCalledTimes(1);
  expect(offlineStore.markWorkoutSynced).toHaveBeenCalledWith(
    'session-1',
    JSON.stringify(result),
  );
  expect(onSynced).toHaveBeenCalledWith({
    clientSessionId: 'session-1',
    result,
  });
});
