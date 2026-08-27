"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Boxes, FileArchive, ImageIcon, Loader2, Search, Sparkles, type LucideIcon,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  CollectionLedgerRow, ENVIRONMENT_ZONES, EnvironmentBoundaryNotice,
  EnvironmentSectionHeading, EnvironmentShell, EnvironmentStatus, EnvironmentSurfaceHeader,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type ActionDescriptor,
  type EnvironmentCollectionRecord, type EnvironmentDetailRecord,
  type EnvironmentStatusTone, type EnvironmentViewer, type SelectionSession, type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import type { ProjectPersistenceScope } from '@/features/project/client';

import { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import {
  ACCOUNT_LIBRARY_KINDS, getAccountLibrarySourceLabel,
  type AccountLibraryItem, type AccountLibraryKind, type AccountLibrarySource,
} from '../model/accountLibrary';
import {
  getAccountLibraryActionSources,
  getAccountLibraryEnvironmentActions,
} from '../model/accountLibraryEnvironment';
import {
  accountLibraryKindLabels, formatAccountLibraryBytes, formatAccountLibraryDate,
} from './AccountLibraryItemRow';

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  isDeveloper?: boolean;
  isOwner?: boolean;
  initialTool?: 'locations' | null;
  storageConnections?: ReactNode;
}

