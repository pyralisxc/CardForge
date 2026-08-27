"use client";

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Boxes, CreditCard, FileArchive, HardDrive, ImageIcon, Link2,
  Loader2, Search, ShieldCheck, Sparkles, type LucideIcon,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  CollectionLedgerRow, CompactSettingRow, ENVIRONMENT_ZONES, EnvironmentBoundaryNotice,
  EnvironmentSectionHeading, EnvironmentShell, EnvironmentStatus, EnvironmentSurfaceHeader,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type ActionDescriptor, type ActionSource,
  type EnvironmentCollectionRecord, type EnvironmentDetailRecord, type EnvironmentSettingRecord,
  type EnvironmentStatusTone, type EnvironmentViewer, type SelectionSession, type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
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
import type { AccountHomeStatus } from './AccountHomeStatusRow';

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  isDeveloper?: boolean;
  isOwner?: boolean;
  homeAccessStatus?: AccountHomeStatus;
  homeSecurityStatus?: AccountHomeStatus;
  initialTool?: 'locations' | null;
  storageConnections?: ReactNode;
  view?: 'home' | 'library';
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
const statusTone = (status: AccountHomeStatus): EnvironmentStatusTone => (
  /unavailable|error/iu.test(status.value) ? 'danger' : /required|connect|checking/iu.test(status.value) ? 'warning' : 'success'
);
const statusRecord = (status: AccountHomeStatus, icon: LucideIcon, source: ActionSource): EnvironmentSettingRecord => ({
  id: `account-status-${status.label.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')}`,
  kind: 'account-status', eyebrow: status.label, title: status.label, summary: status.detail,
  status: status.value, tone: statusTone(status),
  actionSources: [{ id: status.label, label: status.label, source, currentRevisionAvailable: true }],
  meta: [['Current state', status.value], ['What it means', status.detail]], value: status.value, icon,
});

