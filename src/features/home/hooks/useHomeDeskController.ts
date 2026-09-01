"use client";

import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';

import { useToast } from '@/components/ui/use-toast';
import type { CardSetOrganization } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  closeCreatorContext,
  createActionDefinition,
  createActionRuntime,
  createCreatorInteractionSession,
  focusCreatorSet,
  getVisibleEnvironmentZones,
  selectCreatorArtifacts,
  setCreatorLens,
  type ActionDescriptor,
  type ActionOperationResult,
  type EnvironmentViewer,
} from '@/features/app-shell/client/environment';
import { createDeskReturnHref, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import {
  readProjectPreference,
  createPublishedSetCopy,
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  useSpatialWorkspacePreferences,
  useProjectStore,
  writeProjectPreference,
  type ProjectPersistenceScope,
  type ProjectState,
} from '@/features/project/client';
import type { CardForgeCatalogManifest } from '@/features/pipeline/client';
import { createSendToPipelineActionDefinition } from '@/features/pipeline/client';
import { useAccountLibraryProjection, type AccountLibraryItem } from '@/features/storage-management/client';

import {
  getCardTitle,
  getWorkActions,
  HOME_ORDER_KEY,
  HOME_PINS_KEY,
  matchesSourceFilter,
  normalizeDeskOrder,
  reorderDeskItem,
  visibleWorkKinds,
  workDetailRecord,
  workSourceLabel,
  zoneAction,
  type HomeAccountStatus,
  type HomeSort,
  type HomeSourceFilter,
} from '../model/homeDesk';
import { useDeskSpatialLayout } from './useDeskSpatialLayout';
import { useHomeCreatorNavigation } from './useHomeCreatorNavigation';
import { getArtifactSelectionScope } from '../model/focusedArtifactLayout';

const DEFAULT_FOCUSED_ORGANIZATION: CardSetOrganization = {
  arrangement: 'manual', groupBy: 'none', sort: 'manual', tags: [], positions: {},
};

interface HomeDeskControllerOptions {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialFocusedWorkId?: string | null;
  initialTool?: 'design' | 'generate' | 'output' | 'pipeline' | null;
  initialReturnContextKey?: string | null;
  homeAccessStatus?: HomeAccountStatus;
  homeSecurityStatus?: HomeAccountStatus;
}

export function useHomeDeskController({
  persistenceScope,
  experience,
  initialFocusedWorkId,
  initialTool = null,
  initialReturnContextKey,
  homeAccessStatus,
  homeSecurityStatus,
}: HomeDeskControllerOptions) {
  const { toast } = useToast();
  const isSignedIn = experience.signedIn;
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const cardStageRef = useRef<HTMLDivElement | null>(null);
  const returnContextRestoredRef = useRef(false);
  const initialToolHandledRef = useRef(false);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: experience.contributor.active, owner: experience.owner };
  const zones = getVisibleEnvironmentZones(viewer);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<HomeSourceFilter>('all');
  const [sort, setSort] = useState<HomeSort>('desk');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [deskOrderIds, setDeskOrderIds] = useState<string[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const {
    closeContextTool,
    confirmDirtyClose,
    dirtyCloseRequested,
    focusWorkContext,
    focusedWorkId,
    inspectorWorkId,
    interactionSession,
    openContextTool,
    requestHistoryBack,
    resetToDesk,
    restoreFocusedContext,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setInspectorWorkId,
    setInteractionSession,
  } = useHomeCreatorNavigation({ initialFocusedWorkId });
  const selectedCardIds = interactionSession.selection;
  const setSelectedCardIds = (next: SetStateAction<string[]>) => {
    setInteractionSession((current) => selectCreatorArtifacts(
      current,
      typeof next === 'function' ? next(current.selection) : next,
    ));
  };
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
  const [latestGeneratedIds, setLatestGeneratedIds] = useState<string[]>([]);
  const { showGrid, snapToGrid, setShowGrid, setSnapToGrid } = useSpatialWorkspacePreferences();

  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSetId = useProjectStore((state) => state.activeCardSet?.id ?? null);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
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
  const generatorSelectedTemplateId = useProjectStore((state) => state.singleCardGeneratorSelectedTemplateId);
  const generatorSelectedBackingTemplateId = useProjectStore((state) => state.singleCardGeneratorSelectedBackingTemplateId);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setGeneratorSelectedTemplateId = useProjectStore((state) => state.setSingleCardGeneratorSelectedTemplateId);
  const setGeneratorSelectedBackingTemplateId = useProjectStore((state) => state.setSingleCardGeneratorSelectedBackingTemplateId);
  const setTemplateEditorSelectedTemplateId = useProjectStore((state) => state.setTemplateEditorSelectedTemplateId);
  const updateCardSetOrganization = useProjectStore((state) => state.updateCardSetOrganization);
  const addCardSetTag = useProjectStore((state) => state.addCardSetTag);
  const setCardsTag = useProjectStore((state) => state.setCardsTag);
  const setCardPositions = useProjectStore((state) => state.setCardPositions);
  const displayCards = useMemo(() => selectAllGeneratedDisplayCards({
    cardSets,
    activeCardSet: cardSets.find((set) => set.id === activeCardSetId) ?? null,
    storedCards,
    defaultTemplates,
    userTemplates,
  } as ProjectState), [activeCardSetId, cardSets, defaultTemplates, storedCards, userTemplates]);
  const templates = useMemo(() => selectAllTemplates({ defaultTemplates, userTemplates } as ProjectState), [defaultTemplates, userTemplates]);
  const pinKey = `${HOME_PINS_KEY}:${persistenceScope}`;
  const orderKey = `${HOME_ORDER_KEY}:${persistenceScope}`;
  const positionKey = `${HOME_ORDER_KEY}:positions:${persistenceScope}`;
  const {
    beginDrag: beginDeskDrag,
    endDrag: endDeskDrag,
    moveDrag: moveDeskDrag,
    positions: deskPositions,
    shouldSuppressFocus,
    workGridRef,
  } = useDeskSpatialLayout({ positionKey, snapToGrid });

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
  const activeContextTool = interactionSession.toolStack.at(-1) ?? null;
  const activeContextSetId = activeContextTool?.targetIds[0] ?? null;
  const pipelineSubmitSetId = activeContextTool?.toolId === 'pipeline' ? activeContextSetId : null;
  const generationSet = activeContextTool?.toolId === 'generate' && activeContextSetId
    ? cardSets.find((set) => set.id === activeContextSetId) ?? null
    : null;
  const studioTool = activeContextTool && activeContextSetId && (activeContextTool.toolId === 'design' || activeContextTool.toolId === 'output')
    ? { setId: activeContextSetId, tool: activeContextTool.toolId }
    : null;
  const organization = focusedSet?.organization ?? DEFAULT_FOCUSED_ORGANIZATION;
  const focusedCards = focusedLocalSetId
    ? displayCards.filter((card) => card.setId === focusedLocalSetId || (!card.setId && cardSets[0]?.id === focusedLocalSetId))
    : [];
  const generationCards = generationSet
    ? displayCards.filter((card) => card.setId === generationSet.id || (!card.setId && cardSets[0]?.id === generationSet.id))
    : [];
  const focusedContentsLabel = focusedLocalSetId
    ? `${focusedCards.length} card${focusedCards.length === 1 ? '' : 's'}`
    : 'Contents load when opened';
  const normalizedCardQuery = cardQuery.trim().toLocaleLowerCase();
  const availableFields = [...new Set(focusedCards.flatMap((card) => Object.keys(card.data)
    .filter((key) => card.data[key] !== undefined && String(card.data[key]).trim())))].toSorted();
  const visibleCards = focusedCards.filter((card, index) => (latestGeneratedIds.length === 0 || latestGeneratedIds.includes(card.uniqueId)) && (!normalizedCardQuery || [getCardTitle(card, index), card.template.name, ...Object.values(card.data), ...organization.tags.filter((tag) => card.tagIds?.includes(tag.id)).map((tag) => tag.label)]
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
  const allArtifactsSelected = focusedCards.length > 0
    && focusedCards.every((card) => selectedCardIds.includes(card.uniqueId));
  const selectionScope = getArtifactSelectionScope(selectedCardIds, visibleCards.map((card) => card.uniqueId));
  const otherSets = focusedLocalSetId ? cardSets.filter((set) => set.id !== focusedLocalSetId) : [];
  const effectiveMoveTargetId = otherSets.some((set) => set.id === moveTargetId)
    ? moveTargetId
    : otherSets[0]?.id ?? '';
  const focusedItemId = focusedItem?.id ?? null;
  const focusedItemName = focusedItem?.name ?? '';

  useEffect(() => {
    if (!focusedItemId) return;
    setRenameDraft(focusedItemName);
    setCardQuery('');
    setTagFilter('all');
    setLatestGeneratedIds([]);
  }, [focusedItemId, focusedItemName]);

  useEffect(() => {
    setInteractionSession((current) => setCreatorLens(current, {
      query: cardQuery,
      filterIds: tagFilter === 'all' ? [] : [tagFilter],
    }));
  }, [cardQuery, setInteractionSession, tagFilter]);

  useEffect(() => {
    if (initialToolHandledRef.current || !initialTool) return;
    if (initialReturnContextKey && !returnContextRestoredRef.current) return;
    const targetSetId = focusedLocalSetId ?? activeCardSetId;
    if (!targetSetId) return;
    initialToolHandledRef.current = true;
    setActiveCardSetId(targetSetId);
    openContextTool(targetSetId, initialTool);
  }, [activeCardSetId, focusedLocalSetId, initialReturnContextKey, initialTool, openContextTool, setActiveCardSetId]);

  useEffect(() => {
    if (!initialReturnContextKey || returnContextRestoredRef.current) return;
    const context = readSurfaceReturnContext(initialReturnContextKey);
    if (!context || context.kind !== 'desk') {
      returnContextRestoredRef.current = true;
      return;
    }
    if (context.focusedWorkId && !itemById.has(context.focusedWorkId)) return;
    returnContextRestoredRef.current = true;
    setQuery(context.query);
    setSourceFilter(context.sourceFilter);
    setSort(context.sort);
    const restoredSetId = context.focusedWorkId?.startsWith('set:') ? context.focusedWorkId.slice(4) : null;
    restoreFocusedContext({
      focusedWorkId: context.focusedWorkId,
      inspectorWorkId: context.inspectorWorkId && itemById.has(context.inspectorWorkId) ? context.inspectorWorkId : null,
      session: selectCreatorArtifacts(
        restoredSetId ? focusCreatorSet(createCreatorInteractionSession(), restoredSetId) : createCreatorInteractionSession(),
        context.selectedCardIds,
      ),
    });
    setCardQuery(context.cardQuery);
    setTagFilter(context.tagFilter);
    requestAnimationFrame(() => surfaceRef.current?.scrollTo({ top: context.scrollTop }));
  }, [initialReturnContextKey, itemById, restoreFocusedContext]);

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

  const statuses: HomeAccountStatus[] = [
    ...(homeAccessStatus ? [homeAccessStatus] : []),
    {
      label: 'Storage',
      value: projection.failures.some((failure) => failure.id === 'workspace') ? 'Device unavailable' : 'Work available',
      detail: `${projection.sourceCounts.get('device') ?? 0} on this device`,
      href: '/account?section=library&tool=locations',
      action: 'Review',
    },
    {
      label: 'Connections',
      value: !isSignedIn ? 'Sign in to connect' : projection.loadingSources ? 'Checking' : projection.driveConnection?.connected ? 'Drive connected' : 'Not connected',
      detail: `${projection.sourceCounts.get('google-drive') ?? 0} connected work item${(projection.sourceCounts.get('google-drive') ?? 0) === 1 ? '' : 's'}`,
      href: '/account?section=library&tool=locations',
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
    focusWorkContext(item.id, item.references.localSetId ?? null);
  };

  const createWork = (openDesign = false) => {
    const id = createCardSet();
    setCreateOpen(false);
    setRenaming(true);
    if (openDesign) {
      setActiveCardSetId(id);
      openContextTool(id, 'design');
    } else focusWorkContext(`set:${id}`, id);
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
      focusWorkContext(`set:${result.setId}`, result.setId);
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
    focusWorkContext(`set:${duplicateId}`, duplicateId);
    toast({ title: 'Work duplicated', description: 'The copied Set and its cards are independently editable.' });
  };

  const openPipelineSubmission = (setId: string) => {
    setActiveCardSetId(setId);
    openContextTool(setId, 'pipeline');
  };

  const closePipelineSubmission = () => {
    const setId = pipelineSubmitSetId;
    closeContextTool();
    requestAnimationFrame(() => {
      if (setId) document.getElementById(`home-work-info-set:${setId}`)?.focus();
    });
  };

  const openContextStudio = (setId: string, tool: 'design' | 'output') => {
    setActiveCardSetId(setId);
    openContextTool(setId, tool);
  };

  const closeContextStudio = () => {
    closeContextTool();
    requestAnimationFrame(() => cardStageRef.current?.focus());
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

  const createDeskStudioReturnTo = (workId: string, nextSelectedCardIds: string[] = selectedCardIds) => {
    const returnContext = storeSurfaceReturnContext({
      kind: 'desk',
      focusedWorkId: workId,
      inspectorWorkId,
      query,
      sourceFilter,
      sort,
      selectedCardIds: nextSelectedCardIds,
      cardQuery,
      tagFilter,
      scrollTop: surfaceRef.current?.scrollTop ?? 0,
    });
    return createDeskReturnHref(workId, returnContext);
  };

  const actionDescriptors: ActionDescriptor[] = inspectorItem
    ? getWorkActions(inspectorItem, pinnedIds.includes(inspectorItem.id), true, experience.contributor.canSubmit, experience.capabilities.canUseProjectFiles)
    : focusedItem ? [] : [zoneAction('home.create-work', 'New Set', 'mutation')];
  const detail = inspectorItem ? workDetailRecord(inspectorItem) : null;
  const actionItem = inspectorItem ?? focusedItem;
  const mutationResult = (targetIds: string[]): ActionOperationResult => ({ kind: 'mutation', changedIds: targetIds });
  const navigationResult = (href: string): ActionOperationResult => ({ kind: 'navigation', href });
  const actionOperations: Record<string, () => void | Promise<void>> = {
    'home.create-work': openCreateMenu,
    'home.open-work': () => {
      if (!actionItem) return;
      if (actionItem.references.localSetId) focusWork(actionItem);
      else return projection.openItem(actionItem, createDeskStudioReturnTo(actionItem.id));
    },
    'home.pin-work': () => { if (inspectorItem) togglePin(inspectorItem.id); },
    'home.generate-work': () => { if (actionItem?.references.localSetId) openContextTool(actionItem.references.localSetId, 'generate'); },
    'home.export-work': () => { if (actionItem?.references.localSetId) openContextStudio(actionItem.references.localSetId, 'output'); },
    'home.save-move-work': () => { if (actionItem) setLocationItem(actionItem); },
    'home.rename-work': () => {
      if (!inspectorItem?.references.localSetId) return;
      focusWork(inspectorItem);
      setRenaming(true);
      requestAnimationFrame(() => document.getElementById('home-work-name')?.focus());
    },
    'home.duplicate-work': () => { if (inspectorItem) duplicateWork(inspectorItem); },
    'home.delete-work': () => { if (inspectorItem) setPendingDeleteWork(inspectorItem); },
    'home.manage-location': () => projection.router.push('/account?section=library&tool=locations'),
  };
  const actionDefinitions = actionDescriptors.map((descriptor) => {
    if (descriptor.id === 'home.send-pipeline' && actionItem?.references.localSetId) {
      return createSendToPipelineActionDefinition({
        id: 'home.send-pipeline',
        objectKind: 'home-work',
        sources: descriptor.supportedSources,
        execute: () => openPipelineSubmission(actionItem.references.localSetId!),
      });
    }
    const execute = actionOperations[descriptor.id];
    if (!execute) throw new Error(`Desk action ${descriptor.id} has no registered execution owner.`);
    return createActionDefinition(descriptor, async (input) => {
      await execute();
      if (descriptor.result === 'navigation') {
        const href = descriptor.id === 'home.manage-location'
          ? '/account?section=library&tool=locations'
          : descriptor.id === 'home.export-work' && actionItem
            ? `/account?focus=${encodeURIComponent(actionItem.id)}&tool=output`
            : actionItem
              ? createDeskStudioReturnTo(actionItem.id)
              : '/account';
        return navigationResult(href);
      }
      return mutationResult(input.targetIds);
    });
  });
  const actions = actionDefinitions.map((definition) => definition.descriptor);
  const actionRuntime = createActionRuntime(actionDefinitions);
  const runAction = (action: ActionDescriptor) => {
    const targetIds = actionItem ? [actionItem.references.localSetId ?? actionItem.id] : [];
    void actionRuntime.execute(action.id, { targetIds }).catch((error: unknown) => {
      toast({
        title: 'Action could not be completed',
        description: error instanceof Error ? error.message : 'The selected Desk action is unavailable.',
        variant: 'destructive',
      });
    });
  };

  const openWorkLane = (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => {
    if (!item.references.localSetId) {
      if (lane === 'open') void projection.openItem(item, createDeskStudioReturnTo(item.id));
      else setLocationItem(item);
      return;
    }
    setActiveCardSetId(item.references.localSetId);
    if (lane === 'generate') {
      openContextTool(item.references.localSetId, 'generate');
      return;
    }
    openContextStudio(item.references.localSetId, lane === 'export' ? 'output' : 'design');
  };

  const moveSelectedCards = () => {
    if (!selectedCards.length || !effectiveMoveTargetId) return;
    const movedCount = moveGeneratedCardsToSet(selectedCards.map((card) => card.uniqueId), effectiveMoveTargetId);
    if (!movedCount) return;
    const destination = cardSets.find((set) => set.id === effectiveMoveTargetId);
    toast({ title: `${movedCount} card${movedCount === 1 ? '' : 's'} moved`, description: `The selection now belongs to ${destination?.name ?? 'the selected Set'}.` });
    setSelectedCardIds([]);
  };

  const editSelectedCard = (artifactId: string = selectedCard?.uniqueId ?? '') => {
    const card = focusedCards.find((candidate) => candidate.uniqueId === artifactId);
    if (!card || !focusedLocalSetId) return;
    setActiveCardSetId(focusedLocalSetId);
    setStudioView('template');
    openEditDialog(card.uniqueId);
    openContextStudio(focusedLocalSetId, 'design');
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
    return workCards(item)[0]?.template ?? null;
  };
  const closeGenerate = () => closeContextTool();
  const showTemplateTool = (templateId?: string | null) => {
    if (templateId) setTemplateEditorSelectedTemplateId(templateId);
    const setId = generationSet?.id ?? focusedLocalSetId ?? activeCardSet?.id;
    if (setId) openContextStudio(setId, 'design');
  };
  const viewGeneratedCards = (cards: DisplayCard[]) => {
    const ids = cards.map((card) => card.uniqueId);
    const targetSetId = cards[0]?.setId ?? generationSet?.id ?? activeCardSet?.id;
    if (!targetSetId) return;
    const focusedSession = focusCreatorSet(closeCreatorContext(interactionSession).session, targetSetId);
    closeContextTool(selectCreatorArtifacts(focusedSession, ids));
    setCardQuery('');
    setTagFilter('all');
    setLatestGeneratedIds(ids);
    requestAnimationFrame(() => cardStageRef.current?.focus());
  };

  return {
    actions,
    activeCardSet,
    activeWorkId,
    addGeneratedCards,
    allArtifactsSelected,
    allVisibleCardsSelected,
    applyNewTag,
    availableFields,
    beginDeskDrag,
    cardQuery,
    cardStageRef,
    closeContextStudio,
    closeGenerate,
    closePipelineSubmission,
    confirmDirtyClose,
    commitRename,
    createFromPublishedSet,
    createOpen,
    createWork,
    creatingPublishedSetId,
    deleteCardSet,
    deskPositions,
    detail,
    dirtyCloseRequested,
    duplicateSelectedCards,
    duplicateWork,
    editSelectedCard,
    effectiveMoveTargetId,
    endDeskDrag,
    focusWork,
    focusedCards,
    focusedContentsLabel,
    focusedItem,
    focusedLocalSetId,
    generationCards,
    generationSet,
    generatorSelectedBackingTemplateId,
    generatorSelectedTemplateId,
    inspectItem,
    inspectorItem,
    interactionSession,
    isSignedIn,
    latestGeneratedIds,
    locationItem,
    moveDeskDrag,
    moveDeskWork,
    moveSelectedCards,
    moveTargetId,
    openContextStudio,
    openCreateMenu,
    openPipelineSubmission,
    openWorkLane,
    organization,
    organizedGroups,
    otherSets,
    pendingDeleteCards,
    pendingDeleteWork,
    pinnedIds,
    pipelineSubmitSetId,
    projection,
    publishedSets,
    publishedSetsFailure,
    publishedSetsLoading,
    query,
    removeGeneratedCards,
    renameDraft,
    renaming,
    reorderSelectedCard,
    richTextHighlightColor,
    runAction,
    searchRef,
    selectedCard,
    selectedCardIndex,
    selectedCards,
    selectionScope,
    setCardPositions,
    setCardQuery,
    setCardsTag,
    setCreateOpen,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setGeneratorSelectedBackingTemplateId,
    setGeneratorSelectedTemplateId,
    setInspectorWorkId,
    setInteractionSession,
    setLatestGeneratedIds,
    setLocationItem,
    setMoveTargetId,
    setPendingDeleteCards,
    setPendingDeleteWork,
    setPublishedSets,
    setPublishedSetsFailure,
    setPublishedSetsLoading,
    setQuery,
    setRenameDraft,
    setRenaming,
    setSelectedCardIds,
    setShowGrid,
    setSnapToGrid,
    setSort,
    setSourceFilter,
    setTagDraft,
    setTagFilter,
    requestHistoryBack,
    resetToDesk,
    shouldSuppressFocus,
    showGrid,
    showTemplateTool,
    snapToGrid,
    sort,
    sortedCards,
    sourceFilter,
    statuses,
    studioTool,
    surfaceRef,
    tagDraft,
    tagFilter,
    templates,
    togglePin,
    updateOrganization,
    viewGeneratedCards,
    viewer,
    visibleCards,
    visibleWork,
    workCards,
    workGridRef,
    workItems,
    workTemplate,
    zones,
  };
}
