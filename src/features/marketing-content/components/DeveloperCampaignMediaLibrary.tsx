"use client";

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, RotateCcw, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  CampaignMedia,
  CampaignMediaPageSummary,
  CampaignMediaLibrarySummary,
} from '@/features/marketing-content/model';

const bytes = (value: number) => (
  value < 1024 * 1024
    ? `${Math.round(value / 1024)} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`
);

const date = (value: string | null) => (
  value ? new Date(value).toLocaleDateString() : 'Not set'
);

const mediaAlt = (item: CampaignMedia) => (
  item.reusableDescription || item.originalFilename || 'Campaign media'
);

export function DeveloperCampaignMediaLibrary({
  media,
  pageInfo,
  summary,
  onRefresh,
}: {
  media: CampaignMedia[];
  pageInfo: CampaignMediaPageSummary;
  summary: CampaignMediaLibrarySummary;
  onRefresh: () => Promise<void> | void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(media);
  const [pageData, setPageData] = useState(pageInfo);
  const [page, setPage] = useState(pageInfo.page);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil(pageData.total / pageData.pageSize));

  const loadPage = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageInfo.pageSize) });
      if (query.trim()) params.set('query', query.trim());
      if (filter !== 'all') params.set('state', filter);
      const response = await fetch(`/api/marketing-content/media?${params}`, { cache: 'no-store', signal });
      const payload = await response.json() as {
        media?: CampaignMedia[];
        page?: { total: number; page: number; pageSize: number };
        error?: { message?: string };
      };
      if (!response.ok || !payload.media || !payload.page) {
        throw new Error(payload.error?.message || 'Unable to load campaign media.');
      }
      setItems(payload.media);
      setPageData(payload.page);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage(error instanceof Error ? error.message : 'Unable to load campaign media.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filter, page, pageInfo.pageSize, query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadPage(controller.signal), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadPage, reloadKey]);

  const updateMedia = async (
    item: CampaignMedia,
    method: 'PATCH' | 'DELETE',
    body: Record<string, unknown>,
  ) => {
    setWorking(true);
    setMessage('');
    try {
      const response = await fetch(`/api/marketing-content/media/${item.id}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as {
        cockpit?: unknown;
        message?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.cockpit) {
        throw new Error(payload?.error?.message || payload?.message || 'Unable to update campaign media.');
      }
      await onRefresh();
      setReloadKey((value) => value + 1);
      setMessage(method === 'DELETE'
        ? 'Campaign media and its managed files were permanently deleted.'
        : item.reviewState === 'archived'
          ? 'Campaign media restored.'
          : 'Campaign media retired from active use.');
      if (method === 'DELETE') setSelectedId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update campaign media.');
    } finally {
      setWorking(false);
    }
  };

  const deleteMedia = async (item: CampaignMedia) => {
    const confirmationFilename = window.prompt(
      `This permanently removes the media, campaign attachments, derivatives, and managed files. Type the exact filename to continue:\n\n${item.originalFilename}`,
    );
    if (confirmationFilename === null) return;
    await updateMedia(item, 'DELETE', { confirmationFilename });
  };

  return (
    <section className="space-y-4">
      <header className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">
              Campaign Media Library
            </p>
            <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
              Reusable production media
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
              A CardForge metadata catalog for approved and protected campaign media. Bucket paths and storage controls remain server-only.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--cf-text-muted)] sm:grid-cols-4">
            <Metric label="Media" value={String(summary.mediaCount)} />
            <Metric label="Protected" value={bytes(summary.protectedBytes)} />
            <Metric label="Derivatives" value={bytes(summary.derivativeBytes)} />
            <Metric label="Unused" value={String(summary.unusedMediaCount)} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-h-11 items-center gap-2 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3">
            <Search className="h-4 w-4 text-[var(--cf-text-subtle)]" />
            <span className="sr-only">Search campaign media</span>
            <input
              className="w-full bg-transparent text-sm text-[var(--cf-accent-text)] outline-none"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search media, contributor, credit, caption, or hash"
            />
          </label>
          <select
            aria-label="Filter campaign media"
            className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-sm text-[var(--cf-accent-text)]"
            value={filter}
            onChange={(event) => { setFilter(event.target.value); setPage(1); }}
          >
            <option value="all">All media</option>
            <option value="private">Private</option>
            <option value="needs_review">Needs review</option>
            <option value="approved">Approved</option>
            <option value="public">Public</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </header>

      {message ? <p role="status" className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[#f1c875]">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className="overflow-hidden border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] text-left hover:border-[var(--cf-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f1c875]"
          >
            <Image
              src={item.previewUrl}
              alt={mediaAlt(item)}
              width={640}
              height={360}
              unoptimized
              className="aspect-video w-full object-cover"
            />
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.12em] text-[var(--cf-accent-strong)]">
                  {item.reviewState.replace('_', ' ')}
                </span>
                <span className="text-xs text-[var(--cf-text-subtle)]">
                  {item.width}×{item.height}
                </span>
              </div>
              <p className="mt-2 truncate text-sm text-[var(--cf-text-strong)]">
                {item.originalFilename || item.id}
              </p>
              <p className="mt-1 text-xs text-[var(--cf-text-muted)]">
                {item.contributorName || item.contributorEmail || 'CardForge'} · {bytes(item.originalByteCount)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {!items.length && !loading ? (
        <p className="border border-dashed border-[var(--cf-border-subtle)] p-6 text-center text-sm text-[var(--cf-text-subtle)]">
          No campaign media matches this view.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-xs text-[var(--cf-text-muted)]">
        <span>{loading ? 'Loading media…' : `${pageData.total === 0 ? 0 : (pageData.page - 1) * pageData.pageSize + 1}-${Math.min(pageData.total, pageData.page * pageData.pageSize)} of ${pageData.total}`}</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" />Previous
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Next<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {selected ? (
        <MediaDetail
          media={selected}
          working={working}
          onArchive={() => void updateMedia(selected, 'PATCH', { archived: selected.reviewState !== 'archived' })}
          onDelete={() => void deleteMedia(selected)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </section>
  );
}

function MediaDetail({
  media,
  working,
  onArchive,
  onDelete,
  onClose,
}: {
  media: CampaignMedia;
  working: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const rights = [media.rightsBasis, media.creatorCredit]
    .filter(Boolean)
    .join(' · ') || 'Not supplied';
  const focalPoint = media.focalPoint
    ? `${media.focalPoint.x.toFixed(2)}, ${media.focalPoint.y.toFixed(2)}`
    : 'Not set';

  return (
    <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">
            Media detail
          </p>
          <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">
            {media.originalFilename || media.id}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={working}
            className="rounded-none border-[#8a642f] bg-transparent text-[#f1c875]"
            onClick={onArchive}
          >
            {media.reviewState === 'archived'
              ? <><RotateCcw className="mr-2 h-4 w-4" /> Restore media</>
              : <><Archive className="mr-2 h-4 w-4" /> Retire media</>}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={working}
            className="rounded-none border-[#8f3e36] bg-transparent text-[#ffb8a8] hover:bg-[#2a120d]"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete permanently
          </Button>
          <button
            type="button"
            className="min-h-11 px-3 text-sm text-[#f1c875] underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Image
          src={media.previewUrl}
          alt={mediaAlt(media)}
          width={960}
          height={540}
          unoptimized
          className="aspect-video w-full object-cover"
        />
        <dl className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
          <Detail
            label="Contributor"
            value={media.contributorName || media.contributorEmail || 'CardForge'}
          />
          <Detail label="Rights / credit" value={rights} />
          <Detail
            label="Rights restriction / expiry"
            value={[media.rightsRestriction, date(media.rightsExpiresAt)]
              .filter((value) => value && value !== 'Not set')
              .join(' · ') || 'No restriction recorded'}
          />
          <Detail label="Reusable caption" value={media.reusableCaption || 'Not supplied'} />
          <Detail
            label="Reusable description"
            value={media.reusableDescription || 'Not supplied'}
          />
          <Detail label="Focal point" value={focalPoint} />
          <Detail
            label="Relationships"
            value={`${media.campaignIds.length} campaign(s), ${media.deliveryCount} delivery record(s)`}
          />
          <Detail
            label="Campaign IDs"
            value={media.campaignIds.join(', ') || 'Not linked yet'}
          />
          <Detail label="Created" value={date(media.createdAt)} />
          <Detail
            label="Derivatives"
            value={media.derivatives.length
              ? media.derivatives.map((derivative) => (
                `${derivative.purpose.replace('_', ' ')} (${derivative.exposure}, ${derivative.width}×${derivative.height})`
              )).join(' · ')
              : 'No derivatives yet'}
          />
          <Detail label="Status" value={media.reviewState.replace('_', ' ')} />
          <Detail label="Exact duplicate key" value={`SHA-256 ${media.contentHash}`} />
        </dl>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-3 py-2">
      <p className="uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--cf-text-strong)]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
