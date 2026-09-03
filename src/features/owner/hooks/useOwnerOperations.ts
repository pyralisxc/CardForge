"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OwnerOperationsPayload } from '@/features/owner/lib/ownerOperations';
import {
  combineOwnerOperationsPayload,
} from '@/features/owner/lib/ownerOperations';
import {
  loadOwnerSiteControls,
  type OwnerOperationsResponse,
} from '@/features/owner/model/ownerOperationsClient';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export function useOwnerOperations() {
  const [payload, setPayload] = useState<OwnerOperationsResponse | null>(null);
  const [siteOperations, setSiteOperations] = useState<OwnerOperationsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSite, setIsLoadingSite] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [siteLoadError, setSiteLoadError] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const siteRequestRef = useRef<Promise<OwnerOperationsPayload> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setIsSlow(false);
    const slowTimer = window.setTimeout(() => setIsSlow(true), 1_500);
    try {
      const response = await fetch('/api/owner/operations', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load owner operations.'));
      const nextPayload = await response.json() as OwnerOperationsResponse;
      setPayload(nextPayload);
      setSiteOperations((current) => current ? {
        ...current,
        configured: nextPayload.overview.configured,
        databaseMetrics: nextPayload.overview.databaseMetrics,
        businessIdentity: nextPayload.overview.businessIdentity,
        roadmapItems: nextPayload.overview.roadmapItems,
      } : null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load owner operations.');
    } finally {
      window.clearTimeout(slowTimer);
      setIsLoading(false);
      setIsSlow(false);
    }
  }, []);

  const loadSite = useCallback(async (): Promise<OwnerOperationsPayload> => {
    if (siteOperations) return siteOperations;
    if (siteRequestRef.current) return siteRequestRef.current;
    if (!payload) throw new Error('Owner overview is not loaded yet.');

    setIsLoadingSite(true);
    setSiteLoadError(null);
    const request = loadOwnerSiteControls()
      .then((site) => {
        const combined = combineOwnerOperationsPayload(payload.overview, site);
        setSiteOperations(combined);
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
  }, [payload, siteOperations]);

  const updateOperations = useCallback((next: OwnerOperationsPayload) => {
    setSiteOperations((current) => ({
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
    siteOperations,
    isLoading,
    isLoadingSite,
    isSlow,
    loadError,
    siteLoadError,
    load,
    loadSite,
    updateOperations,
  }), [
    payload,
    siteOperations,
    isLoading,
    isLoadingSite,
    isSlow,
    loadError,
    siteLoadError,
    load,
    loadSite,
    updateOperations,
  ]);
}
