"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OwnerAnalyticsSnapshot } from '../model';

const REFRESH_INTERVAL_MS = 60_000;

const readError = async (response: Response) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? 'Unable to load analytics.';
  } catch {
    return 'Unable to load analytics.';
  }
};

export function useOwnerAnalytics() {
  const [snapshot, setSnapshot] = useState<OwnerAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    try {
      const response = await fetch('/api/owner/analytics', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(await readError(response));
      setSnapshot(await response.json() as OwnerAnalyticsSnapshot);
      setError(null);
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === 'AbortError') return;
      setError(nextError instanceof Error ? nextError.message : 'Unable to load analytics.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [refresh]);

  return { error, isLoading, refresh, snapshot };
}
