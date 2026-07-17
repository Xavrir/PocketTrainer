import { ApiClientError } from '../../api';
import {
  runNutritionMutationLocalFirst,
  type NutritionLocalFirstAdapter,
} from './localFirst';

type Input = { calories: number };
type Output = { id: string };

function adapter(
  send: NutritionLocalFirstAdapter<Input, Output>['send'],
): NutritionLocalFirstAdapter<Input, Output> {
  return {
    markServerConfirmed: jest.fn(async () => undefined),
    saveOffline: jest.fn(async () => ({ localId: 'local-1' })),
    send,
  };
}

describe('runNutritionMutationLocalFirst', () => {
  it('keeps a mutation saved offline when immediate sync is disabled', async () => {
    const changes: string[] = [];
    const result = await runNutritionMutationLocalFirst(
      { calories: 400 },
      {
        adapter: adapter(jest.fn()),
        idempotencyKey: 'nutrition-1',
        onStateChange: change => changes.push(change.state),
        syncImmediately: false,
      },
    );

    expect(result).toEqual({ localId: 'local-1', state: 'saved_offline' });
    expect(changes).toEqual(['saved_offline']);
  });

  it('transitions through waiting to server confirmed', async () => {
    const send = jest.fn(async () => ({ id: 'server-1' }));
    const changes: string[] = [];
    const result = await runNutritionMutationLocalFirst(
      { calories: 500 },
      {
        adapter: adapter(send),
        idempotencyKey: 'nutrition-2',
        onStateChange: change => changes.push(change.state),
      },
    );

    expect(result).toEqual({
      localId: 'local-1',
      serverValue: { id: 'server-1' },
      state: 'server_confirmed',
    });
    expect(changes).toEqual([
      'saved_offline',
      'waiting_to_sync',
      'server_confirmed',
    ]);
  });

  it('leaves recoverable failures waiting to sync', async () => {
    const error = new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'offline',
      recoverable: true,
      status: 0,
    });
    const changes: string[] = [];
    const result = await runNutritionMutationLocalFirst(
      { calories: 600 },
      {
        adapter: adapter(jest.fn(async () => Promise.reject(error))),
        idempotencyKey: 'nutrition-3',
        onStateChange: change => changes.push(change.state),
      },
    );

    expect(result).toEqual({
      error,
      localId: 'local-1',
      state: 'waiting_to_sync',
    });
    expect(changes).toEqual([
      'saved_offline',
      'waiting_to_sync',
      'waiting_to_sync',
    ]);
  });
});
