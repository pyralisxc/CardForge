"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  Boxes,
  Cloud,
  Copy,
  CreditCard,
  FileArchive,
  FolderPlus,
  HardDrive,
  Info,
  Link2,
  Loader2,
  Pencil,
  Pin,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import {
  ENVIRONMENT_ZONES,
  EnvironmentBoundaryNotice,
  EnvironmentShell,
  EnvironmentStatus,
  EnvironmentSurfaceHeader,
  getVisibleEnvironmentZones,
  type ActionDescriptor,
  type EnvironmentViewer,
  type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { CardPreview } from '@/features/card-rendering/client';
import {
  readProjectPreference,
  selectAllGeneratedDisplayCards,
  useProjectStore,
  writeProjectPreference,
  type ProjectPersistenceScope,
  type ProjectState,
} from '@/features/project/client';
import {
  getAccountLibrarySourceLabel,
  useAccountLibraryProjection,
  type AccountLibraryItem,
} from '@/features/storage-management/client';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

import {
  getCardTitle,
  getWorkActions,
  HOME_PINS_KEY,
  isUntouchedBootstrapWork,
  matchesSourceFilter,
  sourceFilterOptions,
  visibleWorkKinds,
  workDetailRecord,
  workSource,
  workSourceLabel,
  zoneAction,
  type HomeSort,
  type HomeSourceFilter,
} from '../model/homeDesk';
import styles from './HomeDesk.module.css';

export interface HomeAccountStatus {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
}

export interface HomeDeskProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  isDeveloper?: boolean;
  isOwner?: boolean;
  homeAccessStatus?: HomeAccountStatus;
  homeSecurityStatus?: HomeAccountStatus;
}

const statusIcons: Record<string, ComponentType<{ className?: string }>> = {
  Access: CreditCard,
  Storage: HardDrive,
  Connections: Link2,
  Security: ShieldCheck,
};

const WorkSourceIcon = ({ item, className }: { item: AccountLibraryItem; className?: string }) => {
  const source = workSource(item);
  const Icon = source === 'device'
    ? Boxes
    : source === 'assistant-draft'
      ? Sparkles
      : source === 'local-folder'
        ? FileArchive
        : Cloud;
  return <Icon className={className} aria-hidden="true" />;
};

