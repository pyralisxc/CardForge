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

import {
  prepareAccountProjectWorkspace,
  subscribeToAccountProjectWorkspaceIssues,
  type AccountProjectWorkspaceBoundaryProps,
  type AccountProjectWorkspaceIssue,
} from '../client/accountProjectWorkspace';
import { BrowserStorageAlerts } from './BrowserStorageAlerts';

export function AccountProjectWorkspaceBoundary({
  children,
  persistenceScope,
  canUseProjectFiles,
}: AccountProjectWorkspaceBoundaryProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<AccountProjectWorkspaceIssue | null>(null);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);

  const bootstrap = useCallback(async () => {
    setIsReady(false);
    setError(null);
    try {
      await prepareAccountProjectWorkspace(persistenceScope);
      setIsReady(true);
    } catch (bootstrapError) {
      console.error('Unable to prepare the account workspace.', bootstrapError);
      setError(bootstrapError instanceof Error ? bootstrapError.message : 'The browser workspace could not be restored.');
    }
  }, [persistenceScope]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => subscribeToAccountProjectWorkspaceIssues((nextIssue) => {
    setIssue(nextIssue);
    setIsIssueDialogOpen(true);
  }), []);

  const reloadSavedWorkspace = () => window.location.reload();

  if (!isReady) {
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
            <Button type="button" variant="outline" onClick={() => void bootstrap()}>Try again</Button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <>
      <BrowserStorageAlerts canUseProjectFiles={canUseProjectFiles} />
      {children}
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
