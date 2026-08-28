"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Boxes, Cloud, FileArchive, FolderOpen, Grid2X2, HardDrive, ImageIcon,
  LayoutList, Loader2, MapPin, PanelRightOpen, Search, Sparkles, ThumbsDown,
  ThumbsUp, X, type LucideIcon,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import {
  ENVIRONMENT_ZONES, EnvironmentBoundaryNotice, EnvironmentShell, EnvironmentStatus,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type ActionDescriptor, type EnvironmentDetailRecord, type EnvironmentStatusTone,
  type EnvironmentViewer, type SelectionSession, type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { CardPreview } from '@/features/card-rendering/client';
import { selectAllGeneratedDisplayCards, useProjectStore, type ProjectPersistenceScope } from '@/features/project/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import {
  useLibrarySharedProjection,
  type PipelineLibraryObject,
  type PublishedLibraryObject,
} from '../hooks/useLibrarySharedProjection';
import {
  ACCOUNT_LIBRARY_KINDS, getAccountLibraryMcpWorkflow, getAccountLibrarySourceLabel,
  type AccountLibraryItem, type AccountLibraryKind, type AccountLibrarySource,
} from '../model/accountLibrary';
import { getAccountLibraryActionSources, getAccountLibraryEnvironmentActions } from '../model/accountLibraryEnvironment';
import {
  getLibraryScopeDefinitions, getLibraryScopeStatus,
  type LibraryDensity, type LibraryScope,
} from '../model/libraryScopes';
import { accountLibraryKindLabels, formatAccountLibraryBytes, formatAccountLibraryDate } from './AccountLibraryItemRow';
import styles from './UnifiedAccountLibrary.module.css';

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  isDeveloper?: boolean;
  isOwner?: boolean;
  initialTool?: 'locations' | null;
  storageConnections?: ReactNode;
}

type LibraryViewItem =
  | { id: string; scope: 'personal'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: null; fontFamily: null; personal: AccountLibraryItem }
  | { id: string; scope: 'published'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: null; sizeBytes: number | null; previewUrl: string | null; fontFamily: string | null; published: PublishedLibraryObject }
  | { id: string; scope: 'pipeline'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: string | null; fontFamily: null; pipeline: PipelineLibraryObject };

const LIBRARY_SOURCES: AccountLibrarySource[] = ['device', 'google-drive', 'local-folder', 'assistant-draft'];
const kindIcons: Record<AccountLibraryKind, LucideIcon> = { set: Boxes, project: FileArchive, asset: ImageIcon, 'working-draft': Sparkles };
const sharedKindIcons: Record<string, LucideIcon> = { Template: Boxes, Image: ImageIcon, Texture: ImageIcon, Divider: ImageIcon, Icon: Sparkles, Style: Sparkles, Font: ImageIcon };

const personalStatus = (item: AccountLibraryItem): { label: string; tone: EnvironmentStatusTone } => (
  item.locations.some((location) => location.status === 'needs-permission')
    ? { label: 'Permission required', tone: 'warning' }
    : item.kind === 'working-draft' ? { label: 'Temporary work', tone: 'warning' } : { label: 'Available', tone: 'success' }
);

const agentLabel = (item: AccountLibraryItem): string => {
  const workflow = getAccountLibraryMcpWorkflow(item).availability;
  if (workflow === 'revision-safe') return 'Agent editable';
  if (workflow === 'working-document') return 'Agent workspace';
  if (workflow === 'read-only') return 'Agent can search';
  return 'Device only';
};

const safePreviewUrl = (url: string | null): string | null => (
  url && !url.startsWith('/api/templates') && !url.startsWith('/api/styles') ? url : null
);
const formatDate = (value: string | null) => formatAccountLibraryDate(value) ?? 'No timestamp';

