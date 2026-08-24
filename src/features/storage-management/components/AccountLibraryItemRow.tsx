"use client";

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Boxes,
  CloudDownload,
  ExternalLink,
  FileArchive,
  FolderOpen,
  ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  AccountLibraryItem,
  AccountLibraryKind,
  AccountLibrarySource,
} from '../model/accountLibrary';

export const accountLibraryKindLabels: Record<AccountLibraryKind, string> = {
  set: 'Sets',
  project: 'Projects',
  asset: 'Assets',
  'working-draft': 'Working drafts',
};

const sourceStyles: Record<AccountLibrarySource, string> = {
  device: 'border-sky-700/60 bg-sky-950/35 text-sky-100',
  'cardforge-cloud': 'border-amber-700/60 bg-amber-950/35 text-amber-100',
  'google-drive': 'border-emerald-700/60 bg-emerald-950/35 text-emerald-100',
  'local-folder': 'border-violet-700/60 bg-violet-950/35 text-violet-100',
  'assistant-draft': 'border-fuchsia-700/60 bg-fuchsia-950/35 text-fuchsia-100',
};

const formatBytes = (bytes: number | null) => {
  if (bytes === null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const KindIcon = ({ kind }: { kind: AccountLibraryKind }) => {
  if (kind === 'set') return <Boxes className="h-4 w-4" />;
  if (kind === 'project') return <FileArchive className="h-4 w-4" />;
  if (kind === 'asset') return <ImageIcon className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
};

export function AccountLibrarySourceBadge({
  source,
  children,
}: {
  source: AccountLibrarySource;
  children: ReactNode;
}) {
  return <span className={`border px-2 py-0.5 text-[11px] font-semibold ${sourceStyles[source]}`}>{children}</span>;
}

export function AccountLibraryItemRow({
  item,
  busy,
  anyItemBusy,
  onOpen,
}: {
  item: AccountLibraryItem;
  busy: boolean;
  anyItemBusy: boolean;
  onOpen: (item: AccountLibraryItem) => Promise<void>;
}) {
  const dateLabel = formatDate(item.updatedAt);
  const expirationLabel = formatDate(item.expiresAt);
  const sizeLabel = formatBytes(item.sizeBytes);
  const canOpen = Boolean(item.references.localSetId || item.references.cloudSetId || item.references.driveFileId);

  return (
    <article className="grid [content-visibility:auto] gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[var(--cf-accent-strong)]"><KindIcon kind={item.kind} /></span>
          <h3 className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{item.name}</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{accountLibraryKindLabels[item.kind].replace(/s$/u, '')}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.locations.map((location) => (
            <AccountLibrarySourceBadge key={`${item.id}:${location.source}`} source={location.source}>{location.label}</AccountLibrarySourceBadge>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">
          {[...item.details, sizeLabel, dateLabel ? `Updated ${dateLabel}` : null, expirationLabel ? `Expires ${expirationLabel}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.references.workingDraftId ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/studio?document=${encodeURIComponent(item.references.workingDraftId)}&revision=${encodeURIComponent(item.revision ?? '')}`}>
              Continue <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : canOpen ? (
          <Button type="button" size="sm" variant="outline" disabled={anyItemBusy} onClick={() => { void onOpen(item); }}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : item.references.cloudSetId && !item.references.localSetId ? <CloudDownload className="mr-2 h-4 w-4" /> : <FolderOpen className="mr-2 h-4 w-4" />}
            Open
          </Button>
        ) : null}
        {item.webViewLink ? (
          <Button asChild size="sm" variant="ghost"><a href={item.webViewLink} target="_blank" rel="noreferrer">View source <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>
        ) : null}
        {item.references.localFolder ? <Button asChild size="sm" variant="ghost"><Link href="/account?section=storage">Manage storage</Link></Button> : null}
      </div>
    </article>
  );
}
