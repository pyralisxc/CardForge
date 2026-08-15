"use client";

import { useEffect, useState } from 'react';

import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
  resolveDeveloperAccessProjectionForSession,
  shouldClearStoredDeveloperAccess,
  type DeveloperAccessProjection,
  type DeveloperAccessSessionState,
} from '@/features/developer-access/model';

export const useDeveloperAccess = (
  sessionKey: string | null,
  initialState: DeveloperAccessSessionState = EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
  isOwner = false,
): DeveloperAccessProjection & { isLoading: boolean } => {
  const [state, setState] = useState<DeveloperAccessSessionState>(initialState);

  useEffect(() => {
    if (!sessionKey || isOwner) {
      if (shouldClearStoredDeveloperAccess({ isOwner, sessionKey, state })) {
        setState(EMPTY_DEVELOPER_ACCESS_SESSION_STATE);
      }
      return;
    }
    if (state.sessionKey === sessionKey) return;
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
  }, [isOwner, sessionKey, state]);

  const isCurrentSession = Boolean(sessionKey && state.sessionKey === sessionKey);
  return {
    ...resolveDeveloperAccessProjectionForSession({ isOwner, sessionKey, state }),
    isLoading: Boolean(sessionKey && !isOwner && !isCurrentSession),
  };
};
