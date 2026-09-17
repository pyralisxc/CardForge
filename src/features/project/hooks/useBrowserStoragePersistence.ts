"use client";

import { useCallback, useEffect, useState } from 'react';

import {
  getBrowserStoragePersistenceState,
  requestBrowserStoragePersistence,
  type BrowserStoragePersistenceState,
} from '../persistence/browserStoragePersistence';

export type BrowserStoragePersistenceStatus = BrowserStoragePersistenceState | 'checking';

export function useBrowserStoragePersistence() {
  const [status, setStatus] = useState<BrowserStoragePersistenceStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    void getBrowserStoragePersistenceState().then((nextStatus) => {
      if (!cancelled) setStatus(nextStatus);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPersistence = useCallback(async () => {
    const nextStatus = await requestBrowserStoragePersistence();
    setStatus(nextStatus);
    return nextStatus;
  }, []);

  return { status, requestPersistence };
}
