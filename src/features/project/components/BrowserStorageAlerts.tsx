"use client";

import { useEffect } from 'react';

import { BROWSER_STORAGE_FAILURE_EVENT } from '@/features/project/lib/browserStorage';
import { useToast } from '@/hooks/use-toast';

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
    const lastReminderAt = Number(window.localStorage.getItem(BACKUP_REMINDER_KEY) ?? 0);
    if (Number.isFinite(lastReminderAt) && Date.now() - lastReminderAt < BACKUP_REMINDER_INTERVAL_MS) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(BACKUP_REMINDER_KEY, String(Date.now()));
      toast({
        title: 'Keep a Portable Backup',
        description: 'Your work is local to this browser. Use Export Project periodically so you can recover it on another device or after browser cleanup.',
        duration: 10_000,
      });
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return null;
}
