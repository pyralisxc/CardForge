"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  Boxes, CreditCard, FileArchive, HardDrive, ImageIcon, LibraryBig, Link2,
  Loader2, RefreshCw, Search, ShieldCheck, Sparkles, type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CollectionLedgerRow, CompactSettingRow, ENVIRONMENT_ZONES, EnvironmentBoundaryNotice,
  EnvironmentSectionHeading, EnvironmentShell, EnvironmentStatus, EnvironmentSurfaceHeader,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type ActionAutomation, type ActionDescriptor, type ActionSource, type ActionSourceContext,
  type EnvironmentCollectionRecord, type EnvironmentDetailRecord, type EnvironmentSettingRecord,
  type EnvironmentStatusTone, type EnvironmentViewer, type SelectionSession, type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import type { ProjectPersistenceScope } from '@/features/project/client';

import { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import {
  ACCOUNT_LIBRARY_KINDS, getAccountLibraryAvailableActions, getAccountLibrarySourceLabel,
  type AccountLibraryItem, type AccountLibraryKind, type AccountLibrarySource,
} from '../model/accountLibrary';
import {
  AccountLibraryItemRow, accountLibraryKindLabels, formatAccountLibraryBytes, formatAccountLibraryDate,
} from './AccountLibraryItemRow';
import type { AccountHomeStatus } from './AccountHomeStatusRow';

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  isDeveloper?: boolean;
  isOwner?: boolean;
  cloudSetLimit: number;
  homeAccessStatus?: AccountHomeStatus;
  homeSecurityStatus?: AccountHomeStatus;
  view?: 'home' | 'library';
}

const LIBRARY_SOURCES: AccountLibrarySource[] = ['device', 'cardforge-cloud', 'google-drive', 'local-folder', 'assistant-draft'];
const sourceMap: Record<AccountLibrarySource, ActionSource> = {
  device: 'browser-local',
  'cardforge-cloud': 'cardforge-cloud',
  'google-drive': 'google-drive',
  'local-folder': 'local-folder',
  'assistant-draft': 'temporary',
};
const kindIcons: Record<AccountLibraryKind, LucideIcon> = {
  set: Boxes, project: FileArchive, asset: ImageIcon, 'working-draft': Sparkles,
};
const itemOwner = (item: AccountLibraryItem): ActionDescriptor['ownerFeature'] => (
  item.kind === 'asset' ? 'personal-library' : item.kind === 'working-draft' ? 'studio-documents' : 'project'
);
const actionSources = (item: AccountLibraryItem): ActionSourceContext[] => item.locations.map((location, index) => ({
  id: `${item.id}:${location.source}:${index}`,
  label: location.label,
  source: sourceMap[location.source],
  currentRevisionAvailable: location.source === 'device' || item.revision !== null,
}));
const automationFor = (item: AccountLibraryItem): ActionAutomation => (
  item.references.cloudSetId
    ? { kind: 'published-mcp', tools: ['get_cloud_set', 'checkout_cloud_set'] }
    : item.references.driveFileId
      ? { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] }
      : { kind: 'human-only', owner: 'cardforge' }
);
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
    status: state.label, tone: state.tone, actionSources: actionSources(item),
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

const actionsForItem = (item: AccountLibraryItem): ActionDescriptor[] => {
  const available = getAccountLibraryAvailableActions(item);
  const sources = item.locations.map((location) => sourceMap[location.source]);
  const actions: ActionDescriptor[] = [];
  if (available.includes('open') || available.includes('continue')) actions.push({
    id: 'library.open-work', label: available.includes('continue') ? 'Continue in Studio' : 'Open in Studio',
    ownerFeature: itemOwner(item), supportedObjectKinds: [item.kind], supportedSources: sources,
    revisionPolicy: 'none', requiredPermission: item.kind === 'working-draft' || item.references.cloudSetId || item.references.driveFileId ? 'creator' : 'guest',
    scope: 'object', hierarchy: 'primary', availability: { kind: 'available' }, commitment: 'none',
    automation: automationFor(item), result: 'navigation',
  });
  if (available.includes('view-source') && item.webViewLink) actions.push({
    id: 'library.view-source', label: 'View provider source', ownerFeature: itemOwner(item),
    supportedObjectKinds: [item.kind], supportedSources: ['google-drive'], revisionPolicy: 'none',
    requiredPermission: 'creator', scope: 'object', hierarchy: 'supporting', availability: { kind: 'available' },
    commitment: 'none', automation: { kind: 'human-only', owner: 'provider' }, result: 'provider-handoff',
  });
  if (available.includes('manage-storage')) actions.push({
    id: 'library.manage-location', label: 'Manage location', ownerFeature: 'storage-management',
    supportedObjectKinds: [item.kind], supportedSources: sources, revisionPolicy: 'none',
    requiredPermission: 'creator', scope: 'object', hierarchy: 'overflow', availability: { kind: 'available' },
    commitment: 'permission', automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
  });
  return actions;
};

