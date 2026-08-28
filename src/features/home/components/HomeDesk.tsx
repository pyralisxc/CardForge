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
  MoreHorizontal,
  Pencil,
  Pin,
  Printer,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import {
  ENVIRONMENT_ZONES,
  EnvironmentBoundaryNotice,
  EnvironmentShell,
  EnvironmentStatus,
  getVisibleEnvironmentZones,
  type ActionDescriptor,
  type EnvironmentViewer,
  type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { AuthoredObjectPreview, CardPreview } from '@/features/card-rendering/client';
import {
  readProjectPreference,
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  useProjectStore,
  writeProjectPreference,
  type ProjectPersistenceScope,
  type ProjectState,
} from '@/features/project/client';
import {
  useAccountLibraryProjection,
  WorkLocationDialog,
  type AccountLibraryItem,
} from '@/features/storage-management/client';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

import {
  getCardTitle,
  getWorkActions,
  HOME_PINS_KEY,
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
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);

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
  const addGeneratedCards = useProjectStore((state) => state.addGeneratedCards);
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
  const templates = useMemo(() => selectAllTemplates({ defaultTemplates, userTemplates } as ProjectState), [defaultTemplates, userTemplates]);
  const templateById = useMemo(() => new Map(templates.flatMap((template) => template.id ? [[template.id, template] as const] : [])), [templates]);
  const pinKey = `${HOME_PINS_KEY}:${persistenceScope}`;

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(pinKey).then((value) => {
      if (!cancelled && Array.isArray(value)) setPinnedIds(value.filter((entry): entry is string => typeof entry === 'string'));
    });
    return () => { cancelled = true; };
  }, [pinKey]);

  const workItems = useMemo(() => projection.items.filter((item) => (
    visibleWorkKinds.has(item.kind)
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
    setRenaming(false);
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
    setRenaming(false);
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
    else if (action.id === 'home.generate-work' && item?.references.localSetId) {
      setActiveCardSetId(item.references.localSetId);
      setActiveTab('generator');
      projection.router.push('/studio');
    } else if (action.id === 'home.export-work' && item?.references.localSetId) {
      setActiveCardSetId(item.references.localSetId);
      setActiveTab('sets');
      projection.router.push('/studio');
    } else if (action.id === 'home.save-move-work' && item) setLocationItem(item);
    else if (action.id === 'home.rename-work' && inspectorItem?.references.localSetId) {
      focusWork(inspectorItem);
      setRenaming(true);
      requestAnimationFrame(() => document.getElementById('home-work-name')?.focus());
    } else if (action.id === 'home.duplicate-work' && inspectorItem) duplicateWork(inspectorItem);
    else if (action.id === 'home.delete-work' && inspectorItem) setPendingDeleteWork(inspectorItem);
    else if (action.id === 'home.manage-location') projection.router.push('/account?section=storage');
  };

  const openWorkLane = (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => {
    if (!item.references.localSetId) {
      if (lane === 'open') void projection.openItem(item);
      else setLocationItem(item);
      return;
    }
    setActiveCardSetId(item.references.localSetId);
    setActiveTab(lane === 'generate' ? 'generator' : 'sets');
    projection.router.push('/studio');
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

  const duplicateSelectedCard = () => {
    if (!selectedCard || !focusedLocalSetId) return;
    setActiveCardSetId(focusedLocalSetId);
    addGeneratedCards([{ ...selectedCard, uniqueId: `card-${globalThis.crypto.randomUUID()}`, setId: focusedLocalSetId }]);
    toast({ title: 'Card duplicated', description: `${getCardTitle(selectedCard, 0)} now has an independent copy in this Set.` });
  };

  const exportSelectedCard = () => {
    if (!focusedLocalSetId) return;
    setActiveCardSetId(focusedLocalSetId);
    setActiveTab('sets');
    projection.router.push('/studio');
  };

  const workCards = (item: AccountLibraryItem): DisplayCard[] => item.references.localSetId
    ? displayCards.filter((card) => card.setId === item.references.localSetId || (!card.setId && cardSets[0]?.id === item.references.localSetId)).slice(0, 3)
    : [];
  const workTemplate = (item: AccountLibraryItem) => {
    if (!item.references.localSetId) return null;
    const set = cardSets.find((candidate) => candidate.id === item.references.localSetId);
    return set?.frontTemplateId ? templateById.get(set.frontTemplateId) ?? templates[0] ?? null : templates[0] ?? null;
  };

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
        <div className={styles.spatialPlane} data-home-desk-plane data-focused={Boolean(focusedItem)}>
          {focusedItem ? (
            <div className={styles.focusSurface} data-home-desk="focused">
              <button type="button" className={styles.backButton} onClick={() => { setRenaming(false); setFocusedWorkId(null); setInspectorWorkId(null); }}>
                <ArrowLeft size={16} aria-hidden="true" /> Pull back
              </button>
              <aside className={styles.focusOrbit} aria-label="Work surrounding the focused Set">
                {visibleWork.filter((item) => item.id !== focusedItem.id).slice(0, 5).map((item, index) => {
                  const cards = workCards(item);
                  return <button key={item.id} type="button" className={styles.nearbyObject} data-slot={index} onClick={() => focusWork(item)} aria-label={`Focus ${item.name}`}>
                    <span className={styles.nearbyVisual} data-home-set-stack>{item.references.localSetId ? <AuthoredObjectPreview cards={cards} template={workTemplate(item)} label={item.name} size="compact" /> : <WorkSourceIcon item={item} />}</span>
                    <span><strong>{item.name}</strong><small>{item.details[0] ?? workSourceLabel(item)}</small></span>
                  </button>;
                })}
              </aside>
              <section className={styles.focusWorkspace} data-home-set-board aria-label={focusedItem.name}>
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
                    <button type="button" className={styles.quietAction} onClick={() => openWorkLane(focusedItem, 'open')}><Pencil size={15} aria-hidden="true" />Open in Studio</button>
                    {focusedLocalSetId ? <button type="button" className={styles.quietAction} onClick={() => openWorkLane(focusedItem, 'generate')}><WandSparkles size={15} aria-hidden="true" />Generate</button> : null}
                    <button type="button" className={styles.quietAction} onClick={() => setLocationItem(focusedItem)}><Save size={15} aria-hidden="true" />Save &amp; move</button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><button type="button" className={styles.quietAction} aria-label={`More actions for ${focusedItem.name}`}><MoreHorizontal size={15} aria-hidden="true" />More</button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {focusedLocalSetId ? <DropdownMenuItem onSelect={() => setRenaming((current) => !current)}><Pencil aria-hidden="true" />Rename</DropdownMenuItem> : null}
                        {focusedLocalSetId ? <DropdownMenuItem onSelect={() => duplicateWork(focusedItem)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
                        {focusedLocalSetId ? <DropdownMenuItem onSelect={() => openWorkLane(focusedItem, 'export')}><Printer aria-hidden="true" />Export / print</DropdownMenuItem> : null}
                        <DropdownMenuItem onSelect={() => togglePin(focusedItem.id)}><Pin aria-hidden="true" />{pinnedIds.includes(focusedItem.id) ? 'Unpin from desk' : 'Pin to desk'}</DropdownMenuItem>
                        <DropdownMenuItem id={`home-work-info-${focusedItem.id}`} onSelect={() => inspectItem(focusedItem)}><Info aria-hidden="true" />Details</DropdownMenuItem>
                        {focusedLocalSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" disabled={cardSets.length <= 1} onSelect={() => setPendingDeleteWork(focusedItem)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </header>

                {focusedLocalSetId ? <>
                  <div className={styles.contentHeading}>
                    <div><h2>Inside this Set</h2><p>Select a card to edit, move, or remove it.</p></div>
                    <span className="text-xs text-[var(--cf-text-subtle)]">{visibleCards.length} shown</span>
                  </div>
                  <div className={styles.contentToolbar}>
                    <label className={styles.searchField}><span className="sr-only">Search cards in this work</span><Search aria-hidden="true" /><Input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Search cards" /></label>
                    {selectedCard ? <div className={styles.selectionBar}>
                      <span>{getCardTitle(selectedCard, 0)} selected</span>
                      {otherSets.length ? <Select value={effectiveMoveTargetId} onValueChange={setMoveTargetId}><SelectTrigger className={styles.moveSelect} aria-label="Move selected card to Set"><span className="truncate">Move to {otherSets.find((set) => set.id === effectiveMoveTargetId)?.name ?? 'Set'}</span></SelectTrigger><SelectContent>{otherSets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>)}</SelectContent></Select> : null}
                      {otherSets.length ? <Button type="button" size="sm" variant="outline" onClick={moveSelectedCard}>Move</Button> : null}
                      <Button type="button" size="sm" variant="outline" onClick={editSelectedCard}>Edit in Studio</Button>
                      <Button type="button" size="sm" variant="outline" onClick={duplicateSelectedCard}><Copy className="mr-1.5 h-4 w-4" />Duplicate</Button>
                      <Button type="button" size="sm" variant="outline" onClick={exportSelectedCard}><Printer className="mr-1.5 h-4 w-4" />Export / print</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDeleteCard(selectedCard)}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button>
                    </div> : null}
                  </div>
                  <div className={styles.contentStage} aria-label={`${focusedItem.name} contents`}>
                    {visibleCards.length ? <div className={styles.cardGrid}>{visibleCards.slice(0, 24).map((card, index) => (
                      <button key={card.uniqueId} type="button" className={styles.cardButton} aria-pressed={selectedCardId === card.uniqueId} onClick={() => setSelectedCardId((current) => current === card.uniqueId ? null : card.uniqueId)}>
                        <CardPreview card={card} targetWidthPx={132} /><strong>{getCardTitle(card, index)}</strong><span>{card.template.name}</span>
                      </button>
                    ))}</div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Boxes aria-hidden="true" /><strong>This Set is ready for its first card</strong><p className={styles.emptyCopy}>Open Studio and the new card will return to this exact work surface.</p><Button type="button" onClick={() => void projection.openItem(focusedItem)}>Add cards in Studio</Button></div></div>}
                  </div>
                  {visibleCards.length > 24 ? <p className={styles.emptyCopy}>Showing the first 24 matching cards. Narrow the search or open Studio for the complete production view.</p> : null}
                </> : <div className={styles.remoteFocus}><div className={styles.remoteFocusInner}><WorkSourceIcon item={focusedItem} /><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">{focusedItem.name}</h2><p className={styles.emptyCopy}>This work stays owned by {workSourceLabel(focusedItem)}. Open it to load its exact contents into the CardForge workbench.</p><Button type="button" onClick={() => void projection.openItem(focusedItem)}>Open in Studio</Button></div></div>}
              </section>
            </div>
          ) : (
            <div className={styles.desk} data-home-desk="overview">
              <header className={styles.deskIntro}>
                <div><p>Home</p><h1>Your creative desk</h1><span>Your open Sets stay arranged here. Choose one to move closer.</span></div>
                <strong>{visibleWork.length} open</strong>
              </header>
              {projection.failures.length ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${projection.failures[0]?.message ?? 'A source could not be reached.'} Available work remains unchanged.`} actionLabel="Retry" onAction={projection.refresh} /> : null}
              <section className={styles.workSurface} aria-labelledby="home-open-work-heading">
                <div className={styles.workSurfaceHeader}><h2 id="home-open-work-heading">Open work</h2><span>Each pile is one Set</span></div>
                <div className={styles.deskToolbar}>
                  <label className={styles.searchField}><span className="sr-only">Search open work</span><Search aria-hidden="true" /><Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find work" /></label>
                  <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as HomeSourceFilter)}><SelectTrigger aria-label="Filter open work by source" className={styles.sourceSelect}><span>{sourceFilterOptions.find((option) => option.id === sourceFilter)?.label ?? 'All work'}</span></SelectTrigger><SelectContent>{sourceFilterOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select>
                  <Select value={sort} onValueChange={(value) => setSort(value as HomeSort)}><SelectTrigger aria-label="Arrange open work" className={styles.arrangeSelect}><span>{sort === 'desk' ? 'Desk order' : sort === 'name' ? 'Name' : 'Largest first'}</span></SelectTrigger><SelectContent><SelectItem value="desk">Desk order</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="size">Largest first</SelectItem></SelectContent></Select>
                </div>
                {projection.isLoading && !workItems.length ? <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing your desk</strong></div></div> : visibleWork.length ? <div className={styles.workGrid}>
                  {visibleWork.map((item, index) => {
                    const cards = workCards(item);
                    const featured = index === 0;
                    return <article key={item.id} className={styles.workTile} data-home-work-object data-featured={featured} data-slot={index % 6} data-active={item.id === activeWorkId} data-pinned={pinnedIds.includes(item.id)}>
                      <button id={`home-work-${item.id}`} type="button" className={styles.workTileMain} onClick={() => focusWork(item)} aria-label={`Focus ${item.name}`}>
                        <div className={styles.workVisual} data-home-set-stack>{item.references.localSetId ? <AuthoredObjectPreview cards={cards} template={workTemplate(item)} label={item.name} size={featured ? 'large' : 'standard'} /> : <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>Preview after opening</span></div>}</div>
                        <span className={styles.workMeta}><strong>{item.name}</strong><span>{item.details.join(' · ') || workSourceLabel(item)}</span><span>{workSourceLabel(item)}</span></span>
                      </button>
                      <div className={styles.tileActions}>
                        <button type="button" className={styles.iconButton} data-active={pinnedIds.includes(item.id)} onClick={() => togglePin(item.id)} aria-label={`${pinnedIds.includes(item.id) ? 'Unpin' : 'Pin'} ${item.name}`} title={pinnedIds.includes(item.id) ? 'Unpin from desk' : 'Pin to desk'}><Pin size={15} aria-hidden="true" /></button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button id={`home-work-info-${item.id}`} type="button" className={styles.iconButton} aria-label={`Actions for ${item.name}`} title="Actions"><MoreHorizontal size={15} aria-hidden="true" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openWorkLane(item, 'open')}><Pencil aria-hidden="true" />Open in Studio</DropdownMenuItem>
                            {item.references.localSetId ? <DropdownMenuItem onSelect={() => openWorkLane(item, 'generate')}><WandSparkles aria-hidden="true" />Generate cards</DropdownMenuItem> : null}
                            <DropdownMenuItem onSelect={() => setLocationItem(item)}><Save aria-hidden="true" />Save / move</DropdownMenuItem>
                            {item.references.localSetId ? <DropdownMenuItem onSelect={() => duplicateWork(item)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
                            {item.references.localSetId ? <DropdownMenuItem onSelect={() => openWorkLane(item, 'export')}><Printer aria-hidden="true" />Export / print</DropdownMenuItem> : null}
                            <DropdownMenuItem onSelect={() => inspectItem(item)}><Info aria-hidden="true" />Details</DropdownMenuItem>
                            {item.references.localSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" disabled={cardSets.length <= 1} onSelect={() => setPendingDeleteWork(item)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </article>;
                  })}
                </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><FolderPlus aria-hidden="true" /><strong>{workItems.length ? 'No work matches this view' : 'Your desk is ready'}</strong><p className={styles.emptyCopy}>{workItems.length ? 'Clear the search or change the source filter.' : 'Create a Set here, or connect durable work from Library.'}</p>{workItems.length ? <Button type="button" variant="outline" onClick={() => { setQuery(''); setSourceFilter('all'); }}>Show all work</Button> : <Button type="button" onClick={createWork}>Create your first Set</Button>}</div></div>}
              </section>
              <div className={styles.utilityStrip} aria-label="Account essentials">{statuses.map((status) => { const Icon = statusIcons[status.label] ?? ShieldCheck; return <button key={status.label} type="button" className={styles.utilityButton} onClick={() => projection.router.push(status.href)} aria-label={`${status.label}: ${status.value}. ${status.action}`}><Icon className="h-4 w-4" aria-hidden="true" /><span className={styles.utilityText}><strong>{status.label}</strong><span>{status.value}</span></span></button>; })}</div>
            </div>
          )}
        </div>
      </EnvironmentShell>

      <WorkLocationDialog
        item={locationItem}
        open={Boolean(locationItem)}
        onOpenChange={(open) => { if (!open) setLocationItem(null); }}
        isSignedIn={isSignedIn}
        driveConnected={projection.driveConnection?.connected ?? false}
        localFolderSupported={projection.localFolderSupported}
        onChanged={projection.refresh}
      />

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