const LIBRARY_SOURCES: AccountLibrarySource[] = ['device', 'google-drive', 'local-folder', 'assistant-draft'];
const kindIcons: Record<AccountLibraryKind, LucideIcon> = {
  set: Boxes, project: FileArchive, asset: ImageIcon, 'working-draft': Sparkles,
};
const itemStatus = (item: AccountLibraryItem): { label: string; tone: EnvironmentStatusTone } => (
  item.locations.some((location) => location.status === 'needs-permission')
    ? { label: 'Permission required', tone: 'warning' }
    : item.kind === 'working-draft'
      ? { label: 'Temporary work', tone: 'warning' }
      : { label: 'Available', tone: 'success' }
);
const itemRecord = (item: AccountLibraryItem): EnvironmentCollectionRecord => {
  const state = itemStatus(item);
  const meta: Array<readonly [string, string] | null> = [
    ['Type', accountLibraryKindLabels[item.kind].replace(/s$/u, '')],
    ['Locations', item.locations.map((location) => location.label).join(' · ')],
    item.details.length ? ['Details', item.details.join(' · ')] : null,
    formatAccountLibraryBytes(item.sizeBytes) ? ['Size', formatAccountLibraryBytes(item.sizeBytes)!] : null,
    item.revision ? ['Revision', item.revision] : null,
    formatAccountLibraryDate(item.updatedAt) ? ['Updated', formatAccountLibraryDate(item.updatedAt)!] : null,
    formatAccountLibraryDate(item.expiresAt) ? ['Expires', formatAccountLibraryDate(item.expiresAt)!] : null,
  ];
  return {
    id: item.id, kind: item.kind, eyebrow: accountLibraryKindLabels[item.kind].replace(/s$/u, ''),
    title: item.name, summary: item.details.join(' · ') || 'Ready to inspect.',
    status: state.label, tone: state.tone, actionSources: getAccountLibraryActionSources(item),
    meta: meta.filter((entry): entry is readonly [string, string] => entry !== null),
    location: item.locations.map((location) => location.label).join(' + '),
    updated: formatAccountLibraryDate(item.updatedAt) ?? formatAccountLibraryDate(item.expiresAt) ?? 'No timestamp',
    icon: kindIcons[item.kind],
  };
};
export function UnifiedAccountLibrary({
  persistenceScope, isSignedIn, isDeveloper = false, isOwner = false,
  initialTool = null, storageConnections,
}: UnifiedAccountLibraryProps) {
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const [activeTool, setActiveTool] = useState<'locations' | null>(() => initialTool);
  const [storageCallback, setStorageCallback] = useState<{ title: string; message: string } | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, developer: isDeveloper || isOwner, owner: isOwner };
  const visibleZones = getVisibleEnvironmentZones(viewer);
  const libraryDefinition = ENVIRONMENT_ZONES.find((zone) => zone.id === 'library')!;
  const zones = !visibleZones.some((zone) => zone.id === 'library')
    ? [
        { ...libraryDefinition, minimumAccess: 'guest' as const },
        ...visibleZones,
      ]
    : visibleZones;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('storage');
    if (status === 'google-drive-connected') {
      setStorageCallback({
        title: 'Google Drive connected',
        message: 'Your CardForge project files can now live in your Google storage and remain reachable to CardForge services.',
      });
    } else if (status === 'google-drive-error') {
      setStorageCallback({
        title: 'Google Drive could not be connected',
        message: params.get('message') || 'Review Storage & connections and try again. Existing work remains unchanged.',
      });
    } else {
      setStorageCallback(null);
    }
  }, []);

  useEffect(() => {
    setActiveTool(initialTool);
  }, [initialTool]);

  const itemMap = new Map(projection.items.map((item) => [item.id, item]));
  const recordMap = new Map<string, EnvironmentDetailRecord>(projection.items.map((item) => [item.id, itemRecord(item)] as const));
  const currentRecord = selection.objectId ? recordMap.get(selection.objectId) ?? null : null;
  const currentItem = selection.objectId ? itemMap.get(selection.objectId) ?? null : null;
  const sourceFilterLabel = projection.source === 'all'
    ? `All sources · ${projection.items.length}`
    : `${getAccountLibrarySourceLabel(projection.source)} · ${projection.sourceCounts.get(projection.source) ?? 0}`;
  const kindFilterLabel = projection.kind === 'all' ? 'All types' : accountLibraryKindLabels[projection.kind];
  const sortLabel = projection.sort === 'name' ? 'Name' : projection.sort === 'kind' ? 'Type' : 'Recently updated';
  const actions: ActionDescriptor[] = activeTool === 'locations' ? [{
    id: 'library.close-locations', label: 'Back to Library', ownerFeature: 'storage-management',
    supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none', requiredPermission: 'guest',
    scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' }, commitment: 'none',
    automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
  }] : currentItem ? getAccountLibraryEnvironmentActions(
    currentItem,
    projection.busyItemId !== null ? 'Finish the current Library action first.' : undefined,
  ) : [{
      id: 'library.refresh', label: projection.isLoading ? 'Refreshing' : 'Refresh Library',
      ownerFeature: 'storage-management', supportedObjectKinds: [], supportedSources: ['provider-native'], revisionPolicy: 'none',
      requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary',
      availability: projection.isLoading ? { kind: 'disabled', reason: 'Library sources are already refreshing.' } : { kind: 'available' },
      commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: 'mutation',
    }];

  const openDetail = (record: EnvironmentDetailRecord) => {
    const listOffset = surfaceRef.current?.scrollTop ?? 0;
    setSelection((current) => openEnvironmentDetail({ ...current, listOffset }, {
      objectId: record.id, listOffset, focusReturnId: `environment-object-${record.id}`,
    }));
  };
  const closeDetail = () => {
    const restore = selection.detailRestore;
    const focusId = selection.focusReturnId;
    setSelection(closeEnvironmentDetail);
    requestAnimationFrame(() => {
      if (restore) surfaceRef.current?.scrollTo({ top: restore.listOffset });
      if (focusId) document.getElementById(focusId)?.focus();
    });
  };
  const runAction = (action: ActionDescriptor) => {
    if (action.id === 'library.close-locations') {
      setActiveTool(null);
      projection.router.push('/account?section=library');
      requestAnimationFrame(() => document.getElementById('library-locations-trigger')?.focus());
    } else if ((action.id === 'library.open' || action.id === 'library.continue') && currentItem) {
      void projection.openItem(currentItem);
    } else if (action.id === 'library.view-source' && currentItem?.webViewLink) {
      window.open(currentItem.webViewLink, '_blank', 'noopener,noreferrer');
    } else if (action.id === 'library.manage-location') {
      setSelection(closeEnvironmentDetail);
      setActiveTool('locations');
      projection.router.push('/account?section=storage');
    } else if (action.id === 'library.refresh') {
      projection.refresh();
    }
  };

  if (activeTool === 'locations') {
    return <EnvironmentShell
      ariaLabel="CardForge Library locations and connections"
      brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
      viewer={viewer} zones={zones} activeZone="library" viewportPolicy="flow"
      detail={null} actions={actions} surfaceRef={surfaceRef}
      statusContent={<><EnvironmentStatus label="Library locations" tone="neutral" /><EnvironmentStatus label="Changes affect only this location" tone="success" /></>}
      footerContent={<span>Nothing moves between locations automatically</span>}
      onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)}
      onCommand={() => projection.router.push('/account?section=library#library-search')}
      onAction={runAction} onCloseDetail={closeDetail}
    >
      <EnvironmentSurfaceHeader eyebrow="Library tool" title="Locations & connections" body="Inspect one owner at a time. Every save, reconnect, restore, detach, or removal action names the location it affects and leaves other copies unchanged." />
      <div className="mt-5">
        {storageConnections ?? <EnvironmentBoundaryNotice title="Location tools are unavailable" message="CardForge could not compose the location controls. Existing work remains unchanged." />}
      </div>
    </EnvironmentShell>;
  }

  return <EnvironmentShell
    ariaLabel="CardForge Library"
    brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
    viewer={viewer} zones={zones} activeZone="library" viewportPolicy="flow"
    detail={currentRecord} actions={actions} focusReturnId={selection.focusReturnId ?? undefined}
    surfaceRef={surfaceRef}
    statusContent={<>
      <EnvironmentStatus label={projection.isLoading ? 'Refreshing sources' : `${projection.visibleItems.length} of ${projection.items.length} objects`} tone={projection.isLoading ? 'warning' : 'neutral'} />
      <EnvironmentStatus label={projection.failures.length ? `${projection.failures.length} source issue${projection.failures.length === 1 ? '' : 's'}` : 'Available sources checked'} tone={projection.failures.length ? 'warning' : 'success'} />
    </>}
    footerContent={currentRecord ? <span>{currentRecord.title} selected</span> : <button id="library-locations-trigger" type="button" onClick={() => { setActiveTool('locations'); projection.router.push('/account?section=storage'); }}>Locations &amp; connections</button>}
    onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)}
    onCommand={() => searchRef.current?.focus()}
    onAction={runAction} onCloseDetail={closeDetail}
  >
    <EnvironmentSurfaceHeader eyebrow="Library" title="Work available across your connected locations" body="Sets, projects, connected assets, and private working drafts from this device, Google Drive, local project folders, and the temporary AI workspace. Storage remains with the source named on each item." />

    {storageCallback ? <EnvironmentBoundaryNotice title={storageCallback.title} message={storageCallback.message} /> : null}

    <div className="grid grid-cols-2 gap-2 border-y border-[var(--cf-border-subtle)] py-3 xl:grid-cols-[minmax(14rem,1fr)_12rem_12rem_10rem]" aria-label="Library toolbar">
      <label className="relative col-span-2 block xl:col-span-1"><span className="sr-only">Search your CardForge library</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-subtle)]" /><Input ref={searchRef} id="library-search" value={projection.query} onChange={(event) => projection.setQuery(event.target.value)} placeholder="Search names, sources, and details" className="pl-9" /></label>
      <Select value={projection.source} onValueChange={(value) => projection.setSource(value as AccountLibrarySource | 'all')}><SelectTrigger aria-label="Filter by source"><span className="truncate">{sourceFilterLabel}</span></SelectTrigger><SelectContent><SelectItem value="all">All sources · {projection.items.length}</SelectItem>{LIBRARY_SOURCES.map((option) => <SelectItem key={option} value={option}>{getAccountLibrarySourceLabel(option)} · {projection.sourceCounts.get(option) ?? 0}</SelectItem>)}</SelectContent></Select>
      <Select value={projection.kind} onValueChange={(value) => projection.setKind(value as AccountLibraryKind | 'all')}><SelectTrigger aria-label="Filter by type"><span className="truncate">{kindFilterLabel}</span></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{ACCOUNT_LIBRARY_KINDS.map((option) => <SelectItem key={option} value={option}>{accountLibraryKindLabels[option]}</SelectItem>)}</SelectContent></Select>
      <Select value={projection.sort} onValueChange={(value) => projection.setSort(value as 'recent' | 'name' | 'kind')}><SelectTrigger className="col-span-2 xl:col-span-1" aria-label="Sort library"><span className="truncate">{sortLabel}</span></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="kind">Type</SelectItem></SelectContent></Select>
    </div>

    {projection.failures.length ? <div className="mt-4" aria-label="Library source issues">{projection.failures.map((failure) => <EnvironmentBoundaryNotice key={`${failure.id}:${failure.code}`} title={`${failure.id.replaceAll('-', ' ')} · ${failure.kind.replaceAll('_', ' ')}`} message={`${failure.message}${failure.nextAction ? ` ${failure.nextAction}` : ''} Existing work remains unchanged.`} actionLabel={failure.retryable ? 'Retry' : undefined} onAction={failure.retryable ? projection.refresh : undefined} />)}</div> : null}

    <section className="mt-4" aria-labelledby="library-objects-heading">
      <EnvironmentSectionHeading id="library-objects-heading" title="Your Library" meta={`${projection.visibleItems.length} shown · ${projection.items.length} total`} />
      {projection.visibleItems.length ? <>
        <div className="hidden min-[901px]:grid min-h-9 grid-cols-[minmax(12rem,1.5fr)_minmax(5rem,0.55fr)_minmax(8rem,0.85fr)_minmax(7rem,0.7fr)_auto] items-center gap-2 px-3 text-[0.65rem] uppercase tracking-[0.1em] text-[var(--cf-text-subtle)]"><span>Work</span><span>Type</span><span>Location</span><span>Updated</span><span>Details</span></div>
        {projection.visibleItems.map((item) => {
          const record = itemRecord(item);
          return <CollectionLedgerRow key={record.id} item={record} selected={selection.objectId === record.id} onOpen={openDetail} />;
        })}
      </> : projection.isLoading && !projection.items.length ? <p className="flex items-center gap-2 border-b border-[var(--cf-border-subtle)] px-3 py-5 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading your library…</p> : <p className="border-b border-[var(--cf-border-subtle)] px-3 py-5 text-sm text-[var(--cf-text-muted)]">{projection.items.length ? 'No library items match this filter.' : 'Your library is ready for its first set, project, asset, or working draft.'}</p>}
    </section>
  </EnvironmentShell>;
}
