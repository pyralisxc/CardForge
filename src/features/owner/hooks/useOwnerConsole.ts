"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import {
  combineOwnerConsolePayload,
} from '@/features/owner/lib/ownerConsole';
import {
  loadOwnerSiteControls,
  type OwnerConsoleResponse,
} from '@/features/owner/model/ownerConsoleClient';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export function useOwnerConsole() {
  const [payload, setPayload] = useState<OwnerConsoleResponse | null>(null);
  const [siteConsole, setSiteConsole] = useState<OwnerConsolePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSite, setIsLoadingSite] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [siteLoadError, setSiteLoadError] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const siteRequestRef = useRef<Promise<OwnerConsolePayload> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setIsSlow(false);
    const slowTimer = window.setTimeout(() => setIsSlow(true), 1_500);
    try {
      const response = await fetch('/api/owner/console', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load owner console.'));
      const nextPayload = await response.json() as OwnerConsoleResponse;
      setPayload(nextPayload);
      setSiteConsole((current) => current ? {
        ...current,
        configured: nextPayload.overview.configured,
        databaseMetrics: nextPayload.overview.databaseMetrics,
        businessIdentity: nextPayload.overview.businessIdentity,
        roadmapItems: nextPayload.overview.roadmapItems,
      } : null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load owner console.');
    } finally {
      window.clearTimeout(slowTimer);
      setIsLoading(false);
      setIsSlow(false);
    }
  }, []);

  const loadSite = useCallback(async (): Promise<OwnerConsolePayload> => {
    if (siteConsole) return siteConsole;
    if (siteRequestRef.current) return siteRequestRef.current;
    if (!payload) throw new Error('Owner overview is not loaded yet.');

    setIsLoadingSite(true);
    setSiteLoadError(null);
    const request = loadOwnerSiteControls()
      .then((site) => {
        const combined = combineOwnerConsolePayload(payload.overview, site);
        setSiteConsole(combined);
        return combined;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unable to load site controls.';
        setSiteLoadError(message);
        throw error;
      })
      .finally(() => {
        siteRequestRef.current = null;
        setIsLoadingSite(false);
      });
    siteRequestRef.current = request;
    return request;
  }, [payload, siteConsole]);

  const updateConsole = useCallback((next: OwnerConsolePayload) => {
    setSiteConsole((current) => ({
      ...next,
      databaseMetrics: current?.databaseMetrics ?? payload?.overview.databaseMetrics ?? next.databaseMetrics,
    }));
    setPayload((current) => current ? {
      ...current,
      overview: {
        ...current.overview,
        businessIdentity: next.businessIdentity,
        roadmapItems: next.roadmapItems,
      },
    } : current);
  }, [payload?.overview.databaseMetrics]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => ({
    payload,
    siteConsole,
    isLoading,
    isLoadingSite,
    isSlow,
    loadError,
    siteLoadError,
    load,
    loadSite,
    updateConsole,
  }), [
    payload,
    siteConsole,
    isLoading,
    isLoadingSite,
    isSlow,
    loadError,
    siteLoadError,
    load,
    loadSite,
    updateConsole,
  ]);
}
