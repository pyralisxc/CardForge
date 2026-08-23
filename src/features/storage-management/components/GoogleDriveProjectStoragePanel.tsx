"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cloud, ExternalLink, FolderCog, HardDriveUpload, Link2, Link2Off, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  chooseGoogleDriveProjectFolder,
  deleteGoogleDriveProjectFromLibrary,
  disconnectGoogleDriveStorage,
  getGoogleDriveProjectBinding,
  hydrateProjectWorkspaceForScope,
  loadGoogleDriveProjectLibrary,
  openGoogleDriveProject,
  saveCurrentProjectToGoogleDrive,
  useProjectStore,
  type GoogleDriveProjectBinding,
  type GoogleDriveProjectListResult,
  type GoogleDriveProjectSummary,
  type ProjectPersistenceScope,
} from '@/features/project/client';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export function GoogleDriveProjectStoragePanel({
  canUseProjectFiles,
  isSignedIn,
  persistenceScope,
}: {
  canUseProjectFiles: boolean;
  isSignedIn: boolean;
  persistenceScope: ProjectPersistenceScope;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const activeSetName = useProjectStore((state) => state.activeCardSet.name);
  const [ready, setReady] = useState(false);
  const [library, setLibrary] = useState<GoogleDriveProjectListResult | null>(null);
  const [binding, setBinding] = useState<GoogleDriveProjectBinding | null>(null);
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
    if (!ready || !isSignedIn) {
      setLibrary(null);
      setBinding(null);
      return;
    }
    try {
      const [nextLibrary, nextBinding] = await Promise.all([
        loadGoogleDriveProjectLibrary(),
        getGoogleDriveProjectBinding(),
      ]);
      setLibrary(nextLibrary);
      setBinding(nextBinding);
    } catch (error) {
      toast({
        title: 'Google Drive unavailable',
        description: error instanceof Error ? error.message : 'CardForge could not load Google Drive project storage.',
        variant: 'destructive',
      });
    }
  }, [isSignedIn, ready, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async (action: string, execute: () => Promise<void>) => {
    setBusyAction(action);
    try {
      await execute();
      await refresh();
    } catch (error) {
      toast({
        title: 'Google Drive action failed',
        description: error instanceof Error ? error.message : 'CardForge could not complete that Google Drive action.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }, [refresh, toast]);

  const projects = useMemo(() => library?.projects ?? [], [library?.projects]);
  const attachedProject = useMemo(() => (
    binding ? projects.find((project) => project.fileId === binding.fileId) ?? null : null
  ), [binding, projects]);
  const connection = library?.connection ?? null;

  return (
    <section className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:p-5" aria-labelledby="google-drive-storage-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
            <Cloud className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Connected storage</span>
          </div>
          <h2 id="google-drive-storage-title" className="mt-2 font-serif text-2xl text-[var(--cf-text-strong)]">Google Drive projects</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
            Keep durable .cardforge projects in your own Google Drive. CardForge stores only the encrypted connection credential and temporary AI working copies; the project files use your Google storage quota.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} disabled={Boolean(busyAction) || !isSignedIn}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {!isSignedIn ? (
        <p className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3 text-sm text-[var(--cf-text-muted)]">Sign in to connect your Google Drive.</p>
      ) : !connection ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading Google Drive storage…</p>
      ) : !connection.configured ? (
        <div className="mt-4 border border-[#8b6c35] bg-[#251d0d] p-3 text-sm text-[#e8c98f]">
          Google Drive support is installed in CardForge, but the production Google OAuth credentials and storage-encryption key still need to be configured by the CardForge owner.
        </div>
      ) : !connection.connected ? (
        <div className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
          <p className="text-sm text-[var(--cf-text-muted)]">Connect only the Google Drive files CardForge creates or you explicitly choose for CardForge. The integration uses Google’s per-file <code>drive.file</code> permission rather than broad Drive access.</p>
          <Button
            type="button"
            className="mt-3"
            size="sm"
            disabled={!canUseProjectFiles}
            onClick={() => router.push('/api/project-sources/google-drive/connect')}
          >
            <Link2 className="mr-2 h-4 w-4" /> Connect Google Drive
          </Button>
          {!canUseProjectFiles ? <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">Creator Pass currently unlocks portable and connected project storage.</p> : null}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
            <div>
              <p className="text-sm font-semibold text-[var(--cf-text-strong)]">Connected as {connection.displayName ?? 'Google Drive'}</p>
              <p className="mt-1 text-xs text-[var(--cf-text-muted)]">
                {connection.status === 'active' ? 'CardForge can reach the selected Drive project folder while your devices are offline.' : connection.statusNote || 'This connection needs attention.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busyAction) || !canUseProjectFiles}
                onClick={() => void run('choose-folder', async () => {
                  const selected = await chooseGoogleDriveProjectFolder();
                  if (selected) {
                    toast({
                      title: 'Google Drive folder selected',
                      description: `New CardForge projects will be stored in “${selected.name}”. Existing files were left where they are.`,
                    });
                  }
                })}
              >
                {busyAction === 'choose-folder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderCog className="mr-2 h-4 w-4" />}
                Choose project folder
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(busyAction) || !canUseProjectFiles}
                onClick={() => void run('save-new', async () => {
                  const saved = await saveCurrentProjectToGoogleDrive({ name: activeSetName || 'CardForge Project', asNew: true });
                  toast({ title: 'Project saved to Google Drive', description: `“${saved.name}” is now attached to this browser workspace.` });
                })}
              >
                {busyAction === 'save-new' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDriveUpload className="mr-2 h-4 w-4" />}
                Save current as new
              </Button>
              {binding ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busyAction) || !canUseProjectFiles}
                  onClick={() => void run('update', async () => {
                    const saved = await saveCurrentProjectToGoogleDrive({ name: binding.name });
                    toast({ title: 'Google Drive project updated', description: `Saved the current workspace to “${saved.name}” without intentionally overwriting a newer Drive revision.` });
                  })}
                >
                  {busyAction === 'update' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save attached project
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={Boolean(busyAction)}
                onClick={() => {
                  if (!window.confirm('Disconnect Google Drive from CardForge? Your files will remain in Google Drive.')) return;
                  void run('disconnect', async () => {
                    await disconnectGoogleDriveStorage();
                    toast({ title: 'Google Drive disconnected', description: 'Your Google Drive project files were left untouched.' });
                  });
                }}
              >
                <Link2Off className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            </div>
          </div>

          {binding ? (
            <p className="mt-3 text-xs text-[var(--cf-text-subtle)]">
              Attached here: <span className="font-semibold text-[var(--cf-text-muted)]">{binding.name}</span>{attachedProject ? ` · Drive revision ${attachedProject.providerRevision}` : ''}
            </p>
          ) : null}

          <div className="mt-5">
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Projects in your selected Drive folder</h3>
            {projects.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--cf-text-muted)]">No CardForge projects are visible in this folder yet. Save the current workspace as a new project to create the first one.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {projects.map((project) => (
                  <GoogleDriveProjectRow
                    key={project.fileId}
                    project={project}
                    isAttached={binding?.fileId === project.fileId}
                    busyAction={busyAction}
                    canUseProjectFiles={canUseProjectFiles}
                    onOpen={() => void run(`open:${project.fileId}`, async () => {
                      const opened = await openGoogleDriveProject(project);
                      toast({ title: 'Google Drive project opened', description: `Loaded “${opened.name}” into this browser workspace.` });
                      router.push('/studio');
                    })}
                    onDelete={() => void run(`delete:${project.fileId}`, async () => {
                      await deleteGoogleDriveProjectFromLibrary(project);
                      toast({ title: 'Google Drive project deleted', description: `Removed “${project.name}” from Google Drive.` });
                    })}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function GoogleDriveProjectRow({
  project,
  isAttached,
  busyAction,
  canUseProjectFiles,
  onOpen,
  onDelete,
}: {
  project: GoogleDriveProjectSummary;
  isAttached: boolean;
  busyAction: string | null;
  canUseProjectFiles: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isBusy = busyAction === `open:${project.fileId}` || busyAction === `delete:${project.fileId}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{project.name}{isAttached ? ' · attached' : ''}</p>
        <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{formatBytes(project.size)} · Drive revision {project.providerRevision} · modified {new Date(project.modifiedAt).toLocaleString()}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={Boolean(busyAction) || !canUseProjectFiles} onClick={onOpen}>
          {busyAction === `open:${project.fileId}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Open
        </Button>
        {project.webViewLink ? (
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={project.webViewLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Drive</a>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={Boolean(busyAction) || !project.projectRevision}
          onClick={() => {
            if (window.confirm(`Delete “${project.name}” from Google Drive? This does not delete browser or CardForge Cloud copies.`)) onDelete();
          }}
        >
          {busyAction === `delete:${project.fileId}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Delete
        </Button>
      </div>
      {isBusy ? <span className="sr-only">Working on {project.name}</span> : null}
    </div>
  );
}
