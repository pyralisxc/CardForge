"use client";

import { useEffect, useState } from 'react';

import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
  type DeveloperAccessProjection,
  type DeveloperAccessSessionState,
} from '@/features/developer-access/model';

export const useDeveloperAccess = (
  sessionKey: string | null,
  initialState: DeveloperAccessSessionState = EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
): DeveloperAccessProjection & { isLoading: boolean } => {
  const [state, setState] = useState<DeveloperAccessSessionState>(initialState);

  useEffect(() => {
    if (!sessionKey || state.sessionKey === sessionKey) return;
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
  }, [sessionKey, state.sessionKey]);

  const isCurrentSession = Boolean(sessionKey && state.sessionKey === sessionKey);
  return {
    ...(isCurrentSession ? state.projection : EMPTY_DEVELOPER_ACCESS_PROJECTION),
    isLoading: Boolean(sessionKey && !isCurrentSession),
  };
};
