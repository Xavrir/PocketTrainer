import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Bootstrap, CompleteWorkoutFlowInput } from '../api';
import { offlineStore } from './offlineStore';
import { queueAndCompleteWorkout, syncPendingWorkouts } from './sync';
import type {
  OfflineRuntime,
  OfflineStoreStatus,
  SyncedWorkout,
} from './types';

const EMPTY_STATUS: OfflineStoreStatus = {
  encrypted: false,
  failedCount: 0,
  initialized: false,
  lastSyncedAt: null,
  pendingCount: 0,
  schemaVersion: 1,
};

export function useOfflineRuntime(ownerId?: string): OfflineRuntime {
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [lastSyncedWorkout, setLastSyncedWorkout] =
    useState<SyncedWorkout | null>(null);
  const syncing = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (!offlineStore.available || !initialized) return;
    const next = await offlineStore.getStatus();
    setStatus(current => ({ ...current, ...next, initialized: true }));
  }, [initialized]);

  const syncPending = useCallback(async () => {
    if (!offlineStore.available || !initialized || syncing.current) return;
    syncing.current = true;
    try {
      await syncPendingWorkouts(setLastSyncedWorkout);
      const next = await offlineStore.getStatus();
      setStatus(current => ({ ...current, ...next, initialized: true }));
    } finally {
      syncing.current = false;
    }
  }, [initialized]);

  useEffect(() => {
    let active = true;
    setInitialized(false);
    setStatus(EMPTY_STATUS);
    if (!ownerId || !offlineStore.available) return;
    offlineStore
      .initialize(ownerId)
      .then(async metadata => {
        if (!active) return;
        const next = await offlineStore.getStatus();
        if (!active) return;
        setInitialized(true);
        if (metadata.encrypted !== true) {
          throw new Error('Offline database did not confirm encryption.');
        }
        setStatus({
          encrypted: true,
          failedCount: next.failedCount,
          initialized: true,
          lastSyncedAt: next.lastSyncedAt,
          pendingCount: next.pendingCount,
          schemaVersion: metadata.schemaVersion,
        });
      })
      .catch(() => {
        if (active) setInitialized(false);
      });
    return () => {
      active = false;
    };
  }, [ownerId]);

  useEffect(() => {
    if (!initialized) return;
    const unsubscribe = offlineStore.subscribeToNetworkAvailable(() => {
      syncPending().catch(() => undefined);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') syncPending().catch(() => undefined);
    });
    syncPending().catch(() => undefined);
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [initialized, syncPending]);

  const loadBootstrap = useCallback(async (): Promise<Bootstrap | null> => {
    if (!initialized) return null;
    const payload = await offlineStore.loadBootstrap();
    if (!payload) return null;
    return JSON.parse(payload) as Bootstrap;
  }, [initialized]);

  const createId = useCallback(async () => offlineStore.createId(), []);

  const saveBootstrap = useCallback(
    async (bootstrap: Bootstrap) => {
      if (!initialized) return;
      await offlineStore.saveBootstrap(
        JSON.stringify(bootstrap),
        bootstrap.catalog.version,
      );
    },
    [initialized],
  );

  const queueWorkout = useCallback(
    async (input: CompleteWorkoutFlowInput, summary: unknown) => {
      if (!initialized) {
        throw new Error('Encrypted offline storage is not ready.');
      }
      const result = await queueAndCompleteWorkout(input, summary);
      await refreshStatus();
      return result;
    },
    [initialized, refreshStatus],
  );

  return useMemo(
    () => ({
      available: offlineStore.available,
      createId,
      initialized,
      lastSyncedWorkout,
      loadBootstrap,
      queueAndCompleteWorkout: queueWorkout,
      refreshStatus,
      saveBootstrap,
      status,
      syncPending,
    }),
    [
      createId,
      initialized,
      lastSyncedWorkout,
      loadBootstrap,
      queueWorkout,
      refreshStatus,
      saveBootstrap,
      status,
      syncPending,
    ],
  );
}
