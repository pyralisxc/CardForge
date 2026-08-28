"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
  resolveDeveloperAccessProjectionForSession,
  shouldClearStoredDeveloperAccess,
  type DeveloperAccessProjection,
  type DeveloperAccessSessionState,
} from '@/features/developer-access/model';

export const useDeveloperAccess = (
  {
    eligible,
    initialState = EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
    isOwner = false,
    sessionKey,
  }: {
    eligible: boolean;
    initialState?: DeveloperAccessSessionState;
    isOwner?: boolean;
    sessionKey: string | null;
  },
): DeveloperAccessProjection & { isLoading: boolean } => {
  const [state, setState] = useState<DeveloperAccessSessionState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  stateRef.current = state;

  const loadProjection = useCallback(async ({ clearFirst = false }: { clearFirst?: boolean } = {}) => {
    if (!sessionKey || !eligible || isOwner) return;
    const requestId = ++requestIdRef.current;
    if (clearFirst) {
      setState({ sessionKey, projection: EMPTY_DEVELOPER_ACCESS_PROJECTION });
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/developer-access', { cache: 'no-store' });
      const projection = response.ok
        ? await response.json() as DeveloperAccessProjection
        : EMPTY_DEVELOPER_ACCESS_PROJECTION;
      if (requestId === requestIdRef.current) setState({ sessionKey, projection });
    } catch {
      if (requestId === requestIdRef.current) {
        setState({ sessionKey, projection: EMPTY_DEVELOPER_ACCESS_PROJECTION });
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [eligible, isOwner, sessionKey]);

  useEffect(() => {
    if (!sessionKey || !eligible || isOwner) {
      requestIdRef.current += 1;
      if (shouldClearStoredDeveloperAccess({ eligible, isOwner, sessionKey, state: stateRef.current })) {
        setState(EMPTY_DEVELOPER_ACCESS_SESSION_STATE);
      }
      setIsLoading(false);
      return;
    }
    if (stateRef.current.sessionKey !== sessionKey) void loadProjection();

    const handleFocus = () => { void loadProjection({ clearFirst: true }); };
    window.addEventListener('focus', handleFocus);

    return () => window.removeEventListener('focus', handleFocus);
  }, [eligible, isOwner, loadProjection, sessionKey]);

  const isCurrentSession = Boolean(sessionKey && state.sessionKey === sessionKey);
  return {
    ...resolveDeveloperAccessProjectionForSession({ eligible, isOwner, sessionKey, state }),
    isLoading: Boolean(sessionKey && eligible && !isOwner && (isLoading || !isCurrentSession)),
  };
};
