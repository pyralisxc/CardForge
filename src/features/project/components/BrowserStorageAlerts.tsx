"use client";

import { useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { BROWSER_STORAGE_FAILURE_EVENT, createIndexedDbStorage } from '../persistence/indexedDbStorage';

const BACKUP_REMINDER_KEY = 'cardforge-project-backup-reminder-at';
const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function BrowserStorageAlerts() {
  const { toast } = useToast();

  useEffect(() => {
    let lastFailureToastAt = 0;
    const handleStorageFailure = () => {
      const now = Date.now();
      if (now - lastFailureToastAt < 5_000) return;
      lastFailureToastAt = now;
      toast({
        title: 'Project Save Failed',
        description: 'Browser storage could not save the latest change. Download a project backup now, then free browser storage before continuing.',
        variant: 'destructive',
        duration: 12_000,
      });
    };
    window.addEventListener(BROWSER_STORAGE_FAILURE_EVENT, handleStorageFailure);
    return () => window.removeEventListener(BROWSER_STORAGE_FAILURE_EVENT, handleStorageFailure);
  }, [toast]);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/studio')) return;
    const preferences = createIndexedDbStorage('project-preferences');
    let timer: number | undefined;
    let cancelled = false;

    void Promise.resolve(preferences.getItem(BACKUP_REMINDER_KEY)).then((storedValue) => {
      const lastReminderAt = Number(storedValue ?? 0);
      if (cancelled || (Number.isFinite(lastReminderAt) && Date.now() - lastReminderAt < BACKUP_REMINDER_INTERVAL_MS)) return;
      timer = window.setTimeout(() => {
        void preferences.setItem(BACKUP_REMINDER_KEY, String(Date.now()));
        toast({
          title: 'Keep a Portable Backup',
          description: 'Your work is local to this browser. Use Export Project periodically so you can recover it on another device or after browser cleanup.',
          duration: 10_000,
        });
      }, 20_000);
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [toast]);

  return null;
}
