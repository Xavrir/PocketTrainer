import type { OfflineStoreAdapter } from './types';

const unavailable = <T>(): Promise<T> =>
  Promise.reject(new Error('Encrypted offline storage is Android-only.'));

export const offlineStore: OfflineStoreAdapter = {
  available: false,
  createId: async () => {
    const cryptoApi = (
      globalThis as typeof globalThis & {
        crypto?: { randomUUID?: () => string };
      }
    ).crypto;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
    throw new Error('A cryptographically secure UUID source is unavailable.');
  },
  enqueueWorkout: () => unavailable<void>(),
  getStatus: () => unavailable(),
  getSyncedWorkout: () => unavailable(),
  initialize: () => unavailable(),
  listPendingWorkouts: () => unavailable(),
  loadBootstrap: () => unavailable(),
  loadCatalog: () => unavailable(),
  loadPlan: () => unavailable(),
  loadProgress: () => unavailable(),
  loadWorkoutResultState: () => unavailable(),
  markWorkoutSynced: () => unavailable<void>(),
  recordAttemptFailure: () => unavailable<void>(),
  saveBootstrap: () => unavailable<void>(),
  subscribeToNetworkAvailable: () => () => undefined,
};
