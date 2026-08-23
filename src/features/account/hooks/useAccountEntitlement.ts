"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveAccountEntitlement,
  type AccountEntitlement,
} from '@/features/account/lib/accountEntitlement';
import { isClerkPublicConfigPresent } from '@/infrastructure/auth/clerk';

type AccountEntitlementLoadResult =
  | { ok: true; entitlement: AccountEntitlement }
  | { ok: false; message: string };

const loadAccountEntitlement = async (): Promise<AccountEntitlementLoadResult> => {
  try {
    const response = await fetch('/api/account/entitlement', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Unable to verify account access right now.');
    return { ok: true, entitlement: await response.json() as AccountEntitlement };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to verify account access right now.',
    };
  }
};

export function useAccountEntitlement({
  initialAuthConfigured = isClerkPublicConfigPresent(),
}: {
  initialAuthConfigured?: boolean;
} = {}) {
  const [entitlement, setEntitlement] = useState<AccountEntitlement>(() => resolveAccountEntitlement({
    authConfigured: initialAuthConfigured,
  }));
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(true);
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const refreshEntitlement = useCallback(async (_options?: { force?: boolean }) => {
    if (inFlightRefreshRef.current) return inFlightRefreshRef.current;

    setIsLoadingEntitlement(true);
    const refresh = loadAccountEntitlement()
      .then((result) => {
        if (result.ok) {
          setEntitlement(result.entitlement);
          setEntitlementError(null);
          return;
        }
        setEntitlementError(result.message);
      })
      .finally(() => {
        inFlightRefreshRef.current = null;
        setIsLoadingEntitlement(false);
      });

    inFlightRefreshRef.current = refresh;
    return refresh;
  }, []);

  const applyEntitlement = useCallback((nextEntitlement: AccountEntitlement) => {
    setEntitlement(nextEntitlement);
    setEntitlementError(null);
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
    entitlementError,
    entitlementStatus: entitlementError ? 'unavailable' as const : isLoadingEntitlement ? 'loading' as const : 'ready' as const,
    isLoadingEntitlement,
    applyEntitlement,
    refreshEntitlement,
  };
}
