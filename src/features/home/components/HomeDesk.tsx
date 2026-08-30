"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  Cloud,
  Copy,
  CreditCard,
  FileArchive,
  FolderPlus,
  HardDrive,
  Info,
  Layers3,
  LayoutGrid,
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
  Tag,
  Trash2,
  UploadCloud,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import type { CardSetOrganization } from '@/domain/cards';
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
import { createDeskReturnHref, createStudioHref } from '@/features/app-shell/client/navigation';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { PublicAuthControls } from '@/features/account/client/auth';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { AuthoredObjectPreview, CardPreview } from '@/features/card-rendering/client';
import {
  readProjectPreference,
  createPublishedSetCopy,
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  useProjectStore,
  writeProjectPreference,
  type ProjectPersistenceScope,
  type ProjectState,
} from '@/features/project/client';
import type { CardForgeCatalogManifest } from '@/features/pipeline/client';
import {
  useAccountLibraryProjection,
  WorkLocationDialog,
  type AccountLibraryItem,
} from '@/features/storage-management/client';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

import {
  getCardTitle,
  getWorkActions,
  HOME_ORDER_KEY,
  HOME_PINS_KEY,
  matchesSourceFilter,
  normalizeDeskOrder,
  reorderDeskItem,
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

const CampaignDeskShelf = dynamic(() => import(
  '@/features/marketing-content/client'
).then((module) => module.CampaignDeskShelf));

export interface HomeAccountStatus {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
}

export interface HomeDeskProps {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialFocusedWorkId?: string | null;
  homeAccessStatus?: HomeAccountStatus;
  homeSecurityStatus?: HomeAccountStatus;
}

const statusIcons: Record<string, ComponentType<{ className?: string }>> = {
  Access: CreditCard,
  Storage: HardDrive,
  Connections: Link2,
  Security: ShieldCheck,
};

const DEFAULT_FOCUSED_ORGANIZATION: CardSetOrganization = {
  arrangement: 'grid', groupBy: 'none', sort: 'manual', tags: [], positions: {},
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
  experience,
  initialFocusedWorkId,
  homeAccessStatus,
  homeSecurityStatus,
}: HomeDeskProps) {
  const { toast } = useToast();
  const isSignedIn = experience.signedIn;
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const cardStageRef = useRef<HTMLDivElement | null>(null);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: experience.contributor.active, owner: experience.owner };
  const zones = getVisibleEnvironmentZones(viewer);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<HomeSourceFilter>('all');
  const [sort, setSort] = useState<HomeSort>('desk');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [deskOrderIds, setDeskOrderIds] = useState<string[]>([]);
  const [focusedWorkId, setFocusedWorkId] = useState<string | null>(initialFocusedWorkId ?? null);
  const [inspectorWorkId, setInspectorWorkId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardQuery, setCardQuery] = useState('');
  const [moveTargetId, setMoveTargetId] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [pendingDeleteWork, setPendingDeleteWork] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteCards, setPendingDeleteCards] = useState<DisplayCard[]>([]);
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [publishedSets, setPublishedSets] = useState<CardForgeCatalogManifest['sets']['items']>([]);
  const [publishedSetsLoading, setPublishedSetsLoading] = useState(false);
  const [publishedSetsFailure, setPublishedSetsFailure] = useState<string | null>(null);
  const [creatingPublishedSetId, setCreatingPublishedSetId] = useState<string | null>(null);

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
  const moveGeneratedCardsToSet = useProjectStore((state) => state.moveGeneratedCardsToSet);
  const reorderGeneratedCard = useProjectStore((state) => state.reorderGeneratedCard);
  const addGeneratedCards = useProjectStore((state) => state.addGeneratedCards);
  const removeGeneratedCards = useProjectStore((state) => state.removeGeneratedCards);
  const openEditDialog = useProjectStore((state) => state.openEditDialog);
  const setStudioView = useProjectStore((state) => state.setStudioView);
  const updateCardSetOrganization = useProjectStore((state) => state.updateCardSetOrganization);
  const addCardSetTag = useProjectStore((state) => state.addCardSetTag);
  const setCardsTag = useProjectStore((state) => state.setCardsTag);
  const setCardPositions = useProjectStore((state) => state.setCardPositions);
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
  const orderKey = `${HOME_ORDER_KEY}:${persistenceScope}`;

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(pinKey).then((value) => {
      if (!cancelled && Array.isArray(value)) setPinnedIds(value.filter((entry): entry is string => typeof entry === 'string'));
    });
    return () => { cancelled = true; };
  }, [pinKey]);

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(orderKey).then((value) => {
      if (!cancelled && Array.isArray(value)) setDeskOrderIds(value.filter((entry): entry is string => typeof entry === 'string'));
    });
    return () => { cancelled = true; };
  }, [orderKey]);

  const workItems = useMemo(() => projection.items.filter((item) => (
    visibleWorkKinds.has(item.kind)
  )), [projection.items]);
  const itemById = useMemo(() => new Map(workItems.map((item) => [item.id, item])), [workItems]);
  const normalizedDeskOrder = useMemo(() => normalizeDeskOrder(workItems.map((item) => item.id), deskOrderIds), [deskOrderIds, workItems]);
  useEffect(() => {
    if (normalizedDeskOrder.join('\u0000') === deskOrderIds.join('\u0000')) return;
    setDeskOrderIds(normalizedDeskOrder);
    void writeProjectPreference(orderKey, normalizedDeskOrder);
  }, [deskOrderIds, normalizedDeskOrder, orderKey]);
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
      const leftIndex = normalizedDeskOrder.indexOf(left.id);
      const rightIndex = normalizedDeskOrder.indexOf(right.id);
      return leftIndex - rightIndex;
    });
  }, [normalizedDeskOrder, query, sort, sourceFilter, workItems]);
  const focusedItem = focusedWorkId ? itemById.get(focusedWorkId) ?? null : null;
  const inspectorItem = inspectorWorkId ? itemById.get(inspectorWorkId) ?? null : null;
  const focusedLocalSetId = focusedItem?.references.localSetId ?? null;
  const focusedSet = focusedLocalSetId ? cardSets.find((set) => set.id === focusedLocalSetId) ?? null : null;
  const organization = focusedSet?.organization ?? DEFAULT_FOCUSED_ORGANIZATION;
  const focusedCards = focusedLocalSetId
    ? displayCards.filter((card) => card.setId === focusedLocalSetId || (!card.setId && cardSets[0]?.id === focusedLocalSetId))
    : [];
  const focusedContentsLabel = focusedLocalSetId
    ? `${focusedCards.length} card${focusedCards.length === 1 ? '' : 's'}`
    : 'Contents load when opened';
  const normalizedCardQuery = cardQuery.trim().toLocaleLowerCase();
  const availableFields = [...new Set(focusedCards.flatMap((card) => Object.keys(card.data)
    .filter((key) => card.data[key] !== undefined && String(card.data[key]).trim())))].toSorted();
  const visibleCards = focusedCards.filter((card, index) => (!normalizedCardQuery || [getCardTitle(card, index), card.template.name, ...Object.values(card.data), ...organization.tags.filter((tag) => card.tagIds?.includes(tag.id)).map((tag) => tag.label)]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedCardQuery)) && (tagFilter === 'all' || card.tagIds?.includes(tagFilter)));
  const sortedCards = [...visibleCards].sort((left, right) => {
    if (organization.sort === 'name') return getCardTitle(left, focusedCards.indexOf(left)).localeCompare(getCardTitle(right, focusedCards.indexOf(right)));
    if (organization.sort === 'field-value' && organization.sortField) return String(left.data[organization.sortField] ?? '').localeCompare(String(right.data[organization.sortField] ?? ''), undefined, { numeric: true });
    if (organization.sort === 'recently-changed') return (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0);
    return focusedCards.indexOf(left) - focusedCards.indexOf(right);
  });
  const organizedGroups = (() => {
    const groups = new Map<string, DisplayCard[]>();
    const labelFor = (card: DisplayCard): string => {
      if (organization.groupBy === 'tag') return organization.tags.find((tag) => card.tagIds?.includes(tag.id))?.label ?? 'Untagged';
      if (organization.groupBy === 'field' && organization.groupField) return String(card.data[organization.groupField] ?? 'No value');
      if (organization.groupBy === 'template') return card.template.name;
      if (organization.groupBy === 'content-type') return String(card.data.contentType ?? card.data.type ?? card.data.kind ?? card.template.name);
      if (organization.groupBy === 'batch') return String(card.data.batch ?? card.data.batchName ?? 'No batch');
      return 'All cards';
    };
    sortedCards.forEach((card) => { const label = labelFor(card); groups.set(label, [...(groups.get(label) ?? []), card]); });
    return [...groups.entries()];
  })();
  const selectedCards = focusedCards.filter((card) => selectedCardIds.includes(card.uniqueId));
  const selectedCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const selectedCardIndex = selectedCard
    ? focusedCards.findIndex((card) => card.uniqueId === selectedCard.uniqueId)
    : -1;
  const allVisibleCardsSelected = visibleCards.length > 0
    && visibleCards.every((card) => selectedCardIds.includes(card.uniqueId));
  const otherSets = focusedLocalSetId ? cardSets.filter((set) => set.id !== focusedLocalSetId) : [];
  const effectiveMoveTargetId = otherSets.some((set) => set.id === moveTargetId)
    ? moveTargetId
    : otherSets[0]?.id ?? '';
  const focusedItemId = focusedItem?.id ?? null;
  const focusedItemName = focusedItem?.name ?? '';

  useEffect(() => {
    if (!focusedItemId) return;
    setRenameDraft(focusedItemName);
    setSelectedCardIds([]);
    setCardQuery('');
    setTagFilter('all');
  }, [focusedItemId, focusedItemName]);

  const applyNewTag = () => {
    if (!focusedLocalSetId || !selectedCards.length) return;
    const tagId = addCardSetTag(focusedLocalSetId, tagDraft);
    if (!tagId) return;
    setCardsTag(selectedCards.map((card) => card.uniqueId), tagId, true);
    setTagDraft('');
  };

  const updateOrganization = (patch: Partial<Omit<CardSetOrganization, 'tags' | 'positions'>>) => {
    if (focusedLocalSetId) updateCardSetOrganization(focusedLocalSetId, patch);
  };

  const placeCard = (card: DisplayCard, clientX: number, clientY: number) => {
    if (!focusedLocalSetId || organization.arrangement !== 'manual') return;
    const stage = cardStageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    setCardPositions(focusedLocalSetId, {
      [card.uniqueId]: {
        x: Math.max(0, Math.min(bounds.width - 150, clientX - bounds.left - 66)),
        y: Math.max(0, Math.min(Math.max(bounds.height, 460) - 210, clientY - bounds.top - 90)),
      },
    });
  };

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
      value: !isSignedIn ? 'Sign in to connect' : projection.loadingSources ? 'Checking' : projection.driveConnection?.connected ? 'Drive connected' : 'Not connected',
      detail: `${projection.sourceCounts.get('google-drive') ?? 0} connected work item${(projection.sourceCounts.get('google-drive') ?? 0) === 1 ? '' : 's'}`,
      href: '/account?section=storage',
      action: 'Manage',
    },
    ...(homeSecurityStatus ? [homeSecurityStatus] : []),
  ];

  const togglePin = (itemId: string) => {
    const wasPinned = pinnedIds.includes(itemId);
    setPinnedIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current];
      void writeProjectPreference(pinKey, next);
      return next;
    });
    if (!wasPinned) {
      setDeskOrderIds((current) => {
        const normalized = normalizeDeskOrder(workItems.map((item) => item.id), current);
        const next = normalized.includes(itemId) ? reorderDeskItem(normalized, itemId, normalized[0]!) : normalized;
        void writeProjectPreference(orderKey, next);
        return next;
      });
    }
  };

  const moveDeskWork = (itemId: string, direction: 'earlier' | 'later') => {
    setSort('desk');
    setDeskOrderIds((current) => {
      const next = reorderDeskItem(normalizeDeskOrder(workItems.map((item) => item.id), current), itemId, direction);
      void writeProjectPreference(orderKey, next);
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
    setCreateOpen(false);
    setFocusedWorkId(`set:${id}`);
    setRenaming(true);
    requestAnimationFrame(() => document.getElementById('home-work-name')?.focus());
  };

  const openCreateMenu = () => {
    setCreateOpen(true);
    if (publishedSets.length || publishedSetsLoading) return;
    setPublishedSetsLoading(true);
    setPublishedSetsFailure(null);
    void fetch('/api/catalog', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Published Set starters are unavailable right now.');
        return response.json() as Promise<CardForgeCatalogManifest>;
      })
      .then((catalog) => setPublishedSets(catalog.sets?.items ?? []))
      .catch((error: unknown) => setPublishedSetsFailure(error instanceof Error ? error.message : 'Published Set starters are unavailable right now.'))
      .finally(() => setPublishedSetsLoading(false));
  };

  const createFromPublishedSet = async (set: CardForgeCatalogManifest['sets']['items'][number]) => {
    setCreatingPublishedSetId(set.id);
    try {
      const result = await createPublishedSetCopy({ packageUrl: set.packageUrl, expectedName: set.name });
      setFocusedWorkId(`set:${result.setId}`);
      setInspectorWorkId(null);
      setCreateOpen(false);
      projection.refresh();
      toast({ title: 'Set created', description: `${result.setName} is independent browser work with ${result.cardCount} card${result.cardCount === 1 ? '' : 's'}.` });
    } catch (error) {
      toast({ title: 'Set was not created', description: error instanceof Error ? error.message : 'The published Set package is unavailable.', variant: 'destructive' });
    } finally {
      setCreatingPublishedSetId(null);
    }
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
    ? getWorkActions(inspectorItem, pinnedIds.includes(inspectorItem.id), cardSets.length > 1, experience.contributor.canSubmit, experience.capabilities.canUseProjectFiles)
    : focusedItem ? [] : [zoneAction('home.create-work', 'New Set', 'mutation')];
  const detail = inspectorItem ? workDetailRecord(inspectorItem) : null;

  const runAction = (action: ActionDescriptor) => {
    const item = inspectorItem ?? focusedItem;
    if (action.id === 'home.create-work') openCreateMenu();
    else if (action.id === 'home.open-work' && item) void projection.openItem(item, createDeskReturnHref(item.id));
    else if (action.id === 'home.pin-work' && inspectorItem) togglePin(inspectorItem.id);
    else if (action.id === 'home.generate-work' && item?.references.localSetId) {
      setActiveCardSetId(item.references.localSetId);
      setStudioView('generate');
      projection.router.push(createStudioHref({ returnTo: createDeskReturnHref(item.id) }));
    } else if (action.id === 'home.export-work' && item?.references.localSetId) {
      setActiveCardSetId(item.references.localSetId);
      setStudioView('generate');
      projection.router.push(createStudioHref({ returnTo: createDeskReturnHref(item.id), tool: 'output' }));
    } else if (action.id === 'home.save-move-work' && item) setLocationItem(item);
    else if (action.id === 'home.send-pipeline' && item?.references.localSetId) projection.router.push(`/account?section=library&scope=pipeline&tool=contribute&submitSet=${encodeURIComponent(item.references.localSetId)}`);
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
      if (lane === 'open') void projection.openItem(item, createDeskReturnHref(item.id));
      else setLocationItem(item);
      return;
    }
    setActiveCardSetId(item.references.localSetId);
    setStudioView('generate');
    projection.router.push(createStudioHref({
      returnTo: createDeskReturnHref(item.id),
      tool: lane === 'export' ? 'output' : null,
    }));
  };

  const moveSelectedCards = () => {
    if (!selectedCards.length || !effectiveMoveTargetId) return;
    const movedCount = moveGeneratedCardsToSet(selectedCards.map((card) => card.uniqueId), effectiveMoveTargetId);
    if (!movedCount) return;
    const destination = cardSets.find((set) => set.id === effectiveMoveTargetId);
    toast({ title: `${movedCount} card${movedCount === 1 ? '' : 's'} moved`, description: `The selection now belongs to ${destination?.name ?? 'the selected Set'}.` });
    setSelectedCardIds([]);
  };

  const editSelectedCard = () => {
    if (!selectedCard || !focusedLocalSetId) return;
    setActiveCardSetId(focusedLocalSetId);
    setStudioView('generate');
    openEditDialog(selectedCard.uniqueId);
    projection.router.push(createStudioHref({ returnTo: createDeskReturnHref(`set:${focusedLocalSetId}`) }));
  };

  const duplicateSelectedCards = () => {
    if (!selectedCards.length || !focusedLocalSetId) return;
    setActiveCardSetId(focusedLocalSetId);
    addGeneratedCards(selectedCards.map((card) => ({ ...card, uniqueId: `card-${globalThis.crypto.randomUUID()}`, setId: focusedLocalSetId })));
    toast({ title: `${selectedCards.length} card${selectedCards.length === 1 ? '' : 's'} duplicated`, description: 'Each copy is independently editable in this Set.' });
  };

  const reorderSelectedCard = (direction: 'earlier' | 'later') => {
    if (!selectedCard) return;
    reorderGeneratedCard(selectedCard.uniqueId, direction);
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
        ariaLabel="CardForge Desk"
        brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
        viewer={viewer}
        zones={zones.length ? zones : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'home' || zone.id === 'library' || zone.id === 'profile')}
        activeZone="home"
        viewportPolicy="desk"
        detail={detail}
        actions={actions}
        accountControl={<PublicAuthControls />}
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
              <button type="button" className={styles.backButton} onClick={() => { setRenaming(false); setFocusedWorkId(null); setInspectorWorkId(null); projection.router.replace('/account'); }}>
                <ArrowLeft size={16} aria-hidden="true" /> Back to Desk
              </button>
              <aside className={styles.focusOrbit} aria-label="Work surrounding the focused Set">
                {visibleWork.filter((item) => item.id !== focusedItem.id).slice(0, 5).map((item, index) => {
                  const cards = workCards(item);
                  return <button key={item.id} type="button" className={styles.nearbyObject} data-slot={index} onClick={() => focusWork(item)} aria-label={`Focus ${item.name}`}>
                    <span className={styles.nearbyVisual} data-home-set-stack>{item.references.localSetId ? <AuthoredObjectPreview cards={cards} template={workTemplate(item)} label={item.name} size="compact" emptyLabel={cards.length ? undefined : 'Empty Set'} /> : <WorkSourceIcon item={item} />}</span>
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
                    <p>{focusedContentsLabel} · {workSourceLabel(focusedItem)}</p>
                  </div>
                  <div className={styles.focusActions}>
                    <button type="button" className={styles.quietAction} onClick={() => openWorkLane(focusedItem, 'open')}><Pencil size={15} aria-hidden="true" />Edit in Studio</button>
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
                    <div><h2>Inside this Set</h2><p>Select one or more cards to arrange, move, duplicate, or remove them.</p></div>
                    <span className="text-xs text-[var(--cf-text-subtle)]">{visibleCards.length} shown</span>
                  </div>
                  <div className={styles.contentToolbar}>
                    <label className={styles.searchField}><span className="sr-only">Search cards in this work</span><Search aria-hidden="true" /><Input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Search cards" /></label>
                    <div className={styles.organizationToolbar} aria-label="Set organization">
                      <Select value={organization.arrangement} onValueChange={(value) => updateOrganization({ arrangement: value as CardSetOrganization['arrangement'] })}><SelectTrigger aria-label="Arrange cards" className={styles.compactSelect}><LayoutGrid aria-hidden="true" /><span>{organization.arrangement === 'manual' ? 'Freeform' : organization.arrangement === 'stack' ? 'Stacks' : 'Grid'}</span></SelectTrigger><SelectContent><SelectItem value="manual">Freeform</SelectItem><SelectItem value="grid">Grid</SelectItem><SelectItem value="stack">Stacks</SelectItem></SelectContent></Select>
                      <Select value={organization.groupBy} onValueChange={(value) => updateOrganization({ groupBy: value as CardSetOrganization['groupBy'], groupField: value === 'field' ? organization.groupField ?? availableFields[0] : undefined })}><SelectTrigger aria-label="Group cards" className={styles.compactSelect}><Layers3 aria-hidden="true" /><span>{organization.groupBy === 'none' ? 'No groups' : `By ${organization.groupBy}`}</span></SelectTrigger><SelectContent><SelectItem value="none">No groups</SelectItem><SelectItem value="tag">By tag</SelectItem>{availableFields.length ? <SelectItem value="field">By field</SelectItem> : null}<SelectItem value="template">By Template</SelectItem><SelectItem value="content-type">By content type</SelectItem><SelectItem value="batch">By batch</SelectItem></SelectContent></Select>
                      {organization.groupBy === 'field' && availableFields.length ? <Select value={organization.groupField ?? availableFields[0]} onValueChange={(groupField) => updateOrganization({ groupField })}><SelectTrigger aria-label="Field used for groups" className={styles.compactSelect}><span>{organization.groupField ?? availableFields[0]}</span></SelectTrigger><SelectContent>{availableFields.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select> : null}
                      <Select value={organization.sort} onValueChange={(value) => updateOrganization({ sort: value as CardSetOrganization['sort'], sortField: value === 'field-value' ? organization.sortField ?? availableFields[0] : undefined })}><SelectTrigger aria-label="Sort cards" className={styles.compactSelect}><span>{organization.sort === 'manual' ? 'Manual order' : organization.sort === 'field-value' ? 'Field value' : organization.sort === 'recently-changed' ? 'Recent' : 'Name'}</span></SelectTrigger><SelectContent><SelectItem value="manual">Manual order</SelectItem><SelectItem value="name">Name</SelectItem>{availableFields.length ? <SelectItem value="field-value">Field value</SelectItem> : null}<SelectItem value="recently-changed">Recently changed</SelectItem></SelectContent></Select>
                      {organization.sort === 'field-value' && availableFields.length ? <Select value={organization.sortField ?? availableFields[0]} onValueChange={(sortField) => updateOrganization({ sortField })}><SelectTrigger aria-label="Field used for sorting" className={styles.compactSelect}><span>{organization.sortField ?? availableFields[0]}</span></SelectTrigger><SelectContent>{availableFields.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select> : null}
                      {organization.tags.length ? <Select value={tagFilter} onValueChange={setTagFilter}><SelectTrigger aria-label="Filter cards by tag" className={styles.compactSelect}><Tag aria-hidden="true" /><span>{tagFilter === 'all' ? 'All tags' : organization.tags.find((tag) => tag.id === tagFilter)?.label}</span></SelectTrigger><SelectContent><SelectItem value="all">All tags</SelectItem>{organization.tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.label}</SelectItem>)}</SelectContent></Select> : null}
                    </div>
                    {visibleCards.length ? <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedCardIds((current) => allVisibleCardsSelected
                      ? current.filter((id) => !visibleCards.some((card) => card.uniqueId === id))
                      : [...new Set([...current, ...visibleCards.map((card) => card.uniqueId)])]
                    )}>{allVisibleCardsSelected ? 'Clear shown' : 'Select shown'}</Button> : null}
                    {selectedCards.length ? <div className={styles.selectionBar}>
                      <span>{selectedCards.length === 1 ? `${getCardTitle(selectedCards[0]!, 0)} selected` : `${selectedCards.length} cards selected`}</span>
                      {selectedCard ? <><Button type="button" size="icon" variant="outline" disabled={selectedCardIndex <= 0} onClick={() => reorderSelectedCard('earlier')} aria-label="Move selected card earlier"><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="outline" disabled={selectedCardIndex < 0 || selectedCardIndex >= focusedCards.length - 1} onClick={() => reorderSelectedCard('later')} aria-label="Move selected card later"><ArrowDown className="h-4 w-4" /></Button></> : null}
                      {otherSets.length ? <Select value={effectiveMoveTargetId} onValueChange={setMoveTargetId}><SelectTrigger className={styles.moveSelect} aria-label="Move selected card to Set"><span className="truncate">Move to {otherSets.find((set) => set.id === effectiveMoveTargetId)?.name ?? 'Set'}</span></SelectTrigger><SelectContent>{otherSets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>)}</SelectContent></Select> : null}
                      {otherSets.length ? <Button type="button" size="sm" variant="outline" onClick={moveSelectedCards}>Move</Button> : null}
                      {selectedCard ? <Button type="button" size="sm" variant="outline" onClick={editSelectedCard}>Edit in Studio</Button> : null}
                      <Button type="button" size="sm" variant="outline" onClick={duplicateSelectedCards}><Copy className="mr-1.5 h-4 w-4" />Duplicate</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDeleteCards(selectedCards)}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button>
                      <div className={styles.tagTools}>
                        {organization.tags.length ? <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline"><Tag className="mr-1.5 h-4 w-4" />Tags</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{organization.tags.map((tag) => {
                          const applied = selectedCards.every((card) => card.tagIds?.includes(tag.id));
                          return <DropdownMenuItem key={tag.id} onSelect={() => setCardsTag(selectedCards.map((card) => card.uniqueId), tag.id, !applied)}>{applied ? 'Remove' : 'Add'} {tag.label}</DropdownMenuItem>;
                        })}</DropdownMenuContent></DropdownMenu> : null}
                        <Input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="New tag" aria-label="New tag name" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyNewTag(); } }} />
                        <Button type="button" size="sm" variant="outline" disabled={!tagDraft.trim()} onClick={applyNewTag}>Add tag</Button>
                      </div>
                    </div> : null}
                  </div>
                  <div ref={cardStageRef} className={styles.contentStage} data-home-card-stage data-arrangement={organization.arrangement} aria-label={`${focusedItem.name} contents`}>
                    {sortedCards.length ? <div className={styles.groupPlane} data-arrangement={organization.arrangement} data-grouped={organization.groupBy !== 'none'}>{organizedGroups.map(([groupLabel, cards]) => <section key={groupLabel} className={styles.cardGroup} aria-label={groupLabel}>
                      {organization.groupBy !== 'none' ? <header><strong>{groupLabel}</strong><span>{cards.length}</span></header> : null}
                      <div className={styles.cardGrid} data-arrangement={organization.arrangement}>{cards.slice(0, 24).map((card) => {
                        const index = focusedCards.indexOf(card);
                        const position = organization.positions[card.uniqueId] ?? { x: (index % 5) * 148, y: Math.floor(index / 5) * 205 };
                        return <button key={card.uniqueId} type="button" draggable={organization.arrangement === 'manual'} className={styles.cardButton} style={organization.arrangement === 'manual' && position ? { left: position.x, top: position.y } : undefined} aria-pressed={selectedCardIds.includes(card.uniqueId)} onDragEnd={(event) => placeCard(card, event.clientX, event.clientY)} onClick={() => setSelectedCardIds((current) => current.includes(card.uniqueId) ? current.filter((id) => id !== card.uniqueId) : [...current, card.uniqueId])}>
                          <CardPreview card={card} targetWidthPx={132} /><strong>{getCardTitle(card, index)}</strong><span>{card.template.name}</span>
                          {card.tagIds?.length ? <small>{card.tagIds.map((id) => organization.tags.find((tag) => tag.id === id)?.label).filter(Boolean).join(' · ')}</small> : null}
                        </button>;
                      })}</div>
                    </section>)}</div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Boxes aria-hidden="true" /><strong>{focusedCards.length ? 'No cards match this view' : 'This Set is ready for its first card'}</strong><p className={styles.emptyCopy}>{focusedCards.length ? 'Clear search or tag filters to bring the cards back.' : 'Cards you create in Studio return to this exact work surface.'}</p>{!focusedCards.length ? <Button type="button" onClick={() => void projection.openItem(focusedItem, createDeskReturnHref(focusedItem.id))}>Add first cards</Button> : null}</div></div>}
                  </div>
                  {sortedCards.length > 24 ? <p className={styles.emptyCopy}>Showing the first 24 cards in each group. Narrow the view or open Studio for the complete production view.</p> : null}
                </> : <div className={styles.remoteFocus}><div className={styles.remoteFocusInner}><WorkSourceIcon item={focusedItem} /><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">{focusedItem.name}</h2><p className={styles.emptyCopy}>This work stays owned by {workSourceLabel(focusedItem)}. Open it to load its exact contents into the CardForge workbench.</p><Button type="button" onClick={() => void projection.openItem(focusedItem, createDeskReturnHref(focusedItem.id))}>Open in Studio</Button></div></div>}
              </section>
            </div>
          ) : (
            <div className={styles.desk} data-home-desk="overview">
              <header className={styles.deskIntro}>
                <div><p>Desk</p><h1>Your creative workspace</h1><span>Your open Sets stay arranged here. Choose one to move closer.</span></div>
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
                        <div className={styles.workVisual} data-home-set-stack>{item.references.localSetId ? <AuthoredObjectPreview cards={cards} template={workTemplate(item)} label={item.name} size={featured ? 'large' : 'standard'} emptyLabel={cards.length ? undefined : 'Empty Set'} /> : <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>Preview after opening</span></div>}</div>
                        <span className={styles.workMeta}><strong>{item.name}</strong><span>{item.details.join(' · ') || workSourceLabel(item)}</span><span>{workSourceLabel(item)}</span></span>
                      </button>
                      <div className={styles.tileActions}>
                        <button type="button" className={styles.iconButton} data-active={pinnedIds.includes(item.id)} onClick={() => togglePin(item.id)} aria-label={`${pinnedIds.includes(item.id) ? 'Unpin' : 'Pin'} ${item.name}`} title={pinnedIds.includes(item.id) ? 'Unpin from desk' : 'Pin to desk'}><Pin size={15} aria-hidden="true" /></button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button id={`home-work-info-${item.id}`} type="button" className={styles.iconButton} aria-label={`Actions for ${item.name}`} title="Actions"><MoreHorizontal size={15} aria-hidden="true" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openWorkLane(item, 'open')}><Pencil aria-hidden="true" />Edit in Studio</DropdownMenuItem>
                            {item.references.localSetId ? <DropdownMenuItem onSelect={() => openWorkLane(item, 'generate')}><WandSparkles aria-hidden="true" />Generate cards</DropdownMenuItem> : null}
                            <DropdownMenuItem disabled={!experience.capabilities.canUseProjectFiles} onSelect={() => setLocationItem(item)}><Save aria-hidden="true" />Save / move{experience.capabilities.canUseProjectFiles ? '' : ' · Creator Pass'}</DropdownMenuItem>
                            {experience.contributor.canSubmit && item.references.localSetId ? <DropdownMenuItem onSelect={() => projection.router.push(`/account?section=library&scope=pipeline&tool=contribute&submitSet=${encodeURIComponent(item.references.localSetId!)}`)}><UploadCloud aria-hidden="true" />Send to Pipeline</DropdownMenuItem> : null}
                            {item.references.localSetId ? <DropdownMenuItem onSelect={() => duplicateWork(item)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
                            <DropdownMenuItem disabled={index === 0} onSelect={() => moveDeskWork(item.id, 'earlier')}><ArrowUp aria-hidden="true" />Move earlier on desk</DropdownMenuItem>
                            <DropdownMenuItem disabled={index === visibleWork.length - 1} onSelect={() => moveDeskWork(item.id, 'later')}><ArrowDown aria-hidden="true" />Move later on desk</DropdownMenuItem>
                            {item.references.localSetId ? <DropdownMenuItem onSelect={() => openWorkLane(item, 'export')}><Printer aria-hidden="true" />Export / print</DropdownMenuItem> : null}
                            <DropdownMenuItem onSelect={() => inspectItem(item)}><Info aria-hidden="true" />Details</DropdownMenuItem>
                            {item.references.localSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" disabled={cardSets.length <= 1} onSelect={() => setPendingDeleteWork(item)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </article>;
                  })}
                </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><FolderPlus aria-hidden="true" /><strong>{workItems.length ? 'No work matches this view' : 'Your desk is ready'}</strong><p className={styles.emptyCopy}>{workItems.length ? 'Clear the search or change the source filter.' : 'Create a Set here, or connect durable work from Library.'}</p>{workItems.length ? <Button type="button" variant="outline" onClick={() => { setQuery(''); setSourceFilter('all'); }}>Show all work</Button> : <Button type="button" onClick={openCreateMenu}>Create your first Set</Button>}</div></div>}
              </section>
              {experience.contributor.canDraftCampaigns ? <CampaignDeskShelf onOpen={(campaignId) => projection.router.push(`/account?section=library&scope=campaigns${campaignId ? `&campaign=${encodeURIComponent(campaignId)}` : ''}`)} /> : null}
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
        canUseProjectFiles={experience.capabilities.canUseProjectFiles}
        driveConnected={projection.driveConnection?.connected ?? false}
        localFolderSupported={projection.localFolderSupported}
        onChanged={projection.refresh}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={styles.createDialog}>
          <DialogHeader>
            <DialogTitle>Start a new Set</DialogTitle>
            <DialogDescription>Begin empty or make an independent editable copy of a published Set.</DialogDescription>
          </DialogHeader>
          <div className={styles.createChoices}>
            <button type="button" className={styles.createChoice} onClick={createWork}>
              <span className={styles.createChoiceVisual}><FolderPlus aria-hidden="true" /></span>
              <span><strong>Fresh Set</strong><small>An empty Set using your current Template selection.</small></span>
            </button>
            {publishedSets.map((set) => <button key={set.id} type="button" className={styles.createChoice} disabled={creatingPublishedSetId !== null} onClick={() => void createFromPublishedSet(set)}>
              <span className={styles.createChoiceVisual}>{set.previewUrl ? <img src={set.previewUrl} alt="" /> : <Boxes aria-hidden="true" />}</span>
              <span><strong>{set.name}</strong><small>{set.description} · Revision {set.revision}</small></span>
              {creatingPublishedSetId === set.id ? <Loader2 className="animate-spin" aria-label="Creating Set" /> : null}
            </button>)}
            {publishedSetsLoading ? <div className={styles.createStatus}><Loader2 className="animate-spin" aria-hidden="true" />Loading published Sets</div> : null}
            {publishedSetsFailure ? <EnvironmentBoundaryNotice title="Published Sets are unavailable" message={`${publishedSetsFailure} You can still create a fresh Set.`} actionLabel="Retry" onAction={() => { setPublishedSets([]); setPublishedSetsFailure(null); setPublishedSetsLoading(false); openCreateMenu(); }} /> : null}
            {!publishedSetsLoading && !publishedSetsFailure && publishedSets.length === 0 ? <p className={styles.createStatus}>No published Set starters yet. Fresh Set remains available.</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteWork)} onOpenChange={(open) => { if (!open) setPendingDeleteWork(null); }}>
        <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
          <AlertDialogHeader><AlertDialogTitle>Delete this Set from this device?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">{pendingDeleteWork?.name} and its local cards will be removed from this browser workspace. Provider copies and shared Library content remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const localId = pendingDeleteWork?.references.localSetId; if (localId && deleteCardSet(localId)) { setFocusedWorkId(null); setInspectorWorkId(null); } setPendingDeleteWork(null); }}>Delete local Set</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDeleteCards.length > 0} onOpenChange={(open) => { if (!open) setPendingDeleteCards([]); }}>
        <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
          <AlertDialogHeader><AlertDialogTitle>Remove {pendingDeleteCards.length === 1 ? 'this card' : `${pendingDeleteCards.length} cards`} from the Set?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">The selected rendered {pendingDeleteCards.length === 1 ? 'card and its data' : 'cards and their data'} will be removed from this local Set. Reusable Templates remain available.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { removeGeneratedCards(pendingDeleteCards.map((card) => card.uniqueId)); setPendingDeleteCards([]); setSelectedCardIds([]); }}>Remove {pendingDeleteCards.length === 1 ? 'card' : 'cards'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
