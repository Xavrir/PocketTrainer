import { NativeEventEmitter, NativeModules } from 'react-native';
import type { OfflineStoreAdapter, PendingWorkout } from './types';

type NativeOfflineStore = Readonly<{
  addListener: (eventName: string) => void;
  createId: () => Promise<string>;
  enqueueWorkout: (
    clientSessionId: string,
    payloadJson: string,
    summaryJson: string,
  ) => Promise<void>;
  getStatus: () => Promise<{
    failedCount: number;
    lastSyncedAt: number | null;
    pendingCount: number;
  }>;
  getSyncedWorkout: (clientSessionId: string) => Promise<string | null>;
  initialize: (
    ownerId: string,
  ) => Promise<{ encrypted: boolean; schemaVersion: number }>;
  listPendingWorkouts: (limit: number) => Promise<PendingWorkout[]>;
  loadBootstrap: () => Promise<string | null>;
  loadCatalog: () => Promise<string | null>;
  loadPlan: () => Promise<string | null>;
  loadProgress: () => Promise<string | null>;
  loadWorkoutResultState: (clientSessionId: string) => Promise<string | null>;
  markWorkoutSynced: (
    clientSessionId: string,
    authoritativeJson: string,
  ) => Promise<void>;
  recordAttemptFailure: (
    clientSessionId: string,
    errorCode: string,
    nextAttemptAt: number,
  ) => Promise<void>;
  removeListeners: (count: number) => void;
  saveBootstrap: (payloadJson: string, revision: number) => Promise<void>;
}>;

const nativeStore = NativeModules.PocketTrainerOfflineStore as
  | NativeOfflineStore
  | undefined;
const NETWORK_AVAILABLE_EVENT = 'PocketTrainerNetworkAvailable';

function requireNativeStore(): NativeOfflineStore {
  if (!nativeStore) {
    throw new Error('Encrypted Android offline storage is unavailable.');
  }
  return nativeStore;
}

export const offlineStore: OfflineStoreAdapter = {
  available: Boolean(nativeStore),
  createId() {
    return requireNativeStore().createId();
  },
  enqueueWorkout(
    clientSessionId: string,
    payloadJson: string,
    summaryJson: string,
  ) {
    return requireNativeStore().enqueueWorkout(
      clientSessionId,
      payloadJson,
      summaryJson,
    );
  },
  getStatus() {
    return requireNativeStore().getStatus();
  },
  getSyncedWorkout(clientSessionId: string) {
    return requireNativeStore().getSyncedWorkout(clientSessionId);
  },
  initialize(ownerId: string) {
    return requireNativeStore().initialize(ownerId);
  },
  listPendingWorkouts(limit = 20) {
    return requireNativeStore().listPendingWorkouts(limit);
  },
  loadBootstrap() {
    return requireNativeStore().loadBootstrap();
  },
  loadCatalog() {
    return requireNativeStore().loadCatalog();
  },
  loadPlan() {
    return requireNativeStore().loadPlan();
  },
  loadProgress() {
    return requireNativeStore().loadProgress();
  },
  loadWorkoutResultState(clientSessionId: string) {
    return requireNativeStore().loadWorkoutResultState(clientSessionId);
  },
  markWorkoutSynced(clientSessionId: string, authoritativeJson: string) {
    return requireNativeStore().markWorkoutSynced(
      clientSessionId,
      authoritativeJson,
    );
  },
  recordAttemptFailure(
    clientSessionId: string,
    errorCode: string,
    nextAttemptAt: number,
  ) {
    return requireNativeStore().recordAttemptFailure(
      clientSessionId,
      errorCode,
      nextAttemptAt,
    );
  },
  saveBootstrap(payloadJson: string, revision: number) {
    return requireNativeStore().saveBootstrap(payloadJson, revision);
  },
  subscribeToNetworkAvailable(listener: () => void) {
    const store = requireNativeStore();
    const emitter = new NativeEventEmitter(store);
    const subscription = emitter.addListener(NETWORK_AVAILABLE_EVENT, listener);
    return () => subscription.remove();
  },
};
