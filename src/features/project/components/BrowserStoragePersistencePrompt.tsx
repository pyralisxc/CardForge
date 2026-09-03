"use client";

import { useEffect } from 'react';

import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import {
  getBrowserStoragePersistenceState,
  requestBrowserStoragePersistence,
} from '../persistence/browserStoragePersistence';

let hasShownPersistencePrompt = false;

export function BrowserStoragePersistencePrompt() {
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    void getBrowserStoragePersistenceState().then((state) => {
      if (cancelled || state !== 'best-effort' || hasShownPersistencePrompt) return;
      hasShownPersistencePrompt = true;
      const compact = window.matchMedia('(max-width: 767px)').matches;
      toast({
        title: compact ? 'Protect local work' : 'Protect work stored in this browser',
        description: compact
          ? 'Allow stronger storage protection on this device. Keep a separate project backup too.'
          : 'Ask this browser to reduce automatic storage eviction. Persistent browser storage improves local resilience, but it is not a backup or a copy on another device.',
        duration: compact ? 8_000 : 20_000,
        className: compact ? 'p-3 pr-7' : undefined,
        action: (
          <ToastAction
            altText="Ask this browser to persist CardForge storage"
            onClick={() => {
              void requestBrowserStoragePersistence().then((nextState) => {
                if (nextState === 'persistent') {
                  toast({
                    title: 'Browser storage protected',
                    description: 'This browser granted persistent storage. Keep separate project backups for device loss, browser cleanup, or account recovery.',
                  });
                  return;
                }
                toast({
                  title: nextState === 'best-effort' ? 'Browser kept best-effort storage' : 'Persistent storage unavailable',
                  description: 'Your work remains saved locally, but this browser did not grant extra eviction protection. Keep a separate project backup.',
                });
              });
            }}
          >
            Protect work
          </ToastAction>
        ),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  return null;
}
