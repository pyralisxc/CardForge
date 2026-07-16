"use client";

import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import {
  getOwnerApiErrorMessage,
  type OwnerConsoleResponse,
} from '@/features/owner/model/ownerConsoleClient';

export function useOwnerConsole() {
  const { toast } = useToast();
  const [payload, setPayload] = useState<OwnerConsoleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastOwnerSaveAt, setLastOwnerSaveAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const slowLoadTimer = window.setTimeout(() => {
      if (mounted) setIsSlowLoad(true);
    }, 2500);
    const load = async () => {
      setIsLoading(true);
      setIsSlowLoad(false);
      setLoadError(null);
      try {
        const response = await fetch('/api/owner/console', { cache: 'no-store' });
        if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to load owner console.'));
        const nextPayload = await response.json() as OwnerConsoleResponse;
        if (mounted) setPayload(nextPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load owner console.';
        if (!mounted) return;
        setLoadError(message);
        toast({ title: 'Owner console unavailable', description: message, variant: 'destructive' });
      } finally {
        window.clearTimeout(slowLoadTimer);
        if (mounted) setIsLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
      window.clearTimeout(slowLoadTimer);
    };
  }, [reloadToken, toast]);

  const updateConsole = useCallback((consolePayload: OwnerConsolePayload) => {
    setPayload((current) => current ? { ...current, console: consolePayload } : current);
    setLastOwnerSaveAt(new Date().toISOString());
  }, []);

  return {
    isLoading,
    isSlowLoad,
    lastOwnerSaveAt,
    loadError,
    payload,
    retry: () => setReloadToken((value) => value + 1),
    updateConsole,
  };
}