function SourceIcon({ item }: { item: LibraryViewItem }) {
  if (item.scope === 'personal') {
    const source = item.personal.locations[0]?.source;
    if (source === 'google-drive') return <Cloud aria-hidden="true" />;
    if (source === 'local-folder') return <FolderOpen aria-hidden="true" />;
    if (source === 'assistant-draft') return <Sparkles aria-hidden="true" />;
    const Icon = kindIcons[item.personal.kind];
    return <Icon aria-hidden="true" />;
  }
  const Icon = sharedKindIcons[item.kindLabel] ?? ImageIcon;
  return <Icon aria-hidden="true" />;
}

function SharedLibraryVisual({ item, previewUrl }: { item: LibraryViewItem; previewUrl: string | null }) {
  const [previewFailed, setPreviewFailed] = useState(false);

  if (previewUrl && !previewFailed) {
    return <img src={previewUrl} alt="" className={styles.objectImage} onError={() => setPreviewFailed(true)} />;
  }
  if (item.fontFamily) return <span className={styles.fontSample} style={{ fontFamily: item.fontFamily }}>Aa</span>;
  return <span className={styles.objectFallback}><SourceIcon item={item} /></span>;
}

function LibraryVisual({ item, cards, large = false }: { item: LibraryViewItem; cards: DisplayCard[]; large?: boolean }) {
  if (item.scope === 'personal' && cards.length) {
    return <div className={styles.cardStack} data-large={large}>{cards.slice(0, 3).map((card) => <CardPreview key={card.uniqueId} card={card} targetWidthPx={large ? 150 : 96} />)}</div>;
  }
  const previewUrl = safePreviewUrl(item.previewUrl);
  return <SharedLibraryVisual key={previewUrl ?? item.id} item={item} previewUrl={previewUrl} />;
}

const detailRecord = (item: LibraryViewItem): EnvironmentDetailRecord => {
  if (item.scope === 'personal') {
    const status = personalStatus(item.personal);
    return {
      id: item.id, kind: item.personal.kind, eyebrow: `${item.kindLabel} · Personal`, title: item.name,
      summary: item.summary, status: status.label, tone: status.tone,
      actionSources: getAccountLibraryActionSources(item.personal),
      meta: [
        ['Location', item.personal.locations.map((location) => location.label).join(' + ')],
        ['Agent access', agentLabel(item.personal)],
        ...(item.personal.revision ? [['Revision', item.personal.revision] as const] : []),
        ...(formatAccountLibraryBytes(item.sizeBytes) ? [['Size', formatAccountLibraryBytes(item.sizeBytes)!] as const] : []),
        ['Updated', formatDate(item.updatedAt)],
        ...(item.personal.expiresAt ? [['Expires', formatDate(item.personal.expiresAt)] as const] : []),
      ],
    };
  }
  if (item.scope === 'published') return {
    id: item.id, kind: 'published-asset', eyebrow: `${item.kindLabel} · Published`, title: item.name,
    summary: item.summary, status: item.statusLabel, tone: 'success',
    actionSources: [{ id: `${item.id}:catalog`, label: 'CardForge catalog', source: 'provider-native', currentRevisionAvailable: true }],
    meta: [
      ['Collection', item.published.accessLabel], ['Authorship', item.sourceLabel],
      ...(formatAccountLibraryBytes(item.sizeBytes) ? [['Size', formatAccountLibraryBytes(item.sizeBytes)!] as const] : []),
      ['Studio access', 'Ready to use'],
    ],
  };
  return {
    id: item.id, kind: 'pipeline-asset', eyebrow: `${item.kindLabel} · Pipeline`, title: item.name,
    summary: item.summary, status: item.statusLabel,
    tone: item.pipeline.submission.status === 'rejected' ? 'danger' : item.pipeline.submission.status === 'published' ? 'success' : 'warning',
    actionSources: [{ id: `${item.id}:pipeline`, label: 'Forge Review', source: 'provider-native', currentRevisionAvailable: true }],
    meta: [
      ['Relationship', item.pipeline.relationship === 'owned' ? 'Your submission' : 'Available to review'],
      ['Revision', String(item.pipeline.submission.revisionNumber ?? 1)],
      ['Votes', `${item.pipeline.submission.positiveVotes} up · ${item.pipeline.submission.negativeVotes} down`],
      ['Updated', formatDate(item.updatedAt)],
    ],
  };
};

