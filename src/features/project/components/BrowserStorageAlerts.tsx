"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { BROWSER_STORAGE_FAILURE_EVENT, createIndexedDbStorage } from '../persistence/indexedDbStorage';
import {
  discardBrowserWorkspaceRecovery,
  getBrowserWorkspaceRecoveryState,
  restoreBrowserWorkspaceRecovery,
  type BrowserWorkspaceRecoverySource,
  type BrowserWorkspaceRecoveryState,
} from '../persistence/projectPersistenceScope';
import { useBrowserWorkspaceSaveStatus } from '../hooks/useBrowserWorkspaceSaveStatus';
import { BrowserStoragePersistencePrompt } from './BrowserStoragePersistencePrompt';
import { trackCardForgeEvent } from '@/features/analytics/client/tracking';

const BACKUP_REMINDER_KEY = 'cardforge-project-backup-reminder-at';
const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function BrowserStorageAlerts({ canUseProjectFiles }: { canUseProjectFiles: boolean }) {
  const { toast } = useToast();
  const saveStatus = useBrowserWorkspaceSaveStatus();
  const [recovery, setRecovery] = useState<BrowserWorkspaceRecoveryState | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryOffered = useRef(false);

  const refreshRecovery = useCallback(() => {
    void getBrowserWorkspaceRecoveryState().then(setRecovery).catch(() => setRecovery(null));
  }, []);

  useEffect(() => { refreshRecovery(); }, [refreshRecovery, saveStatus]);

  useEffect(() => {
    const available = Boolean(recovery?.previousAvailable || recovery?.quarantinedAvailable);
    if (available && !recoveryOffered.current) {
      trackCardForgeEvent('recovery_offered', {
        recovery_source: recovery?.quarantinedAvailable ? 'quarantine' : 'previous',
      });
    }
    recoveryOffered.current = available;
  }, [recovery]);

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

  const restore = async (source: BrowserWorkspaceRecoverySource) => {
    setRecoveryBusy(true);
    try {
      const restored = await restoreBrowserWorkspaceRecovery(source);
      if (!restored) throw new Error('That recovery copy is no longer available.');
      trackCardForgeEvent('recovery_restored', { recovery_source: source, outcome: 'restored' });
      window.location.reload();
    } catch (error) {
      toast({ title: 'Workspace was not restored', description: error instanceof Error ? error.message : 'The recovery copy could not be restored.', variant: 'destructive' });
      setRecoveryBusy(false);
      refreshRecovery();
    }
  };

  const discard = async (source: BrowserWorkspaceRecoverySource) => {
    setRecoveryBusy(true);
    try {
      await discardBrowserWorkspaceRecovery(source);
      await getBrowserWorkspaceRecoveryState().then(setRecovery);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const hasRecovery = Boolean(recovery?.previousAvailable || recovery?.quarantinedAvailable);
  const statusLabel = saveStatus === 'saving' ? 'Saving in this browser…' : saveStatus === 'failed' ? 'Latest change not saved' : 'Saved in this browser';

  return <>
    <BrowserStoragePersistencePrompt />
    <button
      type="button"
      onClick={() => { refreshRecovery(); setRecoveryOpen(true); }}
      className={`fixed bottom-4 right-4 z-40 border px-3 py-2 text-xs shadow-lg ${saveStatus === 'failed' ? 'border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] text-[var(--cf-danger)]' : 'border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text-muted)]'}`}
      aria-live="polite"
    >
      {statusLabel}{hasRecovery ? ' · Recovery available' : ''}
    </button>
    <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
      <DialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
        <DialogHeader>
          <DialogTitle>Browser workspace &amp; recovery</DialogTitle>
          <DialogDescription className="leading-6 text-[var(--cf-text-muted)]">
            This workspace is stored on this device. Restoring replaces the currently loaded browser copy, while preserving that current copy as the next recovery snapshot. Portable project files are the safest way to move work between devices.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
            <strong className="text-[var(--cf-text-strong)]">Current copy</strong>
            <p className="mt-1 text-[var(--cf-text-muted)]">{saveStatus === 'failed' ? 'The latest attempted change was rejected by browser storage. Earlier saved work remains intact.' : saveStatus === 'saving' ? 'Changes are being written now.' : recovery?.currentAvailable ? 'The latest completed change is saved in this browser.' : 'This Desk is using its initial local workspace.'}</p>
          </div>
          {recovery?.previousAvailable ? <div className="border border-[var(--cf-border-subtle)] p-3"><strong>Previous safe copy</strong><p className="mt-1 text-[var(--cf-text-muted)]">The complete browser workspace from immediately before the latest successful save.</p><div className="mt-3 flex gap-2"><Button disabled={recoveryBusy} onClick={() => void restore('previous')}>Restore &amp; reload</Button><Button disabled={recoveryBusy} variant="outline" onClick={() => void discard('previous')}>Discard</Button></div></div> : null}
          {recovery?.quarantinedAvailable ? <div className="border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3"><strong>Unreadable copy preserved</strong><p className="mt-1 text-[var(--cf-text-muted)]">CardForge isolated a workspace it could not safely open. Restoring may reproduce the read failure; the current workspace is preserved first.</p><div className="mt-3 flex gap-2"><Button disabled={recoveryBusy} onClick={() => void restore('quarantine')}>Try restore &amp; reload</Button><Button disabled={recoveryBusy} variant="outline" onClick={() => void discard('quarantine')}>Discard</Button></div></div> : null}
          {!hasRecovery ? <p className="border border-dashed border-[var(--cf-border)] p-3 text-[var(--cf-text-muted)]">No previous or quarantined browser copy is available for this workspace yet.</p> : null}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setRecoveryOpen(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
