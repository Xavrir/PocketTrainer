import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/apiClient';
import { adaptCourseCatalog } from './catalogAdapter';
import type { CourseCatalogState, CourseCatalogView } from './types';

type UseCourseCatalogOptions = Readonly<{
  enabled?: boolean;
}>;

export function useCourseCatalog(
  options: UseCourseCatalogOptions = {},
): CourseCatalogState {
  const enabled = options.enabled ?? true;
  const [catalog, setCatalog] = useState<CourseCatalogView | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const refresh = useCallback(() => {
    setRequestVersion(version => version + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch('/v1/bootstrap')
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Catalog request failed (${response.status}).`);
        }
        const payload: unknown = await response.json();
        return adaptCourseCatalog(payload);
      })
      .then(nextCatalog => {
        if (active) setCatalog(nextCatalog);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'Catalog tidak dapat dimuat.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, requestVersion]);

  return { catalog, loading, error, refresh };
}
