'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CardForgeWorkspaceState } from '@/components/ui/cardforge-presentation';
import { useToast } from '@/components/ui/use-toast';

import {
  prepareAccountProjectWorkspace,
  subscribeToAccountProjectWorkspaceIssues,
  type AccountProjectWorkspaceBoundaryProps,
  type AccountProjectWorkspaceIssue,
} from '../client/accountProjectWorkspace';
import {
  getRetainedGuestWorkSummary,
  importRetainedGuestWorkspaceAsCopy,
  type RetainedGuestWorkSummary,
} from '../client/retainedGuestWorkspace';
import { readProjectPreference, writeProjectPreference } from '../persistence/projectPreferences';
import { BrowserStorageAlerts } from './BrowserStorageAlerts';

const RETAINED_GUEST_DISMISS_KEY = 'retained-guest-work-dismissed-revision';

export function AccountProjectWorkspaceBoundary({
  children,
  persistenceScope,
  canUseProjectFiles,
}: AccountProjectWorkspaceBoundaryProps) {
  const { toast } = useToast();
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<AccountProjectWorkspaceIssue | null>(null);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [retainedGuestWork, setRetainedGuestWork] = useState<RetainedGuestWorkSummary | null>(null);
  const [guestImportBusy, setGuestImportBusy] = useState(false);

  const bootstrap = useCallback(async (signal: AbortSignal) => {
    setReadyScope(null);
    setError(null);
    setRetainedGuestWork(null);
    try {
      await prepareAccountProjectWorkspace(persistenceScope, undefined, signal);
      if (!signal.aborted) setReadyScope(persistenceScope);
    } catch (bootstrapError) {
      if (signal.aborted) return;
      console.error('Unable to prepare the account workspace.', bootstrapError);
      setError(bootstrapError instanceof Error ? bootstrapError.message : 'The browser workspace could not be restored.');
    }
  }, [persistenceScope]);

  useEffect(() => {
    const controller = new AbortController();
    void bootstrap(controller.signal);
    return () => controller.abort();
  }, [bootstrap, retry]);

  useEffect(() => {
    if (readyScope !== persistenceScope || !persistenceScope.startsWith('account:')) return;
    let cancelled = false;
    void Promise.all([
      getRetainedGuestWorkSummary(),
      readProjectPreference<number | null>(RETAINED_GUEST_DISMISS_KEY),
    ]).then(([summary, dismissedRevision]) => {
      if (!cancelled) setRetainedGuestWork(summary && summary.guestRevision !== dismissedRevision ? summary : null);
    }).catch((guestError) => {
      if (!cancelled) console.warn('Unable to inspect retained signed-out work:', guestError);
    });
    return () => { cancelled = true; };
  }, [persistenceScope, readyScope]);

  useEffect(() => subscribeToAccountProjectWorkspaceIssues((nextIssue) => {
    setIssue(nextIssue);
    setIsIssueDialogOpen(true);
  }), []);

  const reloadSavedWorkspace = () => window.location.reload();

  const dismissRetainedGuestWork = () => {
    if (!retainedGuestWork) return;
    void writeProjectPreference(RETAINED_GUEST_DISMISS_KEY, retainedGuestWork.guestRevision);
    setRetainedGuestWork(null);
  };

  const importRetainedGuestWork = async () => {
    setGuestImportBusy(true);
    try {
      const result = await importRetainedGuestWorkspaceAsCopy();
      setRetainedGuestWork(null);
      toast({
        title: 'Signed-out work added to this account',
        description: `${result.summary.setCount} Set${result.summary.setCount === 1 ? '' : 's'} opened as independent account copies.${result.consumed ? ' The imported signed-out snapshot was cleared.' : ' Newer signed-out work was detected and left separate for safety.'}`,
      });
      if (!result.consumed) {
        const latest = await getRetainedGuestWorkSummary().catch(() => null);
        setRetainedGuestWork(latest);
      }
    } catch (importError) {
      toast({
        title: 'Signed-out work was not imported',
        description: importError instanceof Error ? importError.message : 'Existing account and signed-out work were left unchanged.',
        variant: 'destructive',
      });
    } finally {
      setGuestImportBusy(false);
    }
  };

  if (readyScope !== persistenceScope) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
        <CardForgeWorkspaceState
          state={error ? 'error' : 'loading'}
          message={error
            ? 'CardForge could not finish preparing this account workspace. Try again before editing.'
            : 'Restoring the workspace saved for this account before opening your Desk and Library.'}
          className="grid min-h-0 w-full max-w-md place-items-center text-center"
        />
        {error ? (
          <div className="grid max-w-md gap-3 text-center">
            <BrowserStorageAlerts canUseProjectFiles={canUseProjectFiles} workspaceReady={false} />
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <>
      <BrowserStorageAlerts canUseProjectFiles={canUseProjectFiles} />
      {children}
      {retainedGuestWork ? (
        <aside
          data-retained-guest-work
          className="fixed inset-x-4 bottom-20 z-[85] mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4 text-[var(--cf-text)] shadow-2xl sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold">Signed-out work is still available</p>
            <p className="mt-1 text-sm leading-5 text-[var(--cf-text-muted)]">
              {retainedGuestWork.setCount} Set{retainedGuestWork.setCount === 1 ? '' : 's'}, {retainedGuestWork.cardCount} card{retainedGuestWork.cardCount === 1 ? '' : 's'}, and {retainedGuestWork.templateCount} personal Template{retainedGuestWork.templateCount === 1 ? '' : 's'} were kept separate when this existing account resumed. Add independent copies without replacing the work already in this account.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={guestImportBusy} onClick={dismissRetainedGuestWork}>Keep separate</Button>
            <Button type="button" disabled={guestImportBusy} onClick={() => void importRetainedGuestWork()}>{guestImportBusy ? 'Adding…' : 'Add to this account'}</Button>
          </div>
        </aside>
      ) : null}
      {issue ? (
        <aside
          role="alert"
          data-account-workspace-issue={issue.kind}
          className="fixed inset-x-4 bottom-4 z-[90] mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4 text-[var(--cf-text)] shadow-2xl sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold">{issue.title}</p>
            <p className="mt-1 text-sm leading-5 text-[var(--cf-text-muted)]">{issue.message}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={() => setIsIssueDialogOpen(true)}>Review</Button>
            <Button type="button" onClick={reloadSavedWorkspace}>Reload saved copy</Button>
          </div>
        </aside>
      ) : null}
      <AlertDialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{issue?.title ?? 'Workspace changed in another tab'}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">
              {issue?.message} Reloading discards unsaved changes in this tab. CardForge will not reload automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep this tab open</AlertDialogCancel>
            <AlertDialogAction onClick={reloadSavedWorkspace}>Reload saved copy</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