export function UnifiedAccountLibrary({
  persistenceScope, isSignedIn, isDeveloper = false, isOwner = false, cloudSetLimit,
  homeAccessStatus, homeSecurityStatus, view = 'library',
}: UnifiedAccountLibraryProps) {
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn, cloudSetLimit });
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const surfaceRef = useRef<HTMLElement | null>(null);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, developer: isDeveloper || isOwner, owner: isOwner };
  const visibleZones = getVisibleEnvironmentZones(viewer);
  const zones = visibleZones.some((zone) => zone.id === 'home')
    ? visibleZones
    : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'home' || zone.id === 'studio');

  const connectionFailure = projection.failures.some((failure) => failure.id === 'google-drive' || failure.id === 'personal-library');
  const statuses: AccountHomeStatus[] = [
    ...(homeAccessStatus ? [homeAccessStatus] : []),
    {
      label: 'Storage',
      value: projection.failures.some((failure) => failure.id === 'workspace') ? 'Device workspace unavailable' : 'Work is available',
      detail: `${projection.sourceCounts.get('device') ?? 0} on this device · ${projection.cloud?.used ?? 0} of ${projection.cloudLimit} retiring cloud slots used`,
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
  const actions: ActionDescriptor[] = currentItem ? actionsForItem(currentItem) : currentStatus ? [{
    id: 'account.review-status', label: currentStatus.title === 'Security' ? 'Open profile' : currentStatus.title === 'Access' ? 'Review access' : 'Manage locations',
    ownerFeature: currentStatus.title === 'Access' ? 'billing' : currentStatus.title === 'Security' ? 'account' : 'storage-management',
    supportedObjectKinds: ['account-status'], supportedSources: currentStatus.actionSources.map((source) => source.source),
    revisionPolicy: 'none', requiredPermission: isSignedIn ? 'creator' : 'guest', scope: 'object', hierarchy: 'primary',
    availability: { kind: 'available' }, commitment: 'none',
    automation: { kind: 'human-only', owner: currentStatus.title === 'Security' ? 'provider' : 'cardforge' }, result: 'navigation',
  }] : [{
    id: 'home.open-studio', label: projection.featuredItem ? 'Resume in Studio' : 'Create in Studio',
    ownerFeature: 'app-shell', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none',
    requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' },
    commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
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
    if (action.id === 'home.open-studio') {
      if (projection.featuredItem) void projection.openItem(projection.featuredItem); else projection.router.push('/studio');
    } else if (action.id === 'library.open-work' && currentItem) {
      void projection.openItem(currentItem);
    } else if (action.id === 'library.view-source' && currentItem?.webViewLink) {
      window.open(currentItem.webViewLink, '_blank', 'noopener,noreferrer');
    } else if (action.id === 'library.manage-location') {
      projection.router.push('/account?section=storage');
    } else if (action.id === 'account.review-status' && currentStatus) {
      projection.router.push(currentStatus.title === 'Security' ? '/profile' : currentStatus.title === 'Access' ? '/account?section=billing' : '/account?section=storage');
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
        <EnvironmentSectionHeading id="home-account-snapshot-heading" title="Account snapshot" meta={`${statusRecords.length} grouped truths`} />
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

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cf-border)] pb-4">
      <div><div className="flex items-center gap-2 text-[var(--cf-accent-strong)]"><LibraryBig className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Library</span></div><h1 className="mt-2 font-serif text-2xl text-[var(--cf-text-strong)] md:text-3xl">Everything you can continue, reuse, or recover</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">One inventory across this device, CardForge Cloud, Google Drive, local project folders, and private working drafts. Storage remains with the source named on each item.</p></div>
      <Button type="button" size="sm" variant="outline" disabled={projection.isLoading} onClick={projection.refresh}>{projection.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh</Button>
    </div>
    <div className="mt-3 grid gap-2 border-y border-[var(--cf-border-subtle)] py-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_12rem_10rem]" aria-label="Library toolbar">
      <label className="relative block"><span className="sr-only">Search your CardForge library</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-subtle)]" /><Input id="library-search" value={projection.query} onChange={(event) => projection.setQuery(event.target.value)} placeholder="Search names, sources, and details" className="pl-9" /></label>
      <Select value={projection.source} onValueChange={(value) => projection.setSource(value as AccountLibrarySource | 'all')}><SelectTrigger aria-label="Filter by source"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources · {projection.items.length}</SelectItem>{LIBRARY_SOURCES.map((option) => <SelectItem key={option} value={option}>{getAccountLibrarySourceLabel(option)} · {projection.sourceCounts.get(option) ?? 0}</SelectItem>)}</SelectContent></Select>
      <Select value={projection.kind} onValueChange={(value) => projection.setKind(value as AccountLibraryKind | 'all')}><SelectTrigger aria-label="Filter by type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{ACCOUNT_LIBRARY_KINDS.map((option) => <SelectItem key={option} value={option}>{accountLibraryKindLabels[option]}</SelectItem>)}</SelectContent></Select>
      <Select value={projection.sort} onValueChange={(value) => projection.setSort(value as 'recent' | 'name' | 'kind')}><SelectTrigger aria-label="Sort library"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="kind">Type</SelectItem></SelectContent></Select>
    </div>
    {projection.failures.length ? <div className="mt-4"><EnvironmentBoundaryNotice title="Some library sources are unavailable" message={`${projection.failures[0]?.message ?? 'A source could not be reached.'} Existing work remains unchanged.`} actionLabel="Retry" onAction={projection.refresh} /></div> : null}
    {projection.isLoading && !projection.items.length ? <p className="mt-5 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading your library…</p> : !projection.visibleItems.length ? <p className="mt-5 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-4 text-sm text-[var(--cf-text-muted)]">{projection.items.length ? 'No library items match this filter.' : 'Your library is ready for its first set, project, asset, or working draft.'}</p> : <div className="mt-5">{projection.visibleItems.map((item) => <AccountLibraryItemRow key={item.id} item={item} busy={projection.busyItemId === item.id} anyItemBusy={projection.busyItemId !== null} onOpen={projection.openItem} />)}</div>}
    <Button asChild variant="ghost" size="sm" className="mt-5"><Link href="/account?section=storage">Open locations & connections</Link></Button>
  </div>;
}
