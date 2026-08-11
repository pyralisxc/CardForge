"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type {
  CampaignMedia,
  CampaignMediaLibrarySummary,
} from '@/features/developer-cockpit/model';

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
  summary,
}: {
  media: CampaignMedia[];
  summary: CampaignMediaLibrarySummary;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = media.find((item) => item.id === selectedId) ?? null;
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return media.filter((item) => {
      const matchesQuery = !normalizedQuery || [
        item.originalFilename,
        item.creatorCredit,
        item.reusableCaption,
        item.reusableDescription,
        item.contributorName,
        item.contributorEmail,
        item.contentHash,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      const matchesFilter = filter === 'all'
        || (filter === 'unused'
          ? item.campaignIds.length === 0 && !item.archivedAt
          : filter === item.reviewState);
      return matchesQuery && matchesFilter;
    });
  }, [media, query, filter]);

  return (
    <section className="space-y-4">
      <header className="border border-[#5f4526] bg-[#15100a] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">
              Campaign Media Library
            </p>
            <h2 className="font-serif text-2xl text-[#fff1c7]">
              Reusable production media
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7b288]">
              A CardForge metadata catalog for approved and protected campaign media. Bucket paths and storage controls remain server-only.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[#c7b288] sm:grid-cols-4">
            <Metric label="Media" value={String(summary.mediaCount)} />
            <Metric label="Protected" value={bytes(summary.protectedBytes)} />
            <Metric label="Derivatives" value={bytes(summary.derivativeBytes)} />
            <Metric label="Unused" value={String(summary.unusedMediaCount)} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-h-11 items-center gap-2 border border-[#5f4526] bg-[#0c0b09] px-3">
            <Search className="h-4 w-4 text-[#a98a55]" />
            <span className="sr-only">Search campaign media</span>
            <input
              className="w-full bg-transparent text-sm text-[#ffe7ad] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search media, contributor, credit, caption, or hash"
            />
          </label>
          <select
            aria-label="Filter campaign media"
            className="min-h-11 border border-[#5f4526] bg-[#0c0b09] px-3 text-sm text-[#ffe7ad]"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All media</option>
            <option value="private">Private</option>
            <option value="needs_review">Needs review</option>
            <option value="approved">Approved</option>
            <option value="public">Public</option>
            <option value="archived">Archived</option>
            <option value="unused">Unused</option>
          </select>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className="overflow-hidden border border-[#4a3823] bg-[#15100a] text-left hover:border-[#d8b365] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f1c875]"
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
                <span className="text-xs uppercase tracking-[0.12em] text-[#e2aa4a]">
                  {item.reviewState.replace('_', ' ')}
                </span>
                <span className="text-xs text-[#a98a55]">
                  {item.width}×{item.height}
                </span>
              </div>
              <p className="mt-2 truncate text-sm text-[#fff1c7]">
                {item.originalFilename || item.id}
              </p>
              <p className="mt-1 text-xs text-[#c7b288]">
                {item.contributorName || item.contributorEmail || 'CardForge'} · {bytes(item.originalByteCount)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {!visible.length ? (
        <p className="border border-dashed border-[#4a3823] p-6 text-center text-sm text-[#a98a55]">
          No campaign media matches this view.
        </p>
      ) : null}

      {selected ? (
        <MediaDetail media={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </section>
  );
}

function MediaDetail({
  media,
  onClose,
}: {
  media: CampaignMedia;
  onClose: () => void;
}) {
  const rights = [media.rightsBasis, media.creatorCredit]
    .filter(Boolean)
    .join(' · ') || 'Not supplied';
  const focalPoint = media.focalPoint
    ? `${media.focalPoint.x.toFixed(2)}, ${media.focalPoint.y.toFixed(2)}`
    : 'Not set';

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#e2aa4a]">
            Media detail
          </p>
          <h3 className="font-serif text-xl text-[#fff1c7]">
            {media.originalFilename || media.id}
          </h3>
        </div>
        <button
          type="button"
          className="min-h-11 px-3 text-sm text-[#f1c875] underline"
          onClick={onClose}
        >
          Close
        </button>
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
        <dl className="grid gap-2 text-sm text-[#d8c49a]">
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
    <div className="border border-[#4a3823] bg-[#100c08] px-3 py-2">
      <p className="uppercase tracking-[0.12em] text-[#a98a55]">{label}</p>
      <p className="mt-1 text-sm text-[#fff1c7]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#4a3823] bg-[#100c08] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        {label}
      </dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
