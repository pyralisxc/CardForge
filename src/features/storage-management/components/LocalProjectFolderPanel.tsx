"use client";

import { useCallback, useEffect, useState } from 'react';
import { FolderInput, FolderOpen, HardDriveDownload, Link2Off, Loader2, RefreshCw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createStudioHref } from '@/features/app-shell/client/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  disconnectLocalProjectFolder,
  getLocalProjectFileName,
  getLocalProjectFolderStatus,
  hydrateProjectWorkspaceForScope,
  openProjectFromFolder,
  reconnectAttachedProjectFolder,
  saveCurrentProjectToNewFolder,
  saveProjectToAttachedFolder,
  type LocalProjectFolderStatus,
  type ProjectPersistenceScope,
} from '@/features/project/client';

export function LocalProjectFolderPanel({
  canUseProjectFiles,
  embedded = false,
  persistenceScope,
}: {
  canUseProjectFiles: boolean;
  embedded?: boolean;
  persistenceScope: ProjectPersistenceScope;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<LocalProjectFolderStatus | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void hydrateProjectWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setReady(true); })
      .catch((error) => {
        if (cancelled) return;
        setReady(true);
        toast({
          title: 'Local workspace unavailable',
          description: error instanceof Error ? error.message : 'CardForge could not prepare this browser workspace.',
          variant: 'destructive',
        });
      });
    return () => { cancelled = true; };
  }, [persistenceScope, toast]);

  const refresh = useCallback(async () => {
    if (!ready) return;
    setStatus(await getLocalProjectFolderStatus());
  }, [ready]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async (action: string, execute: () => Promise<void>) => {
    if (!canUseProjectFiles) {
      toast({
        title: 'Portable projects are locked',
        description: 'Creator Pass currently unlocks portable project files and direct project-folder storage.',
      });
      return;
    }
    setBusyAction(action);
    try {
      await execute();
      await refresh();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({
        title: 'Project folder action failed',
        description: error instanceof Error ? error.message : 'CardForge could not complete that project-folder action.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }, [canUseProjectFiles, refresh, toast]);

  if (!ready) {
    return <p className="mt-3 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Preparing local project storage…</p>;
  }

  if (status && !status.supported) {
    return (
      <div className="mt-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
        <p className="text-sm font-semibold text-[var(--cf-text-strong)]">Direct folders are not supported by this browser</p>
        <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">
          CardForge still keeps the browser workspace and portable .cardforge downloads. Direct folder access appears only where the browser supports the File System Access picker.
        </p>
      </div>
    );
  }

  const binding = status?.binding ?? null;
  const permission = status?.permission ?? 'prompt';

  return (
    <div className={embedded ? 'py-1' : 'mt-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!embedded ? (
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--cf-text-strong)]">
              <FolderOpen className="h-4 w-4 text-[var(--cf-accent-strong)]" /> Local project folder
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--cf-text-muted)]">
              Store a real {getLocalProjectFileName()} inside a folder you choose. The browser workspace remains a recovery copy; CardForge never receives the folder path or gains access without browser permission.
            </p>
          </div>
        ) : <span className="text-xs text-[var(--cf-text-muted)]">Browser-authorized folder access</span>}
        <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()} disabled={Boolean(busyAction)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {binding ? (
        <div className="mt-3 rounded border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-xs text-[var(--cf-text-muted)]">
          <p><span className="font-semibold text-[var(--cf-text-strong)]">{binding.folderName}</span> · {permission === 'granted' ? 'folder permission active' : 'permission needs reconnecting'}</p>
          <p className="mt-1">Last project revision: {binding.sourceRevision ? binding.sourceRevision.slice(0, 12) : 'unknown'}{binding.lastSavedAt ? ` · saved ${new Date(binding.lastSavedAt).toLocaleString()}` : ''}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!binding ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busyAction) || !canUseProjectFiles}
              onClick={() => void run('save-new', async () => {
                const next = await saveCurrentProjectToNewFolder();
                toast({ title: 'Project folder attached', description: `Saved the current project in “${next.folderName}”.` });
              })}
            >
              {busyAction === 'save-new' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDriveDownload className="mr-2 h-4 w-4" />}
              Save current project to folder
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busyAction) || !canUseProjectFiles}
              onClick={() => void run('open', async () => {
                const next = await openProjectFromFolder();
                toast({ title: 'Project folder opened', description: `Loaded “${next.folderName}” into the local CardForge workspace.` });
                router.push(createStudioHref({ returnTo: '/account?section=storage' }));
              })}
            >
              {busyAction === 'open' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderInput className="mr-2 h-4 w-4" />}
              Open project folder
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(busyAction) || !canUseProjectFiles || permission !== 'granted'}
              onClick={() => void run('save', async () => {
                const next = await saveProjectToAttachedFolder();
                toast({ title: 'Project folder saved', description: `Wrote revision ${next.sourceRevision?.slice(0, 12) ?? 'current'} to “${next.folderName}”.` });
              })}
            >
              {busyAction === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save project now
            </Button>
            {permission !== 'granted' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busyAction) || !canUseProjectFiles}
                onClick={() => void run('reconnect', async () => {
                  await reconnectAttachedProjectFolder();
                  toast({ title: 'Folder reconnected', description: 'CardForge can write to the selected project folder again.' });
                })}
              >
                <FolderOpen className="mr-2 h-4 w-4" /> Reconnect folder
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={Boolean(busyAction)}
              onClick={() => void run('disconnect', async () => {
                await disconnectLocalProjectFolder();
                toast({ title: 'Folder disconnected', description: 'The project file was left untouched. CardForge only forgot the browser permission link.' });
              })}
            >
              <Link2Off className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          </>
        )}
      </div>

      {!canUseProjectFiles ? (
        <p className="mt-3 text-xs leading-5 text-[var(--cf-text-subtle)]">Creator Pass currently unlocks portable .cardforge files and direct project-folder storage. Browser-local creation remains available without it.</p>
      ) : null}
    </div>
  );
}
