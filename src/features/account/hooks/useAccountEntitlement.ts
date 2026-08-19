"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveAccountEntitlement,
  type AccountEntitlement,
} from '@/features/account/lib/accountEntitlement';
import { isClerkPublicConfigPresent } from '@/infrastructure/auth/clerk';

const loadAccountEntitlement = async (fallbackAuthConfigured: boolean): Promise<AccountEntitlement> => {
  try {
    const response = await fetch('/api/account/entitlement', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Unable to load account entitlement.');
    return await response.json() as AccountEntitlement;
  } catch {
    return resolveAccountEntitlement({
      authConfigured: fallbackAuthConfigured,
    });
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
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const refreshEntitlement = useCallback(async (_options?: { force?: boolean }) => {
    if (inFlightRefreshRef.current) return inFlightRefreshRef.current;

    setIsLoadingEntitlement(true);
    const refresh = loadAccountEntitlement(initialAuthConfigured)
      .then(setEntitlement)
      .finally(() => {
        inFlightRefreshRef.current = null;
        setIsLoadingEntitlement(false);
      });

    inFlightRefreshRef.current = refresh;
    return refresh;
  }, [initialAuthConfigured]);

  const applyEntitlement = useCallback((nextEntitlement: AccountEntitlement) => {
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
