"use client";

import { useEffect } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { BROWSER_STORAGE_FAILURE_EVENT, createIndexedDbStorage } from '../persistence/indexedDbStorage';
import { BrowserStoragePersistencePrompt } from './BrowserStoragePersistencePrompt';

const BACKUP_REMINDER_KEY = 'cardforge-project-backup-reminder-at';
const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function BrowserStorageAlerts({ canUseProjectFiles }: { canUseProjectFiles: boolean }) {
  const { toast } = useToast();

  useEffect(() => {
    let lastFailureToastAt = 0;
    const handleStorageFailure = () => {
      const now = Date.now();
      if (now - lastFailureToastAt < 5_000) return;
      lastFailureToastAt = now;
      toast({
        title: 'Project Save Failed',
        description: canUseProjectFiles
          ? 'Browser storage could not save the latest change. Download a project backup now, then free browser storage before continuing.'
          : 'Browser storage could not save the latest change. Free browser storage before continuing. Portable project backups are available with Creator Pass.',
        variant: 'destructive',
        duration: 12_000,
      });
    };
    window.addEventListener(BROWSER_STORAGE_FAILURE_EVENT, handleStorageFailure);
    return () => window.removeEventListener(BROWSER_STORAGE_FAILURE_EVENT, handleStorageFailure);
  }, [canUseProjectFiles, toast]);

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
          title: 'Your work is saved in this browser',
          description: canUseProjectFiles
            ? 'Download a project backup periodically so you can reopen it on another device or recover after browser cleanup.'
            : 'Portable project backups are available with Creator Pass.',
          duration: 10_000,
        });
      }, 20_000);
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [canUseProjectFiles, toast]);

  return <BrowserStoragePersistencePrompt />;
}
