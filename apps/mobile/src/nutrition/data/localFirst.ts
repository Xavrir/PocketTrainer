import {
  ApiClientError,
  createFoodEntry,
  type ApiMutationOptions,
  type CreateFoodEntryInput,
  type FoodEntry,
} from '../../api';
import type { OfflineStoreStatus } from '../../offline';

export type NutritionSyncState =
  | 'saved_offline'
  | 'waiting_to_sync'
  | 'server_confirmed';

export type NutritionOfflineStatus = Pick<
  OfflineStoreStatus,
  'failedCount' | 'lastSyncedAt' | 'pendingCount'
>;

export type NutritionStateChange<T> = {
  error?: unknown;
  localId: string;
  state: NutritionSyncState;
  value?: T;
};

export type NutritionLocalFirstResult<T> =
  | {
      localId: string;
      state: 'saved_offline';
    }
  | {
      error: unknown;
      localId: string;
      state: 'waiting_to_sync';
    }
  | {
      localId: string;
      serverValue: T;
      state: 'server_confirmed';
    };

export type NutritionLocalFirstAdapter<TInput, TOutput> = {
  markServerConfirmed: (localId: string, value: TOutput) => Promise<void>;
  saveOffline: (input: TInput) => Promise<{ localId: string }>;
  send: (input: TInput, options: ApiMutationOptions) => Promise<TOutput>;
};

export type NutritionLocalFirstOptions<TInput, TOutput> = {
  adapter: NutritionLocalFirstAdapter<TInput, TOutput>;
  idempotencyKey: string;
  onStateChange?: (change: NutritionStateChange<TOutput>) => void;
  signal?: AbortSignal;
  syncImmediately?: boolean;
};

function isRecoverable(error: unknown): boolean {
  return !(error instanceof ApiClientError) || error.recoverable;
}

export async function runNutritionMutationLocalFirst<TInput, TOutput>(
  input: TInput,
  options: NutritionLocalFirstOptions<TInput, TOutput>,
): Promise<NutritionLocalFirstResult<TOutput>> {
  const local = await options.adapter.saveOffline(input);
  options.onStateChange?.({ localId: local.localId, state: 'saved_offline' });

  if (options.syncImmediately === false) {
    return { localId: local.localId, state: 'saved_offline' };
  }

  options.onStateChange?.({ localId: local.localId, state: 'waiting_to_sync' });
  try {
    const serverValue = await options.adapter.send(input, {
      idempotencyKey: options.idempotencyKey,
      signal: options.signal,
    });
    await options.adapter.markServerConfirmed(local.localId, serverValue);
    options.onStateChange?.({
      localId: local.localId,
      state: 'server_confirmed',
      value: serverValue,
    });
    return { localId: local.localId, serverValue, state: 'server_confirmed' };
  } catch (error) {
    if (!isRecoverable(error)) throw error;
    options.onStateChange?.({
      error,
      localId: local.localId,
      state: 'waiting_to_sync',
    });
    return { error, localId: local.localId, state: 'waiting_to_sync' };
  }
}

export function saveFoodEntryLocalFirst(
  input: CreateFoodEntryInput,
  options: Omit<
    NutritionLocalFirstOptions<CreateFoodEntryInput, FoodEntry>,
    'adapter'
  > & {
    adapter: Omit<
      NutritionLocalFirstAdapter<CreateFoodEntryInput, FoodEntry>,
      'send'
    > & {
      send?: NutritionLocalFirstAdapter<
        CreateFoodEntryInput,
        FoodEntry
      >['send'];
    };
  },
): Promise<NutritionLocalFirstResult<FoodEntry>> {
  return runNutritionMutationLocalFirst(input, {
    ...options,
    adapter: {
      ...options.adapter,
      send:
        options.adapter.send ??
        ((value, mutationOptions) => createFoodEntry(value, mutationOptions)),
    },
  });
}
