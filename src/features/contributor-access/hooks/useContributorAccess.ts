"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EMPTY_CONTRIBUTOR_ACCESS_PROJECTION,
  EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE,
  resolveContributorAccessProjectionForSession,
  shouldClearStoredContributorAccess,
  type ContributorAccessProjection,
  type ContributorAccessSessionState,
} from '@/features/contributor-access/model';

const contributorProjectionLoads = new Map<string, Promise<ContributorAccessProjection>>();

const loadContributorProjection = async (sessionKey: string, readOnly: boolean): Promise<ContributorAccessProjection> => {
  const requestKey = JSON.stringify([sessionKey, readOnly]);
  const existing = contributorProjectionLoads.get(requestKey);
  if (existing) return existing;
  const load = (async () => {
    const response = await fetch(readOnly ? '/api/contributor-access?readOnly=1' : '/api/contributor-access', { cache: 'no-store' });
    if (!response.ok) throw new Error('Contributor access is temporarily unavailable. Retry to verify access.');
    return response.json() as Promise<ContributorAccessProjection>;
  })();
  contributorProjectionLoads.set(requestKey, load);
  try {
    return await load;
  } finally {
    if (contributorProjectionLoads.get(requestKey) === load) contributorProjectionLoads.delete(requestKey);
  }
};

export const useContributorAccess = (
  {
    eligible,
    initialState = EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE,
    isOwner = false,
    readOnly = false,
    sessionKey,
  }: {
    eligible: boolean;
    initialState?: ContributorAccessSessionState;
    isOwner?: boolean;
    readOnly?: boolean;
    sessionKey: string | null;
  },
): ContributorAccessProjection & { isLoading: boolean; error: string | null; retry: () => void } => {
  const [state, setState] = useState<ContributorAccessSessionState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<{ sessionKey: string; message: string } | null>(null);
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  stateRef.current = state;

  const loadProjection = useCallback(async ({ clearFirst = false }: { clearFirst?: boolean } = {}) => {
    if (!sessionKey || !eligible || isOwner) return;
    const requestId = ++requestIdRef.current;
    if (clearFirst) {
      setState({ sessionKey, projection: EMPTY_CONTRIBUTOR_ACCESS_PROJECTION });
    }
    setIsLoading(true);
    setFailure(null);
    try {
      const projection = await loadContributorProjection(sessionKey, readOnly);
      if (requestId === requestIdRef.current) setState({ sessionKey, projection });
    } catch {
      if (requestId === requestIdRef.current) {
        setState({ sessionKey, projection: EMPTY_CONTRIBUTOR_ACCESS_PROJECTION });
        setFailure({ sessionKey, message: 'Contributor access is temporarily unavailable. Retry to verify access.' });
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [eligible, isOwner, readOnly, sessionKey]);

  useEffect(() => {
    if (!sessionKey || !eligible || isOwner) {
      requestIdRef.current += 1;
      if (shouldClearStoredContributorAccess({ eligible, isOwner, sessionKey, state: stateRef.current })) {
        setState(EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE);
      }
      setIsLoading(false);
      setFailure(null);
      return;
    }
    if (stateRef.current.sessionKey !== sessionKey) void loadProjection();

    const handleFocus = () => { void loadProjection({ clearFirst: true }); };
    window.addEventListener('focus', handleFocus);

    return () => window.removeEventListener('focus', handleFocus);
  }, [eligible, isOwner, loadProjection, sessionKey]);

  const isCurrentSession = Boolean(sessionKey && state.sessionKey === sessionKey);
  return {
    ...resolveContributorAccessProjectionForSession({ eligible, isOwner, sessionKey, state }),
    isLoading: Boolean(sessionKey && eligible && !isOwner && (isLoading || !isCurrentSession)),
    error: eligible && !isOwner && failure?.sessionKey === sessionKey ? failure?.message ?? null : null,
    retry: () => { void loadProjection({ clearFirst: true }); },
  };
};
