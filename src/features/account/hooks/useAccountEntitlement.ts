"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveAccountEntitlement,
  type AccountEntitlement,
} from '@/lib/accountEntitlement';

let sharedEntitlementRequest: Promise<AccountEntitlement> | null = null;
let sharedEntitlementCache: { entitlement: AccountEntitlement; fetchedAt: number } | null = null;
const ENTITLEMENT_CACHE_TTL_MS = 1500;

const fetchAccountEntitlement = ({ force = false }: { force?: boolean } = {}) => {
  if (!force && sharedEntitlementCache && Date.now() - sharedEntitlementCache.fetchedAt < ENTITLEMENT_CACHE_TTL_MS) {
    return Promise.resolve(sharedEntitlementCache.entitlement);
  }

  if (sharedEntitlementRequest) return sharedEntitlementRequest;

  sharedEntitlementRequest = (async () => {
    try {
      const response = await fetch('/api/account/entitlement', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Unable to load account entitlement.');
      const nextEntitlement = await response.json() as AccountEntitlement;
      sharedEntitlementCache = { entitlement: nextEntitlement, fetchedAt: Date.now() };
      return nextEntitlement;
    } catch {
      const fallbackEntitlement = resolveAccountEntitlement({
        authConfigured: false,
      });
      sharedEntitlementCache = { entitlement: fallbackEntitlement, fetchedAt: Date.now() };
      return fallbackEntitlement;
    } finally {
      sharedEntitlementRequest = null;
    }
  })();

  return sharedEntitlementRequest;
};

export function useAccountEntitlement({
  initialAuthConfigured = false,
}: {
  initialAuthConfigured?: boolean;
} = {}) {
  const [entitlement, setEntitlement] = useState<AccountEntitlement>(() => resolveAccountEntitlement({
    authConfigured: initialAuthConfigured,
  }));
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(true);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const refreshEntitlement = useCallback(async (options?: { force?: boolean }) => {
    if (inFlightRefreshRef.current) return inFlightRefreshRef.current;

    setIsLoadingEntitlement(true);

    const refresh = fetchAccountEntitlement(options)
      .then(setEntitlement)
      .finally(() => {
        inFlightRefreshRef.current = null;
        setIsLoadingEntitlement(false);
      });

    inFlightRefreshRef.current = refresh;
    return refresh;
  }, []);

  const applyEntitlement = useCallback((nextEntitlement: AccountEntitlement) => {
    sharedEntitlementCache = { entitlement: nextEntitlement, fetchedAt: Date.now() };
    setEntitlement(nextEntitlement);
    setIsLoadingEntitlement(false);
  }, []);

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshEntitlement();
    };
    window.addEventListener('focus', handleFocus);

    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshEntitlement]);

  return {
    ...entitlement,
    isLoadingEntitlement,
    applyEntitlement,
    refreshEntitlement,
  };
}
