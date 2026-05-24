"use client";

import { useCallback, useEffect, useState } from 'react';

import {
  resolveAccountEntitlement,
  type AccountEntitlement,
} from '@/lib/accountEntitlement';

export function useAccountEntitlement({
  initialAuthConfigured = false,
}: {
  initialAuthConfigured?: boolean;
} = {}) {
  const [entitlement, setEntitlement] = useState<AccountEntitlement>(() => resolveAccountEntitlement({
    authConfigured: initialAuthConfigured,
  }));
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(true);

  const refreshEntitlement = useCallback(async () => {
    setIsLoadingEntitlement(true);
    try {
      const response = await fetch('/api/account/entitlement', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Unable to load account entitlement.');
      const nextEntitlement = await response.json() as AccountEntitlement;
      setEntitlement(nextEntitlement);
    } catch {
      setEntitlement(resolveAccountEntitlement({
        authConfigured: false,
      }));
    } finally {
      setIsLoadingEntitlement(false);
    }
  }, []);

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
