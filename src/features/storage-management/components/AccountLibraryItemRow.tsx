"use client";

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Boxes,
  ExternalLink,
  FolderOpen,
  HardDrive,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getAccountLibraryAvailableActions,
  type AccountLibraryItem,
  type AccountLibraryKind,
  type AccountLibrarySource,
} from '../model/accountLibrary';

export const accountLibraryKindLabels: Record<AccountLibraryKind, string> = {
  set: 'Sets',
  template: 'Templates',
  asset: 'Assets',
  'working-draft': 'Working drafts',
};

const sourceStyles: Record<AccountLibrarySource, string> = {
  device: 'border-sky-800/50 bg-sky-950/20 text-sky-100',
  'google-drive': 'border-emerald-800/50 bg-emerald-950/20 text-emerald-100',
  'local-folder': 'border-violet-800/50 bg-violet-950/20 text-violet-100',
  'assistant-draft': 'border-fuchsia-800/50 bg-fuchsia-950/20 text-fuchsia-100',
};

export const formatAccountLibraryBytes = (bytes: number | null) => {
  if (bytes === null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const formatAccountLibraryDate = (value: string | null) => {
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

const KindIcon = ({ kind, className = 'h-4 w-4' }: { kind: AccountLibraryKind; className?: string }) => {
  if (kind === 'set') return <Boxes className={className} />;
  if (kind === 'asset') return <ImageIcon className={className} />;
  return <Sparkles className={className} />;
};

export function AccountLibrarySourceBadge({
  source,
  children,
}: {
  source: AccountLibrarySource;
  children: ReactNode;
}) {
  return <span className={`inline-flex border px-2 py-0.5 text-[11px] font-medium ${sourceStyles[source]}`}>{children}</span>;
}

function ItemActions({
  item,
  featured,
  busy,
  anyItemBusy,
  onOpen,
  className,
}: {
  item: AccountLibraryItem;
  featured: boolean;
  busy: boolean;
  anyItemBusy: boolean;
  onOpen: (item: AccountLibraryItem) => Promise<void>;
  className?: string;
}) {
  const actions = getAccountLibraryAvailableActions(item);
  const canContinue = actions.includes('continue');
  const canOpen = actions.includes('open');
  const canViewSource = actions.includes('view-source');
  const canManageStorage = actions.includes('manage-storage');
  const primaryIsSource = !canContinue && !canOpen && canViewSource;
  const primaryIsStorage = !canContinue && !canOpen && !canViewSource && canManageStorage;
  const hasSecondary = (canViewSource && !primaryIsSource) || (canManageStorage && !primaryIsStorage);

  return (
    <div className={`flex shrink-0 items-center justify-end gap-1 ${className ?? ''}`}>
      {canContinue ? (
        <Button asChild size="sm" variant={featured ? 'default' : 'ghost'}>
          <Link href={`/studio?document=${encodeURIComponent(item.references.workingDraftId ?? '')}&revision=${encodeURIComponent(item.revision ?? '')}`}>
            Continue
          </Link>
        </Button>
      ) : canOpen ? (
        <Button type="button" size="sm" variant={featured ? 'default' : 'ghost'} disabled={anyItemBusy} onClick={() => { void onOpen(item); }}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : featured ? <FolderOpen className="mr-2 h-4 w-4" /> : null}
          {featured ? 'Resume' : 'Open'}
        </Button>
      ) : primaryIsSource && item.webViewLink ? (
        <Button asChild size="sm" variant="ghost"><a href={item.webViewLink} target="_blank" rel="noreferrer">View source</a></Button>
      ) : primaryIsStorage ? (
        <Button asChild size="sm" variant="ghost"><Link href="/account?section=library&tool=locations">Manage</Link></Button>
      ) : null}

      {hasSecondary ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" aria-label={`More actions for ${item.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-[var(--cf-border)] bg-[var(--cf-surface-raised)] text-[var(--cf-text-strong)]">
            {canViewSource && item.webViewLink && !primaryIsSource ? (
              <DropdownMenuItem asChild><a href={item.webViewLink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />View source</a></DropdownMenuItem>
            ) : null}
            {canManageStorage && !primaryIsStorage ? (
              <DropdownMenuItem asChild><Link href="/account?section=library&tool=locations"><HardDrive className="h-4 w-4" />Manage location</Link></DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function AccountLibraryItemRow({
  item,
  busy,
  anyItemBusy,
  onOpen,
  variant = 'workspace',
}: {
  item: AccountLibraryItem;
  busy: boolean;
  anyItemBusy: boolean;
  onOpen: (item: AccountLibraryItem) => Promise<void>;
  variant?: 'featured' | 'workspace';
}) {
  const dateLabel = formatAccountLibraryDate(item.updatedAt);
  const expirationLabel = formatAccountLibraryDate(item.expiresAt);
  const sizeLabel = formatAccountLibraryBytes(item.sizeBytes);

  if (variant === 'featured') {
    return (
      <article className="grid gap-3 border-y border-[var(--cf-border)] py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <KindIcon kind={item.kind} className="h-4 w-4 shrink-0 text-[var(--cf-accent-strong)]" />
            <h3 className="truncate font-serif text-lg font-semibold text-[var(--cf-text-strong)] sm:text-xl">{item.name}</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.locations.map((location) => (
              <AccountLibrarySourceBadge key={`${item.id}:${location.source}`} source={location.source}>{location.label}</AccountLibrarySourceBadge>
            ))}
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--cf-text-muted)] sm:line-clamp-none">
            {[...item.details, sizeLabel, dateLabel ? `Updated ${dateLabel}` : null, expirationLabel ? `Expires ${expirationLabel}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ItemActions item={item} featured busy={busy} anyItemBusy={anyItemBusy} onOpen={onOpen} className="justify-start sm:justify-end" />
      </article>
    );
  }

  return (
    <article className="grid [content-visibility:auto] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-[var(--cf-border-subtle)] py-3 md:grid-cols-[minmax(12rem,1.5fr)_0.6fr_minmax(10rem,1fr)_0.8fr_auto] md:gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] text-[var(--cf-accent-strong)]"><KindIcon kind={item.kind} /></span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{item.name}</h3>
          <p className="mt-0.5 truncate text-xs text-[var(--cf-text-subtle)]">{item.details.join(' · ')}</p>
        </div>
      </div>
      <span className="hidden text-xs text-[var(--cf-text-muted)] md:block">{accountLibraryKindLabels[item.kind].replace(/s$/u, '')}</span>
      <div className="hidden flex-wrap gap-1.5 md:flex">
        {item.locations.map((location) => (
          <AccountLibrarySourceBadge key={`${item.id}:${location.source}`} source={location.source}>{location.label}</AccountLibrarySourceBadge>
        ))}
      </div>
      <p className="hidden text-xs leading-5 text-[var(--cf-text-muted)] md:block">{dateLabel ?? expirationLabel ?? sizeLabel ?? '—'}</p>
      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[var(--cf-text-muted)] md:hidden">
        <span>{accountLibraryKindLabels[item.kind].replace(/s$/u, '')}</span>
        <span aria-hidden="true">·</span>
        {item.locations.map((location) => (
          <AccountLibrarySourceBadge key={`${item.id}:mobile:${location.source}`} source={location.source}>{location.label}</AccountLibrarySourceBadge>
        ))}
        <span className="truncate">{dateLabel ?? expirationLabel ?? sizeLabel ?? '—'}</span>
      </div>
      <ItemActions item={item} featured={false} busy={busy} anyItemBusy={anyItemBusy} onOpen={onOpen} className="col-start-2 row-start-1 md:col-auto md:row-auto" />
    </article>
  );
}
