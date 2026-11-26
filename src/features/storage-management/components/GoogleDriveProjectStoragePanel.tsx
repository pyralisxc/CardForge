"use client";

import { createGoogleDriveProjectThumbnail } from '@/features/card-generator/client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, FilePlus2, FolderCog, FolderPlus, HardDriveUpload, Link2, Link2Off, Loader2, LogIn, RefreshCw, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClientError, readApiError } from '@/infrastructure/http/clientResponses';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import { useSafeCurrentReturnPath } from '@/infrastructure/auth/useSafeCurrentReturnPath';
import {
  authorizeExistingGoogleDriveProjects,
  chooseGoogleDriveProjectFolder,
  createGoogleDriveProjectFolder,
  disconnectGoogleDriveStorage,
  getGoogleDriveDisconnectReviewRequired,
  clearGoogleDriveDisconnectReview,
  getGoogleDriveProjectBinding,
  loadGoogleDriveProjectLibrary,
  saveCurrentProjectToGoogleDrive,
  type GoogleDriveProjectBinding,
  type GoogleDriveProjectListResult,
} from '@/features/project/client/provider-google-drive';
import { hydrateProjectLibraryWorkspaceForScope, useProjectLibraryWorkspace } from '@/features/project/client/libraryWorkspace';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

export function GoogleDriveProjectStoragePanel({
  canUseProjectFiles,
  embedded = false,
  isSignedIn,
  persistenceScope,
}: {
  canUseProjectFiles: boolean;
  embedded?: boolean;
  isSignedIn: boolean;
  persistenceScope: ProjectPersistenceScope;
}) {
  const router = useRouter();
  const returnTo = useSafeCurrentReturnPath('/account?section=library&tool=locations');
  const { toast } = useToast();
  const { activeSetName } = useProjectLibraryWorkspace();
  const [ready, setReady] = useState(false);
  const [library, setLibrary] = useState<GoogleDriveProjectListResult | null>(null);
  const [binding, setBinding] = useState<GoogleDriveProjectBinding | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const [recordReadback, setRecordReadback] = useState<string | null>(null);
  const [recordAbsent, setRecordAbsent] = useState(false);
  const [checkingRecord, setCheckingRecord] = useState(false);
  const [disconnectCheckReady, setDisconnectCheckReady] = useState(false);
  const currentScope = useRef({ scope: persistenceScope });
  if (currentScope.current.scope !== persistenceScope) currentScope.current = { scope: persistenceScope };
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('CardForge Projects');

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setDisconnectNotice(null);
    setRecordReadback(null);
    setRecordAbsent(false);
    setCheckingRecord(false);
    setDisconnectCheckReady(false);
    setBusyAction(null);
    void hydrateProjectLibraryWorkspaceForScope(persistenceScope)
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

  useEffect(() => {
    if (!ready || !isSignedIn) return;
    let cancelled = false;
    void getGoogleDriveDisconnectReviewRequired().then((required) => {
      if (cancelled) return;
      if (required) {
        setDisconnectNotice('An earlier disconnect needs review. CardForge cannot establish whether Google revoked access or whether its saved connection was removed. Your Drive files are unchanged. Check Google Account third-party access and the CardForge record, and contact CardForge support before reconnecting or disconnecting again.');
      }
      setDisconnectCheckReady(true);
    }).catch(() => {
      if (cancelled) return;
      setDisconnectNotice('CardForge could not check whether a previous disconnect needs review. Your Drive files are unchanged. Check Google Account third-party access and contact CardForge support before reconnecting or disconnecting again.');
      setDisconnectCheckReady(true);
    });
    return () => { cancelled = true; };
  }, [persistenceScope, ready, isSignedIn]);

  const refresh = useCallback(async () => {
    if (!ready || !isSignedIn) {
      setLibrary(null);
      setBinding(null);
      return;
    }
    try {
      setLoadError(null);
      setBindingError(null);
      const [nextLibrary, nextBinding] = await Promise.all([
        loadGoogleDriveProjectLibrary(),
        getGoogleDriveProjectBinding().catch((error: unknown) => {
          setBindingError(error instanceof Error ? error.message : 'The saved attachment is unavailable. Reopen a Drive file before saving.');
          return null;
        }),
      ]);
      setLibrary(nextLibrary);
      setBinding(nextBinding);
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error('Google Drive could not be loaded.'));
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
    const scope = currentScope.current;
    setBusyAction(action);
    try {
      await execute();
      if (currentScope.current !== scope) return;
      await refresh();
    } catch (error) {
      if (currentScope.current !== scope) return;
      const disconnectUnconfirmed = action === 'disconnect' && error instanceof ApiClientError
        && error.code === 'google_drive_disconnect_unconfirmed';
      if (disconnectUnconfirmed) setDisconnectNotice(`${error.message} ${error.nextAction ?? ''}`);
      toast({
        title: disconnectUnconfirmed ? 'Google Drive disconnect needs review' : 'Google Drive action failed',
        description: disconnectUnconfirmed ? `${error.message} ${error.nextAction ?? ''}` : error instanceof Error ? error.message : 'CardForge could not complete that Google Drive action.',
        variant: 'destructive',
      });
    } finally {
      if (currentScope.current === scope) setBusyAction(null);
    }
  }, [refresh, toast]);

  const checkSavedConnection = useCallback(async () => {
    const scope = currentScope.current;
    setCheckingRecord(true);
    setRecordAbsent(false);
    try {
      const response = await fetch('/api/project-sources/google-drive?connection=1', { cache: 'no-store' });
      if (!response.ok) throw await readApiError(response, 'CardForge could not check its saved connection.');
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('configured' in value) || !('connected' in value)
        || typeof value.configured !== 'boolean' || typeof value.connected !== 'boolean' || !value.configured) throw new Error('CardForge could not check its saved connection.');
      if (currentScope.current === scope) {
        setRecordAbsent(!value.connected);
        setRecordReadback(`${value.connected ? 'CardForge has a saved connection.' : 'CardForge has no saved connection.'} This check does not establish whether Google revoked access.`);
      }
    } catch {
      if (currentScope.current === scope) setRecordReadback('CardForge could not check its saved connection. This does not establish whether Google revoked access.');
    } finally { if (currentScope.current === scope) setCheckingRecord(false); }
  }, []);

  const acknowledgeDisconnectReview = useCallback(async () => {
    if (!recordAbsent || !window.confirm('Has CardForge support verified the correct Google account and confirmed CardForge no longer has access? This only clears the browser review notice; it does not change Google access, the saved connection, or your files.')) return;
    const scope = currentScope.current;
    setCheckingRecord(true);
    try {
      await clearGoogleDriveDisconnectReview();
      if (currentScope.current !== scope) return;
      setDisconnectNotice(null);
      setRecordReadback(null);
      setRecordAbsent(false);
      await refresh();
    } catch {
      if (currentScope.current === scope) setRecordReadback('CardForge could not clear the browser review notice. Contact CardForge support.');
    } finally { if (currentScope.current === scope) setCheckingRecord(false); }
  }, [recordAbsent, refresh]);

  const authorizeExistingProjects = useCallback(async (folderId: string) => {
    try {
      const count = await authorizeExistingGoogleDriveProjects(folderId);
      if (count === null) {
        toast({
          title: 'Project folder connected',
          description: 'Existing-project selection was skipped. New CardForge projects will still appear automatically, and you can add existing projects at any time.',
        });
        return;
      }
      toast({
        title: count ? 'Existing Drive projects added' : 'No projects selected',
        description: count
          ? `${count} existing CardForge project${count === 1 ? '' : 's'} can now be discovered from this folder.`
          : 'No existing CardForge projects were selected. New projects created by CardForge will appear automatically.',
      });
    } catch (error) {
      toast({
        title: 'Folder connected; existing projects still need approval',
        description: error instanceof Error ? error.message : 'Open Add existing projects and select the existing files CardForge should access.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const chooseProjectFolder = useCallback(() => void run('choose-folder', async () => {
    const selected = await chooseGoogleDriveProjectFolder();
    if (!selected) return;
    toast({
      title: 'Google Drive folder selected',
      description: `“${selected.name}” is now the CardForge project folder. Choose any existing projects in the next Picker so CardForge can authorize them without broad Drive access.`,
    });
    await authorizeExistingProjects(selected.id);
  }), [authorizeExistingProjects, run, toast]);

  const addExistingProjects = useCallback(() => {
    const folderId = library?.selectedFolder?.id ?? library?.connection.rootFolderId;
    if (!folderId) return;
    void run('authorize-existing', async () => {
      await authorizeExistingProjects(folderId);
    });
  }, [authorizeExistingProjects, library, run]);

  const createProjectFolder = useCallback(() => {
    const normalized = folderName.trim();
    if (!normalized) return;
    void run('create-folder', async () => {
      const created = await createGoogleDriveProjectFolder(normalized);
      setCreateFolderOpen(false);
      setFolderName('CardForge Projects');
      toast({
        title: 'Google Drive folder created',
        description: `Created “${created.name}” in My Drive and made it the active CardForge project location.`,
      });
    });
  }, [folderName, run, toast]);

  const connection = library?.connection ?? null;
  const canReplaceUnavailableFolder = loadError instanceof ApiClientError
    && ['authorization', 'conflict', 'not_found'].includes(loadError.kind);
  const selectedFolderName = library?.selectedFolder?.name ?? null;
  const hasProjectFolder = Boolean(library?.selectedFolder?.id ?? library?.connection.rootFolderId);

  return (
    <>
      <section className={embedded ? 'py-1' : 'border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:p-5'} aria-labelledby={embedded ? undefined : 'google-drive-storage-title'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {!embedded ? (
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
          ) : <span className="text-xs leading-5 text-[var(--cf-text-muted)]">Drive remains authoritative for files and permissions.</span>}
          <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} disabled={Boolean(busyAction) || !isSignedIn}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {disconnectNotice ? <div role="alert" className="mt-4 space-y-2 text-sm text-[var(--cf-warning)]"><p>{disconnectNotice}</p><p>Check <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account third-party access</a> separately. <Link className="underline" href="/contact" target="_blank">Contact CardForge support</Link> to verify which Google account was connected.</p><Button type="button" size="sm" variant="outline" disabled={checkingRecord} onClick={() => void checkSavedConnection()}>Check CardForge record</Button>{recordReadback ? <p role="status">{recordReadback}</p> : null}{recordAbsent ? <Button type="button" size="sm" variant="outline" disabled={checkingRecord} onClick={() => void acknowledgeDisconnectReview()}>Support confirmed access</Button> : null}</div> : null}
        {!isSignedIn ? (
          <div className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
            <p className="text-sm text-[var(--cf-text-muted)]">Sign in to connect your Google Drive.</p>
            <Button asChild className="mt-3" size="sm">
              <Link href={createAuthRouteHref('/sign-in', '/account?section=library&tool=locations')} prefetch={false}>
                <LogIn className="mr-2 h-4 w-4" /> Sign in to connect
              </Link>
            </Button>
          </div>
        ) : loadError ? (
          <div role="alert" className="mt-4 space-y-3 border border-[var(--cf-border)] p-3 text-sm">
            <p>{loadError.message}</p>
            {loadError instanceof ApiClientError && loadError.kind === 'authentication' ? (
              <Button size="sm" disabled={!disconnectCheckReady || !canUseProjectFiles || Boolean(disconnectNotice)} onClick={() => router.push(`/api/project-sources/google-drive/connect?returnTo=${encodeURIComponent(returnTo)}`)}>Reconnect Google Drive</Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canReplaceUnavailableFolder ? (
                  <>
                    <Button type="button" size="sm" disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles} onClick={chooseProjectFolder}>
                      {busyAction === 'choose-folder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderCog className="mr-2 h-4 w-4" />}
                      Choose project folder
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles} onClick={() => setCreateFolderOpen(true)}>
                      <FolderPlus className="mr-2 h-4 w-4" /> Create project folder
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => void refresh()}>Try again</Button>
              </div>
            )}
          </div>
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
              disabled={!disconnectCheckReady || !canUseProjectFiles || Boolean(disconnectNotice)}
              onClick={() => router.push(`/api/project-sources/google-drive/connect?returnTo=${encodeURIComponent(returnTo)}`)}
            >
              <Link2 className="mr-2 h-4 w-4" /> Connect Google Drive
            </Button>
            {!canUseProjectFiles ? <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">Portable and connected project storage are temporarily unavailable. Refresh and try again.</p> : null}
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--cf-text-strong)]">Connected as {connection.displayName ?? 'Google Drive'}</p>
                {selectedFolderName ? <p className="mt-1 truncate text-sm font-semibold text-[var(--cf-accent-text)]" title={selectedFolderName}>Project folder: “{selectedFolderName}”</p> : (
                  <p className="mt-1 text-sm font-semibold text-[var(--cf-warning)]">Choose an existing project folder or create a new one before saving to Drive.</p>
                )}
                <p className="mt-1 text-xs text-[var(--cf-text-muted)]">
                  {disconnectNotice ? 'The saved connection needs review before using Google Drive.' : connection.statusNote || (connection.status === 'active' ? 'This Drive location is ready for Set saves and opens. A writable linked Set saves after you pause editing.' : 'This connection needs attention.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {bindingError ? <p role="alert" className="w-full text-sm text-[var(--cf-warning)]">{bindingError} Open a Set in Desk or Library to manage its file.</p> : null}
                <Button type="button" size="sm" variant="outline" disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles} onClick={chooseProjectFolder}>
                  {busyAction === 'choose-folder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderCog className="mr-2 h-4 w-4" />}
                  Choose project folder
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles || !hasProjectFolder} onClick={addExistingProjects}>
                  {busyAction === 'authorize-existing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
                  Add existing projects
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles} onClick={() => setCreateFolderOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" /> Create project folder
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles || !hasProjectFolder}
                  title={hasProjectFolder ? 'Creates a separate backup of every local Set in this browser. Use Save & move for a focused Set.' : 'Choose or create a Drive project folder first.'}
                  onClick={() => void run('save-new', async () => {
                    const saved = await saveCurrentProjectToGoogleDrive({ name: activeSetName || 'CardForge Project', asNew: true, renderThumbnail: createGoogleDriveProjectThumbnail });
                    toast({ title: 'Workspace backup saved to Google Drive', description: `“${saved.name}” is a new independent Drive copy.` });
                  })}
                >
                  {busyAction === 'save-new' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDriveUpload className="mr-2 h-4 w-4" />}
                  Create workspace backup
                </Button>
                {binding && !binding.workId && binding.packageScope === 'workspace' ? (
                  <div className="space-y-2">
                    {!binding.workId && binding.packageScope !== 'workspace' ? <p className="text-sm">Reopen this file from the list below to verify its saved Set or workspace scope before updating it.</p> : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busyAction) || Boolean(disconnectNotice) || !canUseProjectFiles || !hasProjectFolder || (!binding.workId && binding.packageScope !== 'workspace')}
                      onClick={() => void run('update', async () => {
                        const saved = await saveCurrentProjectToGoogleDrive({ name: binding.name, renderThumbnail: createGoogleDriveProjectThumbnail });
                        toast({ title: 'Google Drive project updated', description: `Saved ${saved.workId ? 'the attached Set' : 'the workspace backup'} to “${saved.name}”.` });
                      })}
                    >
                      {busyAction === 'update' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {!binding.workId && binding.packageScope !== 'workspace' ? 'Reopen before saving' : binding.workId ? 'Save attached Set' : 'Save workspace backup'}
                    </Button>
                  </div>
                ) : null}
                {!disconnectNotice ? <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busyAction) || !disconnectCheckReady}
                  onClick={() => {
                    if (!window.confirm('Disconnect Google Drive from CardForge? Your files will remain in Google Drive.')) return;
                    void run('disconnect', async () => {
                      const scope = currentScope.current;
                      const result = await disconnectGoogleDriveStorage();
                      if (currentScope.current !== scope) return;
                      if (result.recoveryPending) setDisconnectNotice('Google confirmed access was revoked and CardForge removed the saved connection, but this browser could not clear its recovery notice. Your Drive files are unchanged. Contact CardForge support before reconnecting or disconnecting again.');
                      toast({ title: 'Google Drive disconnected', description: result.attachmentCleanup === 'complete'
                        ? 'Your Google Drive project files were left untouched.'
                        : 'Your Drive files are untouched, but this browser could not clear its saved attachment. Reload before reconnecting or saving.' });
                    });
                  }}
                >
                  <Link2Off className="mr-2 h-4 w-4" /> Disconnect
                </Button> : null}
              </div>
            </div>

            <p className="mt-3 text-sm text-[var(--cf-text-muted)]">Open a Set in Desk or Library to manage its Drive file.</p>
          </>
        )}
      </section>

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
          <DialogHeader>
            <DialogTitle>Create Google Drive project folder</DialogTitle>
            <DialogDescription>CardForge will create this folder in My Drive and make it the active project destination. Existing Drive files are not moved.</DialogDescription>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            aria-label="Google Drive project folder name"
            placeholder="CardForge Projects"
            onKeyDown={(event) => { if (event.key === 'Enter' && folderName.trim() && !busyAction) { event.preventDefault(); createProjectFolder(); } }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateFolderOpen(false)} disabled={Boolean(busyAction)}>Cancel</Button>
            <Button type="button" onClick={createProjectFolder} disabled={!folderName.trim() || Boolean(busyAction)}>
              {busyAction === 'create-folder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
