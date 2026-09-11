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
  readBrowserWorkspaceRecovery,
  getProjectPersistenceScope,
  type BrowserWorkspaceRecoverySource,
  type BrowserWorkspaceRecoveryState,
} from '../persistence/projectPersistenceScope';
import { useBrowserWorkspaceSaveStatus } from '../hooks/useBrowserWorkspaceSaveStatus';
import { BrowserStoragePersistencePrompt } from './BrowserStoragePersistencePrompt';
import { trackCardForgeEvent } from '@/features/analytics/client/tracking';
import type { ProjectDocumentV1 } from '../model/projectDocument';

const BACKUP_REMINDER_KEY = 'cardforge-project-backup-reminder-at';
const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function BrowserStorageAlerts({ canUseProjectFiles, workspaceReady = true }: { canUseProjectFiles: boolean; workspaceReady?: boolean }) {
  const { toast } = useToast();
  const saveStatus = useBrowserWorkspaceSaveStatus();
  const [recovery, setRecovery] = useState<BrowserWorkspaceRecoveryState | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryOffered = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<{ name: string; document: ProjectDocumentV1; scope: ReturnType<typeof getProjectPersistenceScope> } | null>(null);

  const refreshRecovery = useCallback(() => {
    void getBrowserWorkspaceRecoveryState().then((next) => { setRecovery(next); setRecoveryError(null); }).catch((error) => {
      setRecoveryError(error instanceof Error ? error.message : 'Browser recovery storage is unavailable.');
    });
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
        description: 'Browser storage could not save the latest change. Open browser recovery and download an emergency editable backup before continuing. This recovery action is available to everyone.',
        variant: 'destructive',
        duration: 12_000,
      });
    };
    window.addEventListener(BROWSER_STORAGE_FAILURE_EVENT, handleStorageFailure);
    return () => window.removeEventListener(BROWSER_STORAGE_FAILURE_EVENT, handleStorageFailure);
  }, [canUseProjectFiles, toast]);

  useEffect(() => {
    if (!workspaceReady) return;
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
  }, [canUseProjectFiles, toast, workspaceReady]);

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
    } catch (error) {
      toast({ title: 'Recovery copy was not discarded', description: error instanceof Error ? error.message : 'Browser storage is unavailable.', variant: 'destructive' });
    } finally {
      setRecoveryBusy(false);
    }
  };

  const downloadBackup = async () => {
    setRecoveryBusy(true);
    const scope = getProjectPersistenceScope();
    try {
      const [{ captureCurrentProjectDocument }, { buildBrowserCardForgeProjectSnapshot }, { saveCardForgeProjectPackageToDevice }] = await Promise.all([
        import('../client/projectWorkspaceDocument'),
        import('../client/browserProjectPackage'),
        import('../client/projectPackageDeviceSave'),
      ]);
      const document = await captureCurrentProjectDocument();
      const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: 'CardForge emergency backup' });
      if (getProjectPersistenceScope() !== scope) throw new Error('The workspace account changed while the backup was being prepared. Retry from the current account.');
      await saveCardForgeProjectPackageToDevice({ fileName: 'CardForge emergency backup.cardforge', snapshot, pickerWindow: {} });
      toast({ title: 'Emergency backup downloaded', description: 'The editable workspace and its packaged artwork are in your downloads. Your browser workspace was not replaced.' });
    } catch (error) {
      toast({ title: 'Emergency backup was not created', description: error instanceof Error ? error.message : 'The workspace or required artwork could not be read. Keep this tab open.', variant: 'destructive' });
    } finally { setRecoveryBusy(false); }
  };

  const inspectBackup = async (file: File) => {
    const scope = getProjectPersistenceScope();
    setRecoveryBusy(true);
    setPendingBackup(null);
    try {
      if (!file.name.toLowerCase().endsWith('.cardforge')) throw new Error('Choose an editable .cardforge backup. Raw recovery JSON needs repair before it can be opened.');
      const { decodeBrowserProjectFile } = await import('../client/browserProjectPackage');
      const decoded = await decodeBrowserProjectFile(file);
      if (getProjectPersistenceScope() !== scope) throw new Error('The workspace account changed while the backup was opening. Choose it again in the current account.');
      setPendingBackup({ name: file.name, document: decoded.document, scope });
    } catch (error) {
      toast({ title: 'Backup was not opened', description: error instanceof Error ? error.message : 'The backup is unreadable.', variant: 'destructive' });
    } finally { setRecoveryBusy(false); }
  };

  const openBackup = async () => {
    if (!pendingBackup) return;
    setRecoveryBusy(true);
    try {
      const { applyProjectDocumentToWorkspace } = await import('../client/projectWorkspaceDocument');
      if (getProjectPersistenceScope() !== pendingBackup.scope) throw new Error('The workspace account changed. Choose the backup again in the current account.');
      await applyProjectDocumentToWorkspace(pendingBackup.document, workspaceReady ? 'copy' : 'replace');
      setPendingBackup(null);
      if (!workspaceReady) { window.location.reload(); return; }
      refreshRecovery();
      toast({ title: 'Recovered copy opened', description: 'The backup is now an independent editable copy. Your existing Sets and saved provider files were left unchanged.' });
    } catch (error) {
      toast({ title: 'Backup was not opened', description: error instanceof Error ? error.message : 'Browser storage could not commit the recovery. Existing work was left unchanged.', variant: 'destructive' });
    } finally { setRecoveryBusy(false); }
  };

  const downloadRecovery = async (source: BrowserWorkspaceRecoverySource | 'current') => {
    setRecoveryBusy(true);
    try {
      const value = await readBrowserWorkspaceRecovery(source);
      if (value === null) throw new Error('That recovery copy is no longer available.');
      const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `CardForge-${source}-recovery.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast({ title: 'Recovery data was not downloaded', description: error instanceof Error ? error.message : 'Browser storage is unavailable.', variant: 'destructive' });
    } finally { setRecoveryBusy(false); }
  };

  const hasRecovery = Boolean(recovery?.previousAvailable || recovery?.quarantinedAvailable);
  const statusLabel = !workspaceReady ? 'Workspace unavailable · Recovery' : saveStatus === 'failed' ? 'Latest change not saved' : 'Recovery available';
  const showAttentionStatus = !workspaceReady || saveStatus === 'failed' || hasRecovery;

  return <>
    <BrowserStoragePersistencePrompt />
    {showAttentionStatus ? <button
      type="button"
      onClick={() => { refreshRecovery(); setRecoveryOpen(true); }}
      className={`fixed bottom-4 right-4 z-40 border px-3 py-2 text-xs shadow-lg ${saveStatus === 'failed' || !workspaceReady ? 'border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] text-[var(--cf-danger)]' : 'border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] text-[var(--cf-warning)]'}`}
      aria-live="polite"
    >
      {statusLabel}
    </button> : null}
    <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
      <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); closeButton.current?.focus(); }} className="max-h-[85dvh] overflow-y-auto border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
        <DialogHeader>
          <DialogTitle>Browser workspace &amp; recovery</DialogTitle>
          <DialogDescription className="leading-6 text-[var(--cf-text-muted)]">
            This workspace is stored on this device. Restoring replaces all loaded Sets and layouts. The last saved copy is preserved as the next recovery snapshot; unsaved changes are not. Download an emergency backup first if you need those changes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="border border-[var(--cf-border)] p-3">
            <strong>Open an emergency backup</strong>
            <p className="mt-1 text-[var(--cf-text-muted)]">Recovery is available to everyone. {workspaceReady ? 'The backup opens as independent recovered Sets; existing work is kept.' : 'Opening the backup replaces this unreadable browser workspace. Original saved bytes remain in recovery; provider files are not changed.'}</p>
            <input ref={backupInput} type="file" accept=".cardforge" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void inspectBackup(file); }} />
            <Button className="mt-3" variant="outline" disabled={recoveryBusy} onClick={() => backupInput.current?.click()}>Choose backup</Button>
            {pendingBackup ? <div className="mt-3 grid gap-2"><p>{pendingBackup.name}: {pendingBackup.document.cardSets.length} Sets and {pendingBackup.document.storedCards.length} cards. {workspaceReady ? 'Create independent recovered copies?' : 'Replace the unreadable browser workspace with this backup?'}</p><Button disabled={recoveryBusy} onClick={() => void openBackup()}>{workspaceReady ? 'Open recovered copy' : 'Replace workspace from backup'}</Button><Button disabled={recoveryBusy} variant="outline" onClick={() => setPendingBackup(null)}>Cancel</Button></div> : null}
          </div>
          {recoveryError ? <p role="alert">Recovery storage is unavailable: {recoveryError}</p> : null}
          {!workspaceReady && recovery?.currentAvailable ? <Button disabled={recoveryBusy} variant="outline" onClick={() => void downloadRecovery('current')}>Download original recovery data</Button> : null}
          {workspaceReady ? <div className="border border-[var(--cf-border)] p-3"><strong>Emergency editable backup</strong><p className="mt-1 text-[var(--cf-text-muted)]">Download all currently loaded Sets, layouts, settings and packaged artwork, including changes that browser storage could not save. Available to everyone. Missing required artwork stops the download.</p><Button className="mt-3" disabled={recoveryBusy} onClick={() => void downloadBackup()}>Download emergency backup</Button></div> : <p role="alert">The saved workspace could not be opened. It remains preserved; restore a readable previous copy or download the recovery data below.</p>}
          <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
            <strong className="text-[var(--cf-text-strong)]">Current copy</strong>
            <p className="mt-1 text-[var(--cf-text-muted)]">{!workspaceReady ? 'The saved copy could not be read. Its bytes have not been replaced.' : saveStatus === 'failed' ? 'The latest attempted change was rejected by browser storage. Earlier saved work remains intact.' : saveStatus === 'saving' ? 'Changes are being written now.' : recovery?.currentAvailable ? 'The latest completed change is saved in this browser.' : 'This Desk is using its initial local workspace.'}</p>
          </div>
          {recovery?.previousAvailable ? <div className="border border-[var(--cf-border-subtle)] p-3"><strong>Previous safe copy</strong><p className="mt-1 text-[var(--cf-text-muted)]">The complete browser workspace from immediately before the latest successful save.</p><div className="mt-3 flex gap-2"><Button disabled={recoveryBusy} onClick={() => void restore('previous')}>Restore &amp; reload</Button><Button disabled={recoveryBusy} variant="outline" onClick={() => void discard('previous')}>Discard</Button></div></div> : null}
          {recovery?.quarantinedAvailable ? <div className="border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3"><strong>Unreadable copy preserved</strong><p className="mt-1 text-[var(--cf-text-muted)]">CardForge isolated a workspace it could not safely open. Restoring may reproduce the read failure; the current workspace is preserved first.</p><div className="mt-3 flex gap-2"><Button disabled={recoveryBusy} onClick={() => void restore('quarantine')}>Try restore &amp; reload</Button><Button disabled={recoveryBusy} variant="outline" onClick={() => void discard('quarantine')}>Discard</Button></div></div> : null}
          {!hasRecovery && !recoveryError ? <p className="border border-dashed border-[var(--cf-border)] p-3 text-[var(--cf-text-muted)]">No previous or quarantined browser copy is available for this workspace yet.</p> : null}
        </div>
        {hasRecovery ? <div className="grid gap-2"><p className="text-[var(--cf-text-muted)]">Raw recovery JSON preserves saved workspace bytes for repair. It is not a complete portable package: referenced artwork remains in this browser.</p>{recovery?.previousAvailable ? <Button disabled={recoveryBusy} variant="outline" onClick={() => void downloadRecovery('previous')}>Download previous recovery data</Button> : null}{recovery?.quarantinedAvailable ? <Button disabled={recoveryBusy} variant="outline" onClick={() => void downloadRecovery('quarantine')}>Download unreadable recovery data</Button> : null}</div> : null}
        <DialogFooter><Button ref={closeButton} type="button" variant="outline" onClick={() => setRecoveryOpen(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
