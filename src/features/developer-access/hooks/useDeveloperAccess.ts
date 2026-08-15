"use client";

import { useEffect, useState } from 'react';

import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  type DeveloperAccessProjection,
} from '@/features/developer-access/model';
interface DeveloperAccessState {
  sessionKey: string | null;
  projection: DeveloperAccessProjection;
}

export const useDeveloperAccess = (
  sessionKey: string | null,
): DeveloperAccessProjection & { isLoading: boolean } => {
  const [state, setState] = useState<DeveloperAccessState>({
    sessionKey: null,
    projection: EMPTY_DEVELOPER_ACCESS_PROJECTION,
  });

  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;

    void fetch('/api/developer-access', { cache: 'no-store' })
      .then(async (response) => response.ok
        ? await response.json() as DeveloperAccessProjection
        : EMPTY_DEVELOPER_ACCESS_PROJECTION)
      .then((projection) => {
        if (!cancelled) setState({ sessionKey, projection });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ sessionKey, projection: EMPTY_DEVELOPER_ACCESS_PROJECTION });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  const isCurrentSession = Boolean(sessionKey && state.sessionKey === sessionKey);
  return {
    ...(isCurrentSession ? state.projection : EMPTY_DEVELOPER_ACCESS_PROJECTION),
    isLoading: Boolean(sessionKey && !isCurrentSession),
  };
};