export function UnifiedAccountLibrary({
  persistenceScope, isSignedIn, isDeveloper = false, isOwner = false,
  homeAccessStatus, homeSecurityStatus, initialTool = null, storageConnections, view = 'library',
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
  const zones = view === 'library' && !visibleZones.some((zone) => zone.id === 'library')
    ? [
        { ...libraryDefinition, minimumAccess: 'guest' as const },
        ...visibleZones,
      ]
    : visibleZones.some((zone) => zone.id === 'home')
      ? visibleZones
      : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'home' || zone.id === 'studio');

  useEffect(() => {
    if (view !== 'library') return;
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
  }, [view]);

  useEffect(() => {
    setActiveTool(initialTool);
  }, [initialTool]);

  const connectionFailure = projection.failures.some((failure) => failure.id === 'google-drive' || failure.id === 'personal-library');
  const statuses: AccountHomeStatus[] = [
    ...(homeAccessStatus ? [homeAccessStatus] : []),
    {
      label: 'Storage',
      value: projection.failures.some((failure) => failure.id === 'workspace') ? 'Device workspace unavailable' : 'Work is available',
      detail: `${projection.sourceCounts.get('device') ?? 0} on this device · ${projection.sourceCounts.get('assistant-draft') ?? 0} temporary working draft${(projection.sourceCounts.get('assistant-draft') ?? 0) === 1 ? '' : 's'}`,
      href: '/account?section=storage', action: 'Review',
    },
    {
      label: 'Connections',
      value: !isSignedIn ? 'Sign in to connect' : projection.loadingSources ? 'Checking connections' : connectionFailure ? 'Connection unavailable' : projection.sourceCounts.get('google-drive') ? 'Google Drive connected' : 'No provider connected',
      detail: connectionFailure ? 'A connected source could not be reached. Existing work remains visible and unchanged.' : `${projection.sourceCounts.get('google-drive') ?? 0} Google Drive item${(projection.sourceCounts.get('google-drive') ?? 0) === 1 ? '' : 's'} available to your Library.`,
      href: '/account?section=storage', action: 'Manage',
    },
    ...(homeSecurityStatus ? [homeSecurityStatus] : []),
  ];
  const statusIcons: Record<string, LucideIcon> = { Access: CreditCard, Storage: HardDrive, Connections: Link2, Security: ShieldCheck };
  const statusRecords = statuses.map((status) => statusRecord(status, statusIcons[status.label] ?? ShieldCheck, status.label === 'Storage' ? 'browser-local' : 'provider-native'));
  const itemMap = new Map(projection.items.map((item) => [item.id, item]));
  const recordMap = new Map<string, EnvironmentDetailRecord>([
    ...projection.items.map((item) => [item.id, itemRecord(item)] as const),
    ...statusRecords.map((record) => [record.id, record] as const),
  ]);
  const currentRecord = selection.objectId ? recordMap.get(selection.objectId) ?? null : null;
  const currentItem = selection.objectId ? itemMap.get(selection.objectId) ?? null : null;
  const currentStatus = selection.objectId ? statusRecords.find((record) => record.id === selection.objectId) ?? null : null;
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
  ) : currentStatus ? [{
    id: 'account.review-status', label: currentStatus.title === 'Security' ? 'Open profile' : currentStatus.title === 'Access' ? 'Review access' : 'Manage locations',
    ownerFeature: currentStatus.title === 'Access' ? 'billing' : currentStatus.title === 'Security' ? 'account' : 'storage-management',
    supportedObjectKinds: ['account-status'], supportedSources: currentStatus.actionSources.map((source) => source.source),
    revisionPolicy: 'none', requiredPermission: isSignedIn ? 'creator' : 'guest', scope: 'object', hierarchy: 'primary',
    availability: { kind: 'available' }, commitment: 'none',
    automation: { kind: 'human-only', owner: currentStatus.title === 'Security' ? 'provider' : 'cardforge' }, result: 'navigation',
  }] : view === 'home' ? [{
      id: 'home.open-studio', label: projection.featuredItem ? 'Resume in Studio' : 'Create in Studio',
      ownerFeature: 'app-shell', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none',
      requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' },
      commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
    }] : [{
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
    } else if (action.id === 'home.open-studio') {
      if (projection.featuredItem) void projection.openItem(projection.featuredItem); else projection.router.push('/studio');
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
    } else if (action.id === 'account.review-status' && currentStatus) {
      if (currentStatus.title === 'Storage' || currentStatus.title === 'Connections') {
        setSelection(closeEnvironmentDetail);
        setActiveTool('locations');
        projection.router.push('/account?section=storage');
      } else {
        projection.router.push(currentStatus.title === 'Security' ? '/account?section=profile' : '/account?section=billing');
      }
    }
  };

  if (view === 'home') {
    const featured = projection.featuredItem ? itemRecord(projection.featuredItem) : null;
    return <EnvironmentShell
      ariaLabel="CardForge account home"
      brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
      viewer={viewer} zones={zones} activeZone="home" viewportPolicy="flow"
      detail={currentRecord} actions={actions} focusReturnId={selection.focusReturnId ?? undefined}
      surfaceRef={surfaceRef}
      statusContent={<><EnvironmentStatus label={projection.isLoading ? 'Refreshing workspace' : `${projection.items.length} library object${projection.items.length === 1 ? '' : 's'}`} tone={projection.isLoading ? 'warning' : 'neutral'} /><EnvironmentStatus label={projection.failures.length ? `${projection.failures.length} source issue${projection.failures.length === 1 ? '' : 's'}` : 'Available sources checked'} tone={projection.failures.length ? 'warning' : 'success'} /></>}
      footerContent={isSignedIn ? <span>Private creator environment</span> : (
        <span className="flex items-center gap-3">
          <span>Local creator workspace</span>
          <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
          <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-up', '/account')} prefetch={false} onClick={markSignUpIntent}>Create account</Link>
        </span>
      )}
      onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)}
      onCommand={() => projection.router.push('/account?section=library')}
      onAction={runAction} onCloseDetail={closeDetail}
    >
      <EnvironmentSurfaceHeader eyebrow="Home" title={isSignedIn ? 'Your CardForge home' : 'Your local CardForge workspace'} body="Resume the object already in motion, scan the account truths that need attention, or move into the zone that owns the next task." />
      {projection.failures.length ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${projection.failures[0]?.message ?? 'A source could not be reached.'} Existing work remains unchanged.`} actionLabel="Retry" onAction={projection.refresh} /> : null}
      <section aria-labelledby="home-current-work-heading">
        <EnvironmentSectionHeading id="home-current-work-heading" title="Current work" meta={projection.isLoading ? 'Checking workspace' : featured ? 'Active object' : 'Ready to begin'} />
        {featured ? <CollectionLedgerRow item={featured} selected={selection.objectId === featured.id} onOpen={openDetail} /> : <p className="border-b border-[var(--cf-border-subtle)] px-3 py-5 text-sm text-[var(--cf-text-muted)]">No current work yet. Create a Set in Studio or connect an existing project.</p>}
      </section>
      <section className="mt-5" aria-labelledby="home-account-snapshot-heading">
        <EnvironmentSectionHeading id="home-account-snapshot-heading" title="Account snapshot" meta={`${statusRecords.length} essentials`} />
        {statusRecords.map((record) => <CompactSettingRow key={record.id} item={record} selected={selection.objectId === record.id} onOpen={openDetail} />)}
      </section>
      <section className="mt-5" aria-labelledby="home-more-work-heading">
        <EnvironmentSectionHeading id="home-more-work-heading" title="More work" meta={`${projection.recentItems.length} available`} />
        {projection.recentItems.length ? projection.recentItems.map((item) => {
          const record = itemRecord(item);
          return <CollectionLedgerRow key={record.id} item={record} selected={selection.objectId === record.id} onOpen={openDetail} />;
        }) : <p className="border-b border-[var(--cf-border-subtle)] px-3 py-5 text-sm text-[var(--cf-text-muted)]">More Sets, projects, assets, and temporary drafts will appear here as you create or connect them.</p>}
      </section>
    </EnvironmentShell>;
  }

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