export function HomeDesk({
  persistenceScope,
  isSignedIn,
  isDeveloper = false,
  isOwner = false,
  homeAccessStatus,
  homeSecurityStatus,
}: HomeDeskProps) {
  const { toast } = useToast();
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, developer: isDeveloper || isOwner, owner: isOwner };
  const zones = getVisibleEnvironmentZones(viewer);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<HomeSourceFilter>('all');
  const [sort, setSort] = useState<HomeSort>('desk');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [focusedWorkId, setFocusedWorkId] = useState<string | null>(null);
  const [inspectorWorkId, setInspectorWorkId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardQuery, setCardQuery] = useState('');
  const [moveTargetId, setMoveTargetId] = useState('');
  const [pendingDeleteWork, setPendingDeleteWork] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<DisplayCard | null>(null);

  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSetId = useProjectStore((state) => state.activeCardSet.id);
  const storedCards = useProjectStore((state) => state.storedCards);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const renameCardSet = useProjectStore((state) => state.renameCardSet);
  const duplicateCardSet = useProjectStore((state) => state.duplicateCardSet);
  const deleteCardSet = useProjectStore((state) => state.deleteCardSet);
  const moveGeneratedCardToSet = useProjectStore((state) => state.moveGeneratedCardToSet);
  const removeGeneratedCard = useProjectStore((state) => state.removeGeneratedCard);
  const openEditDialog = useProjectStore((state) => state.openEditDialog);
  const setActiveTab = useProjectStore((state) => state.setActiveTab);
  const displayCards = useMemo(() => selectAllGeneratedDisplayCards({
    cardSets,
    activeCardSet: cardSets.find((set) => set.id === activeCardSetId) ?? cardSets[0],
    storedCards,
    defaultTemplates,
    userTemplates,
  } as ProjectState), [activeCardSetId, cardSets, defaultTemplates, storedCards, userTemplates]);
  const pinKey = `${HOME_PINS_KEY}:${persistenceScope}`;

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(pinKey).then((value) => {
      if (!cancelled && Array.isArray(value)) setPinnedIds(value.filter((entry): entry is string => typeof entry === 'string'));
    });
    return () => { cancelled = true; };
  }, [pinKey]);

  const workItems = useMemo(() => projection.items.filter((item) => (
    visibleWorkKinds.has(item.kind) && !isUntouchedBootstrapWork(item)
  )), [projection.items]);
  const itemById = useMemo(() => new Map(workItems.map((item) => [item.id, item])), [workItems]);
  const activeWorkId = workItems.find((item) => item.references.localSetId === activeCardSetId)?.id
    ?? (projection.featuredItem && itemById.has(projection.featuredItem.id) ? projection.featuredItem.id : null);
  const visibleWork = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = workItems.filter((item) => (
      matchesSourceFilter(item, sourceFilter)
      && (!normalizedQuery || [item.name, ...item.details, workSourceLabel(item)].join(' ').toLocaleLowerCase().includes(normalizedQuery))
    ));
    return filtered.toSorted((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name);
      if (sort === 'size') return (right.sizeBytes ?? -1) - (left.sizeBytes ?? -1) || left.name.localeCompare(right.name);
      const leftPinned = pinnedIds.includes(left.id) ? 1 : 0;
      const rightPinned = pinnedIds.includes(right.id) ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      if (left.id === activeWorkId) return -1;
      if (right.id === activeWorkId) return 1;
      const leftTime = Date.parse(left.updatedAt ?? '');
      const rightTime = Date.parse(right.updatedAt ?? '');
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
      return left.name.localeCompare(right.name);
    });
  }, [activeWorkId, pinnedIds, query, sort, sourceFilter, workItems]);
  const focusedItem = focusedWorkId ? itemById.get(focusedWorkId) ?? null : null;
  const inspectorItem = inspectorWorkId ? itemById.get(inspectorWorkId) ?? null : null;
  const focusedLocalSetId = focusedItem?.references.localSetId ?? null;
  const focusedCards = focusedLocalSetId
    ? displayCards.filter((card) => card.setId === focusedLocalSetId || (!card.setId && cardSets[0]?.id === focusedLocalSetId))
    : [];
  const normalizedCardQuery = cardQuery.trim().toLocaleLowerCase();
  const visibleCards = focusedCards.filter((card, index) => !normalizedCardQuery || [getCardTitle(card, index), card.template.name]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedCardQuery));
  const selectedCard = selectedCardId ? focusedCards.find((card) => card.uniqueId === selectedCardId) ?? null : null;
  const otherSets = focusedLocalSetId ? cardSets.filter((set) => set.id !== focusedLocalSetId) : [];
  const effectiveMoveTargetId = otherSets.some((set) => set.id === moveTargetId)
    ? moveTargetId
    : otherSets[0]?.id ?? '';
  const focusedItemId = focusedItem?.id ?? null;
  const focusedItemName = focusedItem?.name ?? '';

  useEffect(() => {
    if (!focusedItemId) return;
    setRenameDraft(focusedItemName);
    setRenaming(false);
    setSelectedCardId(null);
    setCardQuery('');
  }, [focusedItemId, focusedItemName]);

  const statuses: HomeAccountStatus[] = [
    ...(homeAccessStatus ? [homeAccessStatus] : []),
    {
      label: 'Storage',
      value: projection.failures.some((failure) => failure.id === 'workspace') ? 'Device unavailable' : 'Work available',
      detail: `${projection.sourceCounts.get('device') ?? 0} on this device`,
      href: '/account?section=storage',
      action: 'Review',
    },
    {
      label: 'Connections',
      value: !isSignedIn ? 'Sign in to connect' : projection.loadingSources ? 'Checking' : projection.sourceCounts.get('google-drive') ? 'Drive connected' : 'Not connected',
      detail: `${projection.sourceCounts.get('google-drive') ?? 0} connected work item${(projection.sourceCounts.get('google-drive') ?? 0) === 1 ? '' : 's'}`,
      href: '/account?section=storage',
      action: 'Manage',
    },
    ...(homeSecurityStatus ? [homeSecurityStatus] : []),
  ];

  const togglePin = (itemId: string) => {
    setPinnedIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current];
      void writeProjectPreference(pinKey, next);
      return next;
    });
  };

  const focusWork = (item: AccountLibraryItem) => {
    if (item.references.localSetId) setActiveCardSetId(item.references.localSetId);
    setFocusedWorkId(item.id);
    setInspectorWorkId(null);
  };

  const createWork = () => {
    const id = createCardSet();
    setFocusedWorkId(`set:${id}`);
    setRenaming(true);
    requestAnimationFrame(() => document.getElementById('home-work-name')?.focus());
  };

  const duplicateWork = (item: AccountLibraryItem) => {
    if (!item.references.localSetId) return;
    const duplicateId = duplicateCardSet(item.references.localSetId);
    if (!duplicateId) return;
    setFocusedWorkId(`set:${duplicateId}`);
    setInspectorWorkId(null);
    toast({ title: 'Work duplicated', description: 'The copied Set and its cards are independently editable.' });
  };

  const commitRename = () => {
    if (!focusedLocalSetId) return;
    renameCardSet(focusedLocalSetId, renameDraft);
    setRenaming(false);
  };

  const inspectItem = (item: AccountLibraryItem) => {
    setInspectorWorkId(item.id);
    requestAnimationFrame(() => document.getElementById(`home-work-${item.id}`)?.focus());
  };

  const actions: ActionDescriptor[] = inspectorItem
    ? getWorkActions(inspectorItem, pinnedIds.includes(inspectorItem.id), cardSets.length > 1)
    : focusedItem
      ? [zoneAction('home.open-work', 'Open in Studio')]
      : [zoneAction('home.create-work', 'New Set', 'mutation')];
  const detail = inspectorItem ? workDetailRecord(inspectorItem) : null;

  const runAction = (action: ActionDescriptor) => {
    const item = inspectorItem ?? focusedItem;
    if (action.id === 'home.create-work') createWork();
    else if (action.id === 'home.open-work' && item) void projection.openItem(item);
    else if (action.id === 'home.pin-work' && inspectorItem) togglePin(inspectorItem.id);
    else if (action.id === 'home.rename-work' && inspectorItem?.references.localSetId) {
      focusWork(inspectorItem);
      setRenaming(true);
      requestAnimationFrame(() => document.getElementById('home-work-name')?.focus());
    } else if (action.id === 'home.duplicate-work' && inspectorItem) duplicateWork(inspectorItem);
    else if (action.id === 'home.delete-work' && inspectorItem) setPendingDeleteWork(inspectorItem);
    else if (action.id === 'home.manage-location') projection.router.push('/account?section=storage');
  };

  const moveSelectedCard = () => {
    if (!selectedCard || !effectiveMoveTargetId) return;
    if (!moveGeneratedCardToSet(selectedCard.uniqueId, effectiveMoveTargetId)) return;
    const destination = cardSets.find((set) => set.id === effectiveMoveTargetId);
    toast({ title: 'Card moved', description: `${getCardTitle(selectedCard, 0)} now belongs to ${destination?.name ?? 'the selected Set'}.` });
    setSelectedCardId(null);
  };

  const editSelectedCard = () => {
    if (!selectedCard || !focusedLocalSetId) return;
    setActiveCardSetId(focusedLocalSetId);
    setActiveTab('sets');
    openEditDialog(selectedCard.uniqueId);
    projection.router.push('/studio');
  };

  const workCards = (item: AccountLibraryItem): DisplayCard[] => item.references.localSetId
    ? displayCards.filter((card) => card.setId === item.references.localSetId).slice(0, 3)
    : [];

  return (
    <>
      <EnvironmentShell
        ariaLabel="CardForge Home desk"
        brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
        viewer={viewer}
        zones={zones.length ? zones : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'home' || zone.id === 'studio')}
        activeZone="home"
        viewportPolicy="desk"
        detail={detail}
        actions={actions}
        focusReturnId={inspectorItem ? `home-work-info-${inspectorItem.id}` : undefined}
        surfaceRef={surfaceRef}
        statusContent={<>
          <EnvironmentStatus label={projection.isLoading ? 'Refreshing workspace' : `${workItems.length} open work object${workItems.length === 1 ? '' : 's'}`} tone={projection.isLoading ? 'warning' : 'neutral'} />
          <EnvironmentStatus label={projection.failures.length ? `${projection.failures.length} source issue${projection.failures.length === 1 ? '' : 's'}` : 'Sources ready'} tone={projection.failures.length ? 'warning' : 'success'} />
        </>}
        footerContent={focusedItem ? <span>{focusedItem.name}</span> : isSignedIn ? <span>Private creator desk</span> : (
          <span className="flex items-center gap-3">
            <span>Local creator desk</span>
            <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
            <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-up', '/account')} prefetch={false} onClick={markSignUpIntent}>Create account</Link>
          </span>
        )}
        onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)}
        onCommand={() => focusedItem ? setFocusedWorkId(null) : searchRef.current?.focus()}
        onAction={runAction}
        onCloseDetail={() => setInspectorWorkId(null)}
      >
        {focusedItem ? (
          <div className={styles.focusSurface} data-home-desk="focused">
            <button type="button" className={styles.backButton} onClick={() => { setFocusedWorkId(null); setInspectorWorkId(null); }}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to desk
            </button>
            <header className={styles.focusHeader}>
              <div className={styles.focusIdentity}>
                {renaming && focusedLocalSetId ? (
                  <form className={styles.renameRow} onSubmit={(event) => { event.preventDefault(); commitRename(); }}>
                    <Input id="home-work-name" value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} aria-label="Work name" />
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                ) : <h1>{focusedItem.name}</h1>}
                <p>{focusedCards.length} card{focusedCards.length === 1 ? '' : 's'} · {workSourceLabel(focusedItem)}</p>
              </div>
              <div className={styles.focusActions}>
                {focusedLocalSetId ? <button type="button" className={styles.quietAction} onClick={() => setRenaming((current) => !current)}><Pencil size={15} aria-hidden="true" />Rename</button> : null}
                {focusedLocalSetId ? <button type="button" className={styles.quietAction} onClick={() => duplicateWork(focusedItem)}><Copy size={15} aria-hidden="true" />Duplicate</button> : null}
                <button type="button" className={styles.quietAction} onClick={() => togglePin(focusedItem.id)}><Pin size={15} aria-hidden="true" />{pinnedIds.includes(focusedItem.id) ? 'Unpin' : 'Pin'}</button>
                <button id={`home-work-info-${focusedItem.id}`} type="button" className={styles.quietAction} onClick={() => inspectItem(focusedItem)}><Info size={15} aria-hidden="true" />Details</button>
              </div>
            </header>

            {focusedLocalSetId ? <>
              <div className={styles.contentHeading}>
                <div>
                  <h2>Cards in this work</h2>
                  <p>Select cards to edit, move between Sets, or remove from this work.</p>
                </div>
                <span className="text-xs text-[var(--cf-text-subtle)]">{visibleCards.length} shown</span>
              </div>
              <div className={styles.contentToolbar}>
                <label className={styles.searchField}>
                  <span className="sr-only">Search cards in this work</span>
                  <Search aria-hidden="true" />
                  <Input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Search cards" />
                </label>
                {selectedCard ? <div className={styles.selectionBar}>
                  <span>{getCardTitle(selectedCard, 0)} selected</span>
                  {otherSets.length ? <Select value={effectiveMoveTargetId} onValueChange={setMoveTargetId}>
                    <SelectTrigger className={styles.moveSelect} aria-label="Move selected card to Set"><span className="truncate">Move to {otherSets.find((set) => set.id === effectiveMoveTargetId)?.name ?? 'Set'}</span></SelectTrigger>
                    <SelectContent>{otherSets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>)}</SelectContent>
                  </Select> : null}
                  {otherSets.length ? <Button type="button" size="sm" variant="outline" onClick={moveSelectedCard}>Move</Button> : null}
                  <Button type="button" size="sm" variant="outline" onClick={editSelectedCard}>Edit in Studio</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDeleteCard(selectedCard)}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button>
                </div> : null}
              </div>
              {visibleCards.length ? <div className={styles.cardGrid}>
                {visibleCards.slice(0, 24).map((card, index) => (
                  <button key={card.uniqueId} type="button" className={styles.cardButton} aria-pressed={selectedCardId === card.uniqueId} onClick={() => setSelectedCardId((current) => current === card.uniqueId ? null : card.uniqueId)}>
                    <CardPreview card={card} targetWidthPx={132} />
                    <strong>{getCardTitle(card, index)}</strong>
                    <span>{card.template.name}</span>
                  </button>
                ))}
              </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Boxes aria-hidden="true" /><strong>No cards here yet</strong><p className={styles.emptyCopy}>Open this work in Studio to add its first coordinated cards.</p><Button type="button" onClick={() => void projection.openItem(focusedItem)}>Add cards in Studio</Button></div></div>}
              {visibleCards.length > 24 ? <p className={styles.emptyCopy}>Showing the first 24 matching cards. Narrow the search or open Studio for the complete production view.</p> : null}
            </> : <div className={styles.remoteFocus}><div className={styles.remoteFocusInner}><WorkSourceIcon item={focusedItem} /><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">{focusedItem.name}</h2><p className={styles.emptyCopy}>This work stays owned by {workSourceLabel(focusedItem)}. Open it to load its exact contents into the normal CardForge workbench.</p><Button type="button" onClick={() => void projection.openItem(focusedItem)}>Open in Studio</Button></div></div>}
          </div>
        ) : (
          <div className={styles.desk} data-home-desk="overview">
            <EnvironmentSurfaceHeader eyebrow="Home" title="Your creative desk" body="Arrange the work you have open, then focus into one to organize its contents without losing your place." />
            {projection.failures.length ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${projection.failures[0]?.message ?? 'A source could not be reached.'} Available work remains unchanged.`} actionLabel="Retry" onAction={projection.refresh} /> : null}
            <div className={styles.deskToolbar}>
              <label className={styles.searchField}>
                <span className="sr-only">Search open work</span>
                <Search aria-hidden="true" />
                <Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your open work" />
              </label>
              <div className={styles.sourceFilters} aria-label="Filter open work by source">
                {sourceFilterOptions.map((option) => <button key={option.id} type="button" className={styles.filterButton} aria-pressed={sourceFilter === option.id} onClick={() => setSourceFilter(option.id)}>{option.label}</button>)}
              </div>
              <Select value={sort} onValueChange={(value) => setSort(value as HomeSort)}>
                <SelectTrigger aria-label="Arrange open work" className="w-[10.5rem]"><span>{sort === 'desk' ? 'Desk order' : sort === 'name' ? 'Name' : 'Largest first'}</span></SelectTrigger>
                <SelectContent><SelectItem value="desk">Desk order</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="size">Largest first</SelectItem></SelectContent>
              </Select>
            </div>
            <section className={styles.workSurface} aria-labelledby="home-open-work-heading">
              <header className={styles.workSurfaceHeader}>
                <div><h2 id="home-open-work-heading">Open work</h2><p>Everything here is one work container, wherever it is stored.</p></div>
                <span className="text-xs text-[var(--cf-text-subtle)]">{visibleWork.length} visible</span>
              </header>
              {projection.isLoading && !workItems.length ? <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing your desk</strong></div></div> : visibleWork.length ? <div className={styles.workGrid}>
                {visibleWork.map((item, index) => {
                  const cards = workCards(item);
                  const featured = index === 0;
                  return <article key={item.id} className={styles.workTile} data-featured={featured}>
                    <button id={`home-work-${item.id}`} type="button" className={styles.workTileMain} onClick={() => focusWork(item)} aria-label={`Focus ${item.name}`}>
                      <div className={styles.workVisual}>
                        {cards.length ? <div className={styles.previewStack}>{cards.map((card) => <CardPreview key={card.uniqueId} card={card} targetWidthPx={featured ? 150 : 112} />)}</div> : <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>{getAccountLibrarySourceLabel(workSource(item))}</span></div>}
                      </div>
                      <span className={styles.workMeta}><strong>{item.name}</strong><span>{item.details.join(' · ') || workSourceLabel(item)}</span><span>{workSourceLabel(item)}</span></span>
                    </button>
                    <div className={styles.tileActions}>
                      <button type="button" className={styles.iconButton} data-active={pinnedIds.includes(item.id)} onClick={() => togglePin(item.id)} aria-label={`${pinnedIds.includes(item.id) ? 'Unpin' : 'Pin'} ${item.name}`} title={pinnedIds.includes(item.id) ? 'Unpin from desk' : 'Pin to desk'}><Pin size={15} aria-hidden="true" /></button>
                      <button id={`home-work-info-${item.id}`} type="button" className={styles.iconButton} onClick={() => inspectItem(item)} aria-label={`Details for ${item.name}`} title="Details"><Info size={15} aria-hidden="true" /></button>
                    </div>
                  </article>;
                })}
              </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><FolderPlus aria-hidden="true" /><strong>{workItems.length ? 'No work matches this view' : 'Your desk is ready'}</strong><p className={styles.emptyCopy}>{workItems.length ? 'Clear the search or change the source filter.' : 'Create a Set here, or connect durable work from Library.'}</p>{workItems.length ? <Button type="button" variant="outline" onClick={() => { setQuery(''); setSourceFilter('all'); }}>Show all work</Button> : <Button type="button" onClick={createWork}>Create your first Set</Button>}</div></div>}
            </section>
            <div className={styles.utilityStrip} aria-label="Account essentials">
              {statuses.map((status) => {
                const Icon = statusIcons[status.label] ?? ShieldCheck;
                return <button key={status.label} type="button" className={styles.utilityButton} onClick={() => projection.router.push(status.href)} aria-label={`${status.label}: ${status.value}. ${status.action}`}><Icon className="h-4 w-4" aria-hidden="true" /><span className={styles.utilityText}><strong>{status.label}</strong><span>{status.value}</span></span></button>;
              })}
            </div>
          </div>
        )}
      </EnvironmentShell>

      <AlertDialog open={Boolean(pendingDeleteWork)} onOpenChange={(open) => { if (!open) setPendingDeleteWork(null); }}>
        <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
          <AlertDialogHeader><AlertDialogTitle>Delete this Set from this device?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">{pendingDeleteWork?.name} and its local cards will be removed from this browser workspace. Provider copies and shared Library content remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const localId = pendingDeleteWork?.references.localSetId; if (localId && deleteCardSet(localId)) { setFocusedWorkId(null); setInspectorWorkId(null); } setPendingDeleteWork(null); }}>Delete local Set</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingDeleteCard)} onOpenChange={(open) => { if (!open) setPendingDeleteCard(null); }}>
        <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
          <AlertDialogHeader><AlertDialogTitle>Remove this card from the Set?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">The rendered card and its data will be removed from this local Set. Its reusable Template remains available.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (pendingDeleteCard) removeGeneratedCard(pendingDeleteCard.uniqueId); setPendingDeleteCard(null); setSelectedCardId(null); }}>Remove card</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
