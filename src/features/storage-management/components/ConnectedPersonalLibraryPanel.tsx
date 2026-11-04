"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FolderSearch, Library, Loader2, LogIn, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import {
  chooseGoogleDrivePersonalLibraryItems,
  getPersonalLibraryRoleLabel,
  loadPersonalLibrary,
  getPersonalLibraryItem,
  PERSONAL_LIBRARY_REMOVAL_NOTICE,
  PERSONAL_LIBRARY_ROLES,
  removePersonalLibraryItem,
  type PersonalLibraryItem,
  type PersonalLibraryListResult,
  type PersonalLibraryRole,
} from '@/features/personal-library/client';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export function ConnectedPersonalLibraryPanel({
  canUseConnectedStorage,
  embedded = false,
  isSignedIn,
}: {
  canUseConnectedStorage: boolean;
  embedded?: boolean;
  isSignedIn: boolean;
}) {
  const { toast } = useToast();
  const [library, setLibrary] = useState<PersonalLibraryListResult | null>(null);
  const [role, setRole] = useState<PersonalLibraryRole>('artwork');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [removalMessage, setRemovalMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ item: PersonalLibraryItem; message: string; present?: boolean } | null>(null);
  const removeItem = async (item: PersonalLibraryItem) => {
    setBusyAction(`remove:${item.id}`);
    setAttempt({ item, message: 'Removal is in progress. Do not repeat this request.' });
    try {
      const receipt = await removePersonalLibraryItem(item.id);
      if (receipt.outcome === 'removed') {
        setRemovedIds(ids => [...ids, item.id]);
        setAttempt(null);
        setRemovalMessage(receipt.message);
        toast({ title: 'Removed from CardForge library', description: receipt.message });
        await refresh();
      } else setAttempt({ item, message: receipt.message });
    } finally { setBusyAction(null); }
  };
  const readInFlight = useRef(false);
  const readAttempt = async () => {
    if (!attempt || readInFlight.current) return;
    readInFlight.current = true;
    const original = attempt;
    setAttempt({ item: original.item, message: 'Exact readback is pending. Do not repeat DELETE.' });
    setBusyAction(`read:${original.item.id}`);
    try {
      const result = await getPersonalLibraryItem(original.item.id);
      if (!result.item) setRemovedIds(ids => [...ids, original.item.id]);
      setAttempt({ ...original, present: Boolean(result.item), message: result.item ? 'This exact entry is currently present. This does not establish the earlier operation outcome. A new removal requires a new explicit confirmation.' : 'This exact entry is currently absent. This does not prove the attempted removal committed. No DELETE was replayed.' });
    } catch {
      setAttempt({ item: original.item, message: 'Exact readback is unavailable. The earlier removal remains unconfirmed. Do not repeat DELETE.' });
    } finally { readInFlight.current = false; setBusyAction(null); }
  };

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setLibrary(null);
      return;
    }
    try {
      setLibrary(await loadPersonalLibrary());
    } catch (error) {
      toast({
        title: 'Personal library unavailable',
        description: error instanceof Error ? error.message : 'CardForge could not load your connected personal library.',
        variant: 'destructive',
      });
    }
  }, [isSignedIn, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const itemsByRole = useMemo(() => {
    const counts = new Map<PersonalLibraryRole, number>();
    (library?.items ?? []).forEach((item) => counts.set(item.role, (counts.get(item.role) ?? 0) + 1));
    return counts;
  }, [library?.items]);

  const run = useCallback(async (action: string, execute: () => Promise<void>) => {
    setBusyAction(action);
    try {
      await execute();
      await refresh();
    } catch (error) {
      toast({
        title: 'Personal library action failed',
        description: error instanceof Error ? error.message : 'CardForge could not complete that library action.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }, [refresh, toast]);

  return (
    <section className={embedded ? 'py-1' : 'border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:p-5'} aria-labelledby={embedded ? undefined : 'connected-library-title'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!embedded ? (
          <div>
            <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
              <Library className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Connected assets</span>
            </div>
            <h2 id="connected-library-title" className="mt-2 font-serif text-2xl text-[var(--cf-text-strong)]">Google Drive asset access</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
              Authorize and classify files for the unified Library. CardForge stores their role and provider reference; the original bytes remain in Google Drive until you use an asset in a project.
            </p>
          </div>
        ) : <span className="text-xs leading-5 text-[var(--cf-text-muted)]">Files stay in Drive until you use them in a project.</span>}
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} disabled={!isSignedIn || Boolean(busyAction)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {isSignedIn && removalMessage ? <p role="status">{removalMessage}</p> : null}
      {isSignedIn && attempt ? <div role="status" className="mt-3 border p-3">
        <p>{attempt.item.displayName}: {attempt.message}</p>
        <Button type="button" disabled={Boolean(busyAction)} onClick={() => void readAttempt()}>Read exact index entry</Button>
        {attempt.present ? <Button type="button" disabled={Boolean(busyAction)} onClick={() => setAttempt(null)}>Allow a new removal confirmation</Button> : null}
        {attempt.present === false ? <Button type="button" disabled={Boolean(busyAction)} onClick={() => {
          setRemovalMessage(`${attempt.item.displayName}: ${attempt.message}`);
          setAttempt(null);
        }}>Continue with other items</Button> : null}
      </div> : null}
      {!isSignedIn ? (
        <div className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
          <p className="text-sm text-[var(--cf-text-muted)]">Sign in to build a connected personal library.</p>
          <Button asChild className="mt-3" size="sm">
            <Link href={createAuthRouteHref('/sign-in', '/account?section=library&tool=locations')} prefetch={false}>
              <LogIn className="mr-2 h-4 w-4" /> Sign in to connect
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-2 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
            <label className="min-w-[190px] flex-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
              What are you adding?
              <Select value={role} onValueChange={(value) => setRole(value as PersonalLibraryRole)}>
                <SelectTrigger className="mt-2 h-9 normal-case tracking-normal" aria-label="Personal library role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAL_LIBRARY_ROLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getPersonalLibraryRoleLabel(option)}{itemsByRole.get(option) ? ` (${itemsByRole.get(option)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={!canUseConnectedStorage || Boolean(busyAction)}
              onClick={() => void run('add-drive', async () => {
                const result = await chooseGoogleDrivePersonalLibraryItems(role);
                if (!result) return;
                toast({
                  title: 'Added to your CardForge library',
                  description: `${result.registeredCount} Google Drive file${result.registeredCount === 1 ? '' : 's'} indexed as ${getPersonalLibraryRoleLabel(role).toLowerCase()}.`,
                });
              })}
            >
              {busyAction === 'add-drive' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderSearch className="mr-2 h-4 w-4" />}
              Add from Google Drive
            </Button>
          </div>
          {!canUseConnectedStorage ? (
            <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">Connected project and personal-library storage are temporarily unavailable. Refresh and try again.</p>
          ) : null}

          {!library ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading your personal library…</p>
          ) : library.items.filter(item => !removedIds.includes(item.id)).length === 0 ? (
            <p className="mt-4 text-sm text-[var(--cf-text-muted)]">No connected assets yet. Choose a role, then explicitly select existing files from Google Drive.</p>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-[var(--cf-text-subtle)]">{library.count} / {library.limit} indexed references. Removing an item here never deletes the source file from Google Drive.</p>
              {library.items.filter(item => !removedIds.includes(item.id)).map((item) => (
                <ConnectedLibraryItemRow
                  key={item.id}
                  item={item}
                  busy={busyAction === `remove:${item.id}`}
                  disabled={Boolean(busyAction) || Boolean(attempt)}
                  onRemove={() => void removeItem(item)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ConnectedLibraryItemRow({
  item,
  busy,
  disabled,
  onRemove,
}: {
  item: PersonalLibraryItem;
  busy: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{item.displayName}</p>
        <p className="mt-1 text-xs text-[var(--cf-text-muted)]">
          {getPersonalLibraryRoleLabel(item.role)} · Google Drive · {formatBytes(item.byteSize)} · provider revision {item.providerRevision}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.providerWebViewLink ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={item.providerWebViewLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Drive</a>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            if (window.confirm(`Remove “${item.displayName}” (${item.id})? ${PERSONAL_LIBRARY_REMOVAL_NOTICE}`)) onRemove();
          }}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Remove
        </Button>
      </div>
    </div>
  );
}
