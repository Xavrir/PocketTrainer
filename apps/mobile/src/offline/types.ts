import type {
  Bootstrap,
  CompleteWorkoutFlowInput,
  CompleteWorkoutFlowResult,
} from '../api';

export type PendingWorkout = Readonly<{
  attemptCount: number;
  clientSessionId: string;
  nextAttemptAt: number;
  payloadJson: string;
  summaryJson: string;
}>;

export type NativeOfflineStatus = Readonly<{
  failedCount: number;
  lastSyncedAt: number | null;
  pendingCount: number;
}>;

export type OfflineStoreAdapter = Readonly<{
  available: boolean;
  createId: () => Promise<string>;
  enqueueWorkout: (
    clientSessionId: string,
    payloadJson: string,
    summaryJson: string,
  ) => Promise<void>;
  getStatus: () => Promise<NativeOfflineStatus>;
  getSyncedWorkout: (clientSessionId: string) => Promise<string | null>;
  initialize: (
    ownerId: string,
  ) => Promise<{ encrypted: boolean; schemaVersion: number }>;
  listPendingWorkouts: (limit?: number) => Promise<PendingWorkout[]>;
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
  saveBootstrap: (payloadJson: string, revision: number) => Promise<void>;
  subscribeToNetworkAvailable: (listener: () => void) => () => void;
}>;

export type OfflineStoreStatus = Readonly<{
  encrypted: boolean;
  failedCount: number;
  initialized: boolean;
  lastSyncedAt: number | null;
  pendingCount: number;
  schemaVersion: number;
}>;

export type DurableWorkoutCompletion =
  | Readonly<{
      outcome: 'server_confirmed';
      result: CompleteWorkoutFlowResult;
    }>
  | Readonly<{
      outcome: 'saved_offline';
    }>;

export type SyncedWorkout = Readonly<{
  clientSessionId: string;
  result: CompleteWorkoutFlowResult;
}>;

export type OfflineRuntime = Readonly<{
  available: boolean;
  createId: () => Promise<string>;
  initialized: boolean;
  lastSyncedWorkout: SyncedWorkout | null;
  loadBootstrap: () => Promise<Bootstrap | null>;
  queueAndCompleteWorkout: (
    input: CompleteWorkoutFlowInput,
    summary: unknown,
  ) => Promise<DurableWorkoutCompletion>;
  refreshStatus: () => Promise<void>;
  saveBootstrap: (bootstrap: Bootstrap) => Promise<void>;
  status: OfflineStoreStatus;
  syncPending: () => Promise<void>;
}>;