const zoneAction = (id: 'library.refresh' | 'library.close-locations', label: string, loading = false): ActionDescriptor => ({
  id, label, ownerFeature: 'storage-management', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none',
  requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary',
  availability: loading ? { kind: 'disabled', reason: 'Library sources are already refreshing.' } : { kind: 'available' },
  commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: id === 'library.refresh' ? 'mutation' : 'navigation',
});

const sharedActions = (scope: 'published' | 'pipeline'): ActionDescriptor[] => [scope === 'published' ? {
  id: 'library.open-studio', label: 'Open Studio', ownerFeature: 'developer-assets', supportedObjectKinds: ['published-asset'],
  supportedSources: ['provider-native'], revisionPolicy: 'none', requiredPermission: 'guest', scope: 'object', hierarchy: 'primary',
  availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'planned-mcp', capability: 'select a published catalog asset for Studio' }, result: 'navigation',
} : {
  id: 'library.open-pipeline', label: 'Open in Forge Review', ownerFeature: 'developer-assets', supportedObjectKinds: ['pipeline-asset'],
  supportedSources: ['provider-native'], revisionPolicy: 'current-required', requiredPermission: 'developer', scope: 'object', hierarchy: 'primary',
  availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
}];

export function UnifiedAccountLibrary({ persistenceScope, isSignedIn, isDeveloper = false, isOwner = false, initialTool = null, storageConnections }: UnifiedAccountLibraryProps) {
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const { toast } = useToast();
  const [scope, setScope] = useState<LibraryScope>('personal');
  const shared = useLibrarySharedProjection({ pipelineEnabled: isDeveloper || isOwner, activeScope: scope });
  const [density, setDensity] = useState<LibraryDensity>('gallery');
  const [sharedType, setSharedType] = useState('all');
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const [activeTool, setActiveTool] = useState<'locations' | null>(() => initialTool);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [storageCallback, setStorageCallback] = useState<{ title: string; message: string } | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const displayCards = useProjectStore(selectAllGeneratedDisplayCards);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, developer: isDeveloper || isOwner, owner: isOwner };
  const scopeDefinitions = getLibraryScopeDefinitions(viewer);
  const visibleZones = getVisibleEnvironmentZones(viewer);
  const libraryDefinition = ENVIRONMENT_ZONES.find((zone) => zone.id === 'library')!;
  const zones = visibleZones.some((zone) => zone.id === 'library') ? visibleZones : [{ ...libraryDefinition, minimumAccess: 'guest' as const }, ...visibleZones];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedScope = params.get('scope');
    if (requestedScope === 'published' || (requestedScope === 'pipeline' && (isDeveloper || isOwner))) setScope(requestedScope);
    const status = params.get('storage');
    if (status === 'google-drive-connected') setStorageCallback({ title: 'Google Drive connected', message: 'Google Drive is now available as a durable project and asset location.' });
    else if (status === 'google-drive-error') setStorageCallback({ title: 'Google Drive could not be connected', message: params.get('message') || 'Review Locations & connections and try again. Existing work remains unchanged.' });
    else setStorageCallback(null);
  }, [isDeveloper, isOwner]);
  useEffect(() => { setActiveTool(initialTool); }, [initialTool]);

  const personalItems = useMemo<LibraryViewItem[]>(() => projection.visibleItems.map((item) => {
    const status = personalStatus(item);
    return {
      id: item.id, scope: 'personal', name: item.name, kindLabel: accountLibraryKindLabels[item.kind].replace(/s$/u, ''),
      sourceLabel: item.locations.map((location) => location.label).join(' + '), statusLabel: status.label,
      summary: item.details.join(' · ') || 'Ready to inspect.', updatedAt: item.updatedAt ?? item.expiresAt,
      sizeBytes: item.sizeBytes, previewUrl: null, fontFamily: null, personal: item,
    };
  }), [projection.visibleItems]);
  const publishedItems = useMemo<LibraryViewItem[]>(() => shared.publishedItems.map((item) => ({
    id: item.id, scope: 'published', name: item.name, kindLabel: item.kindLabel, sourceLabel: item.sourceLabel,
    statusLabel: item.accessLabel, summary: `${item.kindLabel} from the current ${item.accessLabel}.`, updatedAt: null,
    sizeBytes: item.sizeBytes, previewUrl: item.previewUrl, fontFamily: item.fontFamily, published: item,
  })), [shared.publishedItems]);
  const pipelineItems = useMemo<LibraryViewItem[]>(() => shared.pipelineItems.map((item) => ({
    id: `pipeline:${item.submission.id}`, scope: 'pipeline', name: item.submission.name, kindLabel: item.kindLabel,
    sourceLabel: item.relationship === 'owned' ? 'Your submission' : 'Review queue', statusLabel: item.statusLabel,
    summary: item.submission.description || `${item.kindLabel} in Forge Review.`, updatedAt: item.submission.updatedAt ?? item.submission.submittedAt,
    sizeBytes: item.submission.sourceFileSizeBytes, previewUrl: item.submission.previewUrl || item.submission.sourceUrl,
    fontFamily: null, pipeline: item,
  })), [shared.pipelineItems]);

  const scopeItems = scope === 'personal' ? personalItems : scope === 'published' ? publishedItems : pipelineItems;
  const normalizedQuery = projection.query.trim().toLocaleLowerCase();
  const viewItems = useMemo(() => scopeItems.filter((item) => {
    if (scope !== 'personal' && sharedType !== 'all' && item.kindLabel !== sharedType && item.statusLabel !== sharedType) return false;
    return !normalizedQuery || [item.name, item.kindLabel, item.sourceLabel, item.statusLabel, item.summary].join(' ').toLocaleLowerCase().includes(normalizedQuery);
  }).toSorted((left, right) => projection.sort === 'name'
    ? left.name.localeCompare(right.name)
    : projection.sort === 'kind'
      ? left.kindLabel.localeCompare(right.kindLabel) || left.name.localeCompare(right.name)
      : (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0) || left.name.localeCompare(right.name)), [normalizedQuery, projection.sort, scope, scopeItems, sharedType]);
  const sharedTypes = useMemo(() => [...new Set(scopeItems.flatMap((item) => scope === 'pipeline' ? [item.kindLabel, item.statusLabel] : [item.kindLabel]))].toSorted(), [scope, scopeItems]);
  const itemMap = useMemo(() => new Map([...personalItems, ...publishedItems, ...pipelineItems].map((item) => [item.id, item])), [personalItems, pipelineItems, publishedItems]);
  const currentItem = selection.objectId ? itemMap.get(selection.objectId) ?? null : null;
  const currentRecord = currentItem ? detailRecord(currentItem) : null;
  const cardsBySetId = useMemo(() => {
    const bySet = new Map<string, DisplayCard[]>();
    displayCards.forEach((card) => {
      if (!card.setId) return;
      const setCards = bySet.get(card.setId) ?? [];
      if (setCards.length < 3) setCards.push(card);
      bySet.set(card.setId, setCards);
    });
    return bySet;
  }, [displayCards]);
  const cardsFor = (item: LibraryViewItem): DisplayCard[] => item.scope === 'personal' && item.personal.references.localSetId
    ? cardsBySetId.get(item.personal.references.localSetId) ?? [] : [];
  const activeFailure = scope === 'personal' ? projection.failures[0] ?? null : scope === 'published' ? shared.catalogFailure : shared.pipelineFailure;
  const activeLoading = scope === 'personal' ? projection.isLoading : scope === 'published' ? shared.catalogLoading : shared.pipelineLoading;
  const activeStatus = getLibraryScopeStatus({ loading: activeLoading, itemCount: scopeItems.length, failure: activeFailure?.message ?? null });

  const chooseScope = (nextScope: LibraryScope) => {
    setScope(nextScope); setSharedType('all'); setSelection(closeEnvironmentDetail);
    projection.router.replace(`/account?section=library&scope=${nextScope}`);
  };
  const openDetail = (item: LibraryViewItem) => {
    const listOffset = surfaceRef.current?.scrollTop ?? 0;
    setSelection((current) => openEnvironmentDetail({ ...current, listOffset }, { objectId: item.id, listOffset, focusReturnId: `library-object-${item.id}` }));
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
  const refresh = () => { projection.refresh(); void shared.refresh(); };
  const vote = async (item: Extract<LibraryViewItem, { scope: 'pipeline' }>, value: 'positive' | 'negative') => {
    setVotingId(item.pipeline.submission.id);
    try {
      const response = await fetch(`/api/developer-assets/${item.pipeline.submission.id}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: value }) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to record this vote.'));
      toast({ title: 'Vote recorded', description: `${item.name} has been updated in Forge Review.` });
      await shared.refresh();
    } catch (error) {
      toast({ title: 'Vote was not recorded', description: error instanceof Error ? error.message : 'Forge Review is unavailable.', variant: 'destructive' });
    } finally { setVotingId(null); }
  };

  const actions: ActionDescriptor[] = activeTool === 'locations'
    ? [zoneAction('library.close-locations', 'Close locations')]
    : currentItem?.scope === 'personal'
      ? getAccountLibraryEnvironmentActions(currentItem.personal, projection.busyItemId !== null ? 'Finish the current Library action first.' : undefined)
      : currentItem?.scope === 'published' || currentItem?.scope === 'pipeline' ? sharedActions(currentItem.scope)
        : [zoneAction('library.refresh', activeLoading ? 'Refreshing' : 'Refresh Library', activeLoading)];

  const runAction = (action: ActionDescriptor) => {
    if (action.id === 'library.close-locations') {
      setActiveTool(null); projection.router.replace(`/account?section=library&scope=${scope}`);
      requestAnimationFrame(() => document.getElementById('library-locations-trigger')?.focus());
    } else if ((action.id === 'library.open' || action.id === 'library.continue') && currentItem?.scope === 'personal') void projection.openItem(currentItem.personal);
    else if (action.id === 'library.view-source' && currentItem?.scope === 'personal' && currentItem.personal.webViewLink) window.open(currentItem.personal.webViewLink, '_blank', 'noopener,noreferrer');
    else if (action.id === 'library.manage-location') { closeDetail(); setActiveTool('locations'); projection.router.replace('/account?section=storage'); }
    else if (action.id === 'library.open-studio') projection.router.push('/studio');
    else if (action.id === 'library.open-pipeline' && currentItem?.scope === 'pipeline') projection.router.push(`/developer/cockpit?tab=library&submission=${encodeURIComponent(currentItem.pipeline.submission.id)}`);
    else if (action.id === 'library.refresh') refresh();
  };

  const scopeDefinition = scopeDefinitions.find((definition) => definition.id === scope)!;
  return <EnvironmentShell
    ariaLabel="CardForge Library" brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }} viewer={viewer}
    zones={zones} activeZone="library" viewportPolicy="desk" detail={activeTool ? null : currentRecord}
    detailVisual={currentItem ? <LibraryVisual item={currentItem} cards={cardsFor(currentItem)} large /> : undefined}
    actions={actions} focusReturnId={selection.focusReturnId ?? undefined} surfaceRef={surfaceRef}
    statusContent={<><EnvironmentStatus label={`${scopeDefinition.label} · ${activeStatus.label}`} tone={activeStatus.kind === 'unavailable' ? 'warning' : activeStatus.kind === 'ready' ? 'success' : 'neutral'} /><EnvironmentStatus label={scope === 'personal' ? `${projection.items.length} personal objects` : scope === 'published' ? `${publishedItems.length} published objects` : `${pipelineItems.length} pipeline objects`} tone="neutral" /></>}
    footerContent={activeTool ? <span>Nothing moves between locations automatically</span> : currentRecord ? <span>{currentRecord.title} selected</span> : <button id="library-locations-trigger" type="button" onClick={() => { setActiveTool('locations'); projection.router.replace('/account?section=storage'); }}><MapPin size={14} aria-hidden="true" /> Locations &amp; connections</button>}
    onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)} onCommand={() => searchRef.current?.focus()}
    onAction={runAction} onCloseDetail={closeDetail}
  >
    <div className={styles.library} data-density={density} data-tool-open={Boolean(activeTool)}>
      <header className={styles.libraryHeader}>
        <div><p>Library</p><h1>Your materials and work</h1><span>Browse what you own, what CardForge publishes, and what is moving through review.</span></div>
        <button type="button" className={styles.locationsButton} onClick={() => { setActiveTool('locations'); closeDetail(); projection.router.replace('/account?section=storage'); }}><HardDrive size={16} aria-hidden="true" />Locations</button>
      </header>
      <nav className={styles.scopeTabs} aria-label="Library scopes">
        {scopeDefinitions.map((definition) => <button key={definition.id} type="button" aria-current={scope === definition.id ? 'page' : undefined} onClick={() => chooseScope(definition.id)}><span>{definition.label}</span><small>{definition.owner}</small></button>)}
      </nav>
      {storageCallback ? <EnvironmentBoundaryNotice title={storageCallback.title} message={storageCallback.message} /> : null}
      <section className={styles.collection} aria-labelledby="library-collection-heading">
        <div className={styles.collectionHeading}><div><h2 id="library-collection-heading">{scopeDefinition.label}</h2><p>{scopeDefinition.description}</p></div><span>{viewItems.length} shown</span></div>
        <div className={styles.toolbar} aria-label="Library toolbar">
          <label className={styles.searchField}><span className="sr-only">Search Library</span><Search aria-hidden="true" /><Input ref={searchRef} id="library-search" value={projection.query} onChange={(event) => projection.setQuery(event.target.value)} placeholder={`Search ${scope}`} /></label>
          {scope === 'personal' ? <>
            <Select value={projection.source} onValueChange={(value) => projection.setSource(value as AccountLibrarySource | 'all')}><SelectTrigger aria-label="Filter by source" className={styles.filterSelect}><span>{projection.source === 'all' ? 'All sources' : getAccountLibrarySourceLabel(projection.source)}</span></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{LIBRARY_SOURCES.map((source) => <SelectItem key={source} value={source}>{getAccountLibrarySourceLabel(source)} · {projection.sourceCounts.get(source) ?? 0}</SelectItem>)}</SelectContent></Select>
            <Select value={projection.kind} onValueChange={(value) => projection.setKind(value as AccountLibraryKind | 'all')}><SelectTrigger aria-label="Filter by type" className={styles.filterSelect}><span>{projection.kind === 'all' ? 'All types' : accountLibraryKindLabels[projection.kind]}</span></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{ACCOUNT_LIBRARY_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{accountLibraryKindLabels[kind]}</SelectItem>)}</SelectContent></Select>
          </> : <Select value={sharedType} onValueChange={setSharedType}><SelectTrigger aria-label={scope === 'pipeline' ? 'Filter Pipeline' : 'Filter by type'} className={styles.filterSelect}><span>{sharedType === 'all' ? scope === 'pipeline' ? 'All work' : 'All types' : sharedType}</span></SelectTrigger><SelectContent><SelectItem value="all">{scope === 'pipeline' ? 'All work' : 'All types'}</SelectItem>{sharedTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}
          <Select value={projection.sort} onValueChange={(value) => projection.setSort(value as 'recent' | 'name' | 'kind')}><SelectTrigger aria-label="Sort library" className={styles.sortSelect}><span>{projection.sort === 'name' ? 'Name' : projection.sort === 'kind' ? 'Type' : 'Recent'}</span></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="kind">Type</SelectItem></SelectContent></Select>
          <div className={styles.densityControls} aria-label="Collection view"><button type="button" aria-label="Gallery view" aria-pressed={density === 'gallery'} onClick={() => setDensity('gallery')}><Grid2X2 aria-hidden="true" /></button><button type="button" aria-label="Compact list view" aria-pressed={density === 'list'} onClick={() => setDensity('list')}><LayoutList aria-hidden="true" /></button><button type="button" aria-label="Expanded view" aria-pressed={density === 'expanded'} onClick={() => setDensity('expanded')}><PanelRightOpen aria-hidden="true" /></button></div>
        </div>
        {activeFailure ? <EnvironmentBoundaryNotice title={`${scopeDefinition.label} is unavailable`} message={`${activeFailure.message}${activeFailure.nextAction ? ` ${activeFailure.nextAction}` : ''} Other Library scopes remain unchanged.`} actionLabel={activeFailure.retryable ? 'Retry' : undefined} onAction={activeFailure.retryable ? refresh : undefined} /> : null}
        {activeLoading && !scopeItems.length ? <div className={styles.emptyState}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing {scope}</strong></div> : viewItems.length ? <div className={styles.objectGrid} aria-label={`${scope} Library objects`}>
          {viewItems.map((item) => {
            const pipelineItem = item.scope === 'pipeline' ? item : null;
            return <article key={item.id} className={styles.objectTile} data-selected={selection.objectId === item.id}>
              <button id={`library-object-${item.id}`} type="button" className={styles.objectButton} onClick={() => openDetail(item)}><span className={styles.visualSlot}><LibraryVisual item={item} cards={cardsFor(item)} /></span><span className={styles.objectCopy}><span className={styles.objectTopline}><small>{item.kindLabel}</small><small>{item.statusLabel}</small></span><strong>{item.name}</strong><span>{item.sourceLabel}</span><p>{item.summary}</p></span></button>
              {pipelineItem?.pipeline.relationship === 'review' ? <div className={styles.voteActions} aria-label={`Vote on ${item.name}`}><button type="button" disabled={votingId === pipelineItem.pipeline.submission.id} data-active={pipelineItem.pipeline.submission.currentUserVote === 'positive'} onClick={() => void vote(pipelineItem, 'positive')} aria-label={`Vote up for ${item.name}`}><ThumbsUp aria-hidden="true" />{pipelineItem.pipeline.submission.positiveVotes}</button><button type="button" disabled={votingId === pipelineItem.pipeline.submission.id} data-active={pipelineItem.pipeline.submission.currentUserVote === 'negative'} onClick={() => void vote(pipelineItem, 'negative')} aria-label={`Vote down for ${item.name}`}><ThumbsDown aria-hidden="true" />{pipelineItem.pipeline.submission.negativeVotes}</button></div> : null}
            </article>;
          })}
        </div> : <div className={styles.emptyState}><Boxes aria-hidden="true" /><strong>{scopeItems.length ? 'No objects match this view' : `${scopeDefinition.label} is ready`}</strong><p>{scopeItems.length ? 'Clear the search or change the filter.' : scope === 'personal' ? 'Create a Set or connect a location to begin.' : scope === 'published' ? 'Published assets will appear here when the catalog is available.' : 'Your submissions and reviewable work will appear here.'}</p></div>}
      </section>
      {activeTool === 'locations' ? <div className={styles.toolLayer} role="dialog" aria-modal="false" aria-labelledby="library-locations-title"><button type="button" className={styles.toolScrim} aria-label="Close locations and connections" onClick={() => runAction(actions[0]!)} /><section className={styles.toolPanel}><header><div><p>Library tool</p><h2 id="library-locations-title">Locations &amp; connections</h2><span>Inspect one owner at a time. Changes affect only the named location.</span></div><button type="button" onClick={() => runAction(actions[0]!)} aria-label="Close locations and connections"><X aria-hidden="true" /></button></header><div className={styles.toolContent}>{storageConnections ?? <EnvironmentBoundaryNotice title="Location tools are unavailable" message="CardForge could not compose the location controls. Existing work remains unchanged." />}</div></section></div> : null}
    </div>
  </EnvironmentShell>;
}
