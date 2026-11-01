"use client";
import { useEffect, useState } from 'react';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

// The shared endpoint intentionally returns public metadata, not a template,
// source payload, management target, or permission to restore/insert assets.
type SharedTrashItem = {
  id: string; lineageId: string | null; name: string; description: string | null;
  assetType: string; status: string; revisionNumber: number | null;
  trashedAt: string | null; purgeAfter: string | null;
  trashActorRole: 'owner' | 'contributor' | 'voting' | null;
  trashPreviousStatus: string | null; publicationRetained: boolean;
  positiveVotes: number; negativeVotes: number;
};
type SharedTrashPage = { total: number; page: number; pageSize: number; items: SharedTrashItem[] };

export function SharedPipelineTrashCollection({ onOpenAuthorizedRevision }: { onOpenAuthorizedRevision?: (item: SharedTrashItem) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SharedTrashPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { setPage(1); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(''); setLoading(true);
    const params = new URLSearchParams({ scope: 'shared', trash: 'trashed', query, page: String(page), pageSize: '12' });
    void fetch(`/api/pipeline/library?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Shared Trash is unavailable.'));
        return response.json() as Promise<{ sharedTrash: SharedTrashPage }>;
      })
      .then(({ sharedTrash }) => { if (!controller.signal.aborted) setResult(sharedTrash); })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Shared Trash is unavailable.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, page]);
  return <section aria-label="Shared Pipeline Trash" className="grid gap-3 px-3 py-4">
    <div><h2 className="font-semibold">Shared Trash</h2><p className="text-sm text-[var(--cf-text-muted)]">Discover retained shared revisions. Browsing does not restore them or make them available for Studio insertion. Your private drafts and connected files are separate.</p></div>
    <label className="grid gap-1 text-sm">Search shared Trash
      <input aria-label="Search shared Trash" value={query} onChange={event => setQuery(event.target.value)} className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3" />
    </label>
    {error ? <p role="alert">{error}</p> : null}
    <p role="status" className="text-sm">{loading ? 'Loading shared Trash…' : result ? `${result.total} matching shared revisions · Page ${result.page} of ${Math.max(1, Math.ceil(result.total / result.pageSize))}` : 'Shared Trash unavailable'}</p>
    {result?.items.length === 0 ? <p>No matching shared Trash items.</p> : null}
    <div className="grid gap-2">{result?.items.map(item => <article key={item.id} className="grid gap-1 border border-[var(--cf-border)] p-3">
      <div className="flex flex-wrap justify-between gap-2"><strong>{item.name}</strong><span className="text-sm">In Trash</span></div>
      <p className="text-sm text-[var(--cf-text-muted)]">{item.assetType} · {item.revisionNumber === null ? 'Unnumbered revision' : `Revision ${item.revisionNumber}`} · {item.status}</p>
      {item.description ? <p className="text-sm">{item.description}</p> : null}
      <p className="text-xs text-[var(--cf-text-muted)]">Submission {item.id} · Recovery deadline {item.purgeAfter ? new Date(item.purgeAfter).toLocaleDateString() : 'unavailable'}{item.publicationRetained ? ' · Publication history remains retained' : ''}</p>
      <p className="text-xs">Votes: {item.positiveVotes} up · {item.negativeVotes} down. Voting and Restore require their own eligibility checks.</p>
      {onOpenAuthorizedRevision ? <button type="button" className="justify-self-start min-h-11 border border-[var(--cf-border)] px-3 text-sm" onClick={() => onOpenAuthorizedRevision(item)}>Manage exact revision</button> : <p className="text-xs text-[var(--cf-text-muted)]">For voting or your own recovery options, use the authorized Pipeline account controls. Shared browsing alone grants no action.</p>}
    </article>)}</div>
    <div className="flex gap-2">
      <button type="button" className="min-h-11 border px-3" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button>
      <button type="button" className="min-h-11 border px-3" disabled={loading || !result || page * result.pageSize >= result.total} onClick={() => setPage(value => value + 1)}>Next</button>
    </div>
  </section>;
}
