import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiClientError,
  getDailyNutrition,
  getFoodEntries,
  getBootstrap,
  persistOnboarding,
  pocketTrainerApi,
  type Bootstrap,
  type CompleteWorkoutFlowInput,
  type CompleteWorkoutFlowResult,
  type DailyNutrition,
  type FoodEntry,
  type PersistOnboardingInput,
  type PersistOnboardingResult,
} from '../api';
import type { OfflineRuntime } from '../offline';

export type ApiLoadState<T> = {
  data: T | null;
  error: ApiClientError | null;
  loading: boolean;
  source?: 'offline' | 'server';
};

function asApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;
  return new ApiClientError({
    cause: error,
    code: 'UNEXPECTED_CLIENT_ERROR',
    message: 'The client could not complete the request.',
    recoverable: true,
    status: 0,
  });
}

export function usePocketTrainerApi() {
  return pocketTrainerApi;
}

function useNutritionResource<T>(
  enabled: boolean,
  request: (signal: AbortSignal) => Promise<T>,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ApiLoadState<T>>({
    data: null,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState(current => ({ ...current, loading: false }));
      return;
    }
    const controller = new AbortController();
    setState(current => ({ ...current, error: null, loading: true }));
    request(controller.signal)
      .then(data => {
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false, source: 'server' });
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setState({
            data: null,
            error: asApiClientError(error),
            loading: false,
          });
        }
      });
    return () => controller.abort();
  }, [enabled, request, revision]);

  const reload = useCallback(() => setRevision(value => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

export function useFoodEntries(date?: string, enabled = true) {
  const request = useCallback(
    (signal: AbortSignal) => getFoodEntries(date, { signal }),
    [date],
  );
  return useNutritionResource<FoodEntry[]>(enabled, request);
}

export function useDailyNutrition(date: string, enabled = true) {
  const request = useCallback(
    (signal: AbortSignal) => getDailyNutrition(date, { signal }),
    [date],
  );
  return useNutritionResource<DailyNutrition>(enabled, request);
}

export function useBootstrapData(
  enabled = true,
  offlineRuntime?: OfflineRuntime,
) {
  const loadOfflineBootstrap = offlineRuntime?.loadBootstrap;
  const saveOfflineBootstrap = offlineRuntime?.saveBootstrap;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ApiLoadState<Bootstrap>>({
    data: null,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState(current => ({ ...current, loading: false }));
      return;
    }
    const controller = new AbortController();
    setState(current => ({ ...current, error: null, loading: true }));
    getBootstrap({ signal: controller.signal })
      .then(async data => {
        await saveOfflineBootstrap?.(data);
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false, source: 'server' });
        }
      })
      .catch(async error => {
        if (controller.signal.aborted) return;
        const cached = await loadOfflineBootstrap?.();
        if (controller.signal.aborted) return;
        if (cached) {
          setState({
            data: cached,
            error: asApiClientError(error),
            loading: false,
            source: 'offline',
          });
          return;
        }
        setState({
          data: null,
          error: asApiClientError(error),
          loading: false,
        });
      });
    return () => controller.abort();
  }, [enabled, loadOfflineBootstrap, revision, saveOfflineBootstrap]);

  const reload = useCallback(() => setRevision(value => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

export function useOnboardingPersistence() {
  const [state, setState] = useState<ApiLoadState<PersistOnboardingResult>>({
    data: null,
    error: null,
    loading: false,
  });
  const save = useCallback(async (input: PersistOnboardingInput) => {
    setState(current => ({ ...current, error: null, loading: true }));
    try {
      const data = await persistOnboarding(input);
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      const apiError = asApiClientError(error);
      setState({ data: null, error: apiError, loading: false });
      throw apiError;
    }
  }, []);
  return useMemo(() => ({ ...state, save }), [save, state]);
}

export function useWorkoutCompletion(offlineRuntime?: OfflineRuntime) {
  const [state, setState] = useState<ApiLoadState<CompleteWorkoutFlowResult>>({
    data: null,
    error: null,
    loading: false,
  });
  const complete = useCallback(
    async (input: CompleteWorkoutFlowInput, summary: unknown) => {
      setState(current => ({ ...current, error: null, loading: true }));
      try {
        if (!offlineRuntime) {
          throw new Error('Encrypted offline runtime is not configured.');
        }
        const durable = await offlineRuntime.queueAndCompleteWorkout(
          input,
          summary,
        );
        const data =
          durable.outcome === 'server_confirmed' ? durable.result : null;
        setState({ data, error: null, loading: false });
        return durable;
      } catch (error) {
        const apiError = asApiClientError(error);
        setState({ data: null, error: apiError, loading: false });
        throw apiError;
      }
    },
    [offlineRuntime],
  );
  return useMemo(() => ({ complete, ...state }), [complete, state]);
}
