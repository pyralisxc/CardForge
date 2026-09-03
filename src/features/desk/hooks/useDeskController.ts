"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { trackCardForgeEvent } from '@/features/analytics/client/tracking';
import type { DisplayCard } from '@/domain/rendering';
import {
  closeCreatorContext,
  createCreatorInteractionSession,
  focusCreatorSet,
  getVisibleEnvironmentZones,
  selectCreatorArtifacts,
  selectCreatorDeskSets,
  setCreatorLens,
  type EnvironmentViewer,
} from '@/features/app-shell/client/environment';
import { createDeskReturnHref, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { useSpatialWorkspacePreferences } from '@/features/project/client/workspace';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { useAccountLibraryProjection, type AccountLibraryItem } from '@/features/storage-management/client';

import {
  visibleWorkKinds,
  type DeskAccountStatus,
  type HomeSourceFilter,
} from '../model/desk';
import { createDeskAccountStatuses } from '../model/accountStatuses';
import { useCreatorNavigation } from './useCreatorNavigation';
import { useArtifactCommands } from './useArtifactCommands';
import { useDeskActionRuntime } from './useDeskActionRuntime';
import { useDeskLayout } from './useDeskLayout';
import { usePublishedSetStarters } from './usePublishedSetStarters';
import { useDeskProjectWorkspace } from './useDeskProjectWorkspace';

interface DeskControllerOptions {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialFocusedWorkId?: string | null;
  initialFocusedArtifactId?: string | null;
  initialTool?: 'design' | 'generate' | 'output' | 'pipeline' | null;
  initialReturnContextKey?: string | null;
  homeAccessStatus?: DeskAccountStatus;
  homeSecurityStatus?: DeskAccountStatus;
}

export function useDeskController({
  persistenceScope,
  experience,
  initialFocusedWorkId,
  initialFocusedArtifactId,
  initialTool = null,
  initialReturnContextKey,
  homeAccessStatus,
  homeSecurityStatus,
}: DeskControllerOptions) {
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
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const {
    closeContextTool,
    confirmDirtyClose,
    dirtyCloseRequested,
    focusArtifactContext: navigateToArtifact,
    focusWorkContext,
    focusedWorkId,
    inspectorWorkId,
    interactionSession,
    openContextTool: navigateToTool,
    requestHistoryBack,
    resetToDesk,
    restoreFocusedContext,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setInspectorWorkId,
    setInteractionSession,
  } = useCreatorNavigation({ initialFocusedWorkId, initialFocusedArtifactId });
  const focusArtifactContext = useCallback((nextSession: Parameters<typeof navigateToArtifact>[0]) => {
    trackCardForgeEvent('artifact_focused', { object_kind: 'card', input_method: 'direct' });
    navigateToArtifact(nextSession);
  }, [navigateToArtifact]);
  const openContextTool = useCallback((setId: string, tool: Parameters<typeof navigateToTool>[1]) => {
    trackCardForgeEvent('tool_opened', { object_kind: tool, input_method: 'direct' });
    navigateToTool(setId, tool);
  }, [navigateToTool]);
  const selectedCardIds = interactionSession.selection;
  const selectedDeskIds = interactionSession.deskSelection;
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
  const [latestGeneratedIds, setLatestGeneratedIds] = useState<string[]>([]);
  const { showGrid, snapToGrid, setShowGrid, setSnapToGrid } = useSpatialWorkspacePreferences();

  const workItems = useMemo(() => projection.items.filter((item) => (
    visibleWorkKinds.has(item.kind)
  )), [projection.items]);
  const itemById = useMemo(() => new Map(workItems.map((item) => [item.id, item])), [workItems]);
  const {
    beginDrag: beginDeskDrag,
    beginMarquee: beginDeskMarquee,
    camera: deskCamera,
    endDrag: endDeskDrag,
    endMarquee: endDeskMarquee,
    marquee: deskMarquee,
    moveDrag: moveDeskDrag,
    moveMarquee: moveDeskMarquee,
    nudgeSelection: nudgeDeskSelection,
    pinnedIds,
    positions: deskPositions,
    shouldSuppressActivation,
    sourceFacets,
    togglePin,
    visibleWork,
    workGridRef,
    workWorldRef,
  } = useDeskLayout({
    persistenceScope,
    workItems,
    query,
    sourceFilter,
    focused: Boolean(focusedWorkId),
    snapToGrid,
    selectedIds: selectedDeskIds,
    onSelectionChange: (ids, anchorId) => setInteractionSession((current) => selectCreatorDeskSets(current, ids, anchorId)),
  });
  useEffect(() => {
    if (sourceFilter === 'all' || sourceFacets.some((facet) => facet.id === sourceFilter)) return;
    setSourceFilter('all');
  }, [sourceFacets, sourceFilter]);
  const focusedItem = focusedWorkId ? itemById.get(focusedWorkId) ?? null : null;
  const inspectorItem = inspectorWorkId ? itemById.get(inspectorWorkId) ?? null : null;
  const focusedLocalSetId = focusedItem?.references.localSetId ?? null;
  const activeContextTool = interactionSession.toolStack.at(-1) ?? null;
  const activeContextSetId = activeContextTool?.targetIds[0] ?? null;
  const pipelineSubmitSetId = activeContextTool?.toolId === 'pipeline' ? activeContextSetId : null;
  const studioTool = activeContextTool && activeContextSetId && (activeContextTool.toolId === 'design' || activeContextTool.toolId === 'output')
    ? { setId: activeContextSetId, tool: activeContextTool.toolId }
    : null;
  const { actions: projectActions, state: projectState } = useDeskProjectWorkspace({
    focusedSetId: focusedLocalSetId,
    generationSetId: activeContextTool?.toolId === 'generate' ? activeContextSetId : null,
    selectedCardIds,
    latestGeneratedIds,
    cardQuery,
    tagFilter,
    moveTargetId,
  });
  const {
    addGeneratedCards, createCardSet, deleteCardSet, duplicateCardSet, removeGeneratedCards, renameCardSet, reviseGeneratedCards,
    setActiveCardSetId, setCardPositions, setCardsTag, setGeneratorSelectedBackingTemplateId,
    setGeneratorSelectedTemplateId, setTemplateEditorSelectedTemplateId, undoLastBulkRevision,
  } = projectActions;
  const {
    activeCardSet, activeCardSetId, allArtifactsSelected, allVisibleCardsSelected, availableFields, cardSets,
    displayCards, effectiveMoveTargetId, focusedCards, generationCards, generationSet,
    generatorSelectedBackingTemplateId, generatorSelectedTemplateId, organization, organizedGroups, otherSets, reflectiveGroupings,
    richTextHighlightColor, selectedCard, selectedCardIndex, selectedCards, selectionScope, sortedCards, templates,
    visibleCards,
  } = projectState;
  const activeWorkId = workItems.find((item) => item.references.localSetId === activeCardSetId)?.id
    ?? (projection.featuredItem && itemById.has(projection.featuredItem.id) ? projection.featuredItem.id : null);
  const focusedContentsLabel = focusedLocalSetId
    ? `${focusedCards.length} card${focusedCards.length === 1 ? '' : 's'}`
    : 'Contents load when opened';
  const focusedItemId = focusedItem?.id ?? null;
  const focusedItemName = focusedItem?.name ?? '';
  const publishedSetStarters = usePublishedSetStarters({
    focusCreatedSet: (setId) => focusWorkContext(`set:${setId}`, setId),
    refreshLibrary: projection.refresh,
  });
  const { openCreateMenu, setCreateOpen } = publishedSetStarters;

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

  const statuses = createDeskAccountStatuses({ accessStatus: homeAccessStatus, isSignedIn, projection, securityStatus: homeSecurityStatus });

  const selectDeskWork = (item: AccountLibraryItem, options: { additive?: boolean; range?: boolean } = {}) => {
    trackCardForgeEvent('set_selected', {
      object_kind: 'set',
      input_method: options.range ? 'range' : options.additive ? 'additive' : 'direct',
      selection_mode: options.range || options.additive ? 'multiple' : 'single',
    });
    const orderedIds = visibleWork.map((candidate) => candidate.id);
    const anchorId = interactionSession.deskSelectionAnchorId;
    if (options.range && anchorId && orderedIds.includes(anchorId)) {
      const start = orderedIds.indexOf(anchorId);
      const end = orderedIds.indexOf(item.id);
      const range = orderedIds.slice(Math.min(start, end), Math.max(start, end) + 1);
      setInteractionSession((current) => selectCreatorDeskSets(
        current,
        options.additive ? Array.from(new Set([...current.deskSelection, ...range])) : range,
        anchorId,
      ));
      return;
    }
    setInteractionSession((current) => selectCreatorDeskSets(
      current,
      options.additive
        ? current.deskSelection.includes(item.id)
          ? current.deskSelection.filter((id) => id !== item.id)
          : [...current.deskSelection, item.id]
        : [item.id],
      item.id,
    ));
  };

  const focusWork = (item: AccountLibraryItem) => {
    trackCardForgeEvent('set_opened', { object_kind: 'set', input_method: 'direct' });
    if (!selectedDeskIds.includes(item.id)) {
      setInteractionSession((current) => selectCreatorDeskSets(current, [item.id], item.id));
    }
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
    requestAnimationFrame(() => document.getElementById('set-name')?.focus());
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
      if (setId) document.getElementById(`set-info-set:${setId}`)?.focus();
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
  const artifactCommands = useArtifactCommands({
    actions: projectActions,
    state: projectState,
    focusedSetId: focusedLocalSetId,
    openDesign: (setId) => openContextStudio(setId, 'design'),
    setSelection: setSelectedCardIds,
    setTagDraft,
    tagDraft,
  });

  const commitRename = () => {
    if (!focusedLocalSetId) return;
    renameCardSet(focusedLocalSetId, renameDraft);
    setRenaming(false);
  };

  const inspectItem = (item: AccountLibraryItem) => {
    setInspectorWorkId(item.id);
    requestAnimationFrame(() => document.getElementById(`set-${item.id}`)?.focus());
  };

  const createDeskStudioReturnTo = (workId: string, nextSelectedCardIds: string[] = selectedCardIds) => {
    const returnContext = storeSurfaceReturnContext({
      kind: 'desk',
      focusedWorkId: workId,
      inspectorWorkId,
      query,
      sourceFilter,
      sort: 'desk',
      selectedCardIds: nextSelectedCardIds,
      cardQuery,
      tagFilter,
      scrollTop: surfaceRef.current?.scrollTop ?? 0,
    });
    return createDeskReturnHref(workId, returnContext);
  };

  const { actions, detail, runAction } = useDeskActionRuntime({
    experience,
    focusedItem,
    inspectorItem,
    pinned: Boolean(inspectorItem && pinnedIds.includes(inspectorItem.id)),
    commands: {
      createWork: openCreateMenu,
      focusWork,
      openRemoteWork: (item) => projection.openItem(item, createDeskStudioReturnTo(item.id)),
      togglePin,
      openGenerate: (setId) => openContextTool(setId, 'generate'),
      openOutput: (setId) => openContextStudio(setId, 'output'),
      openLocation: setLocationItem,
      openPipeline: openPipelineSubmission,
      renameWork: (item) => {
        focusWork(item);
        setRenaming(true);
        requestAnimationFrame(() => document.getElementById('set-name')?.focus());
      },
      duplicateWork,
      deleteWork: setPendingDeleteWork,
      manageLocation: () => projection.router.push('/account?section=library&tool=locations'),
    },
    navigationHref: (actionId, item) => actionId === 'desk.manage-location'
      ? '/account?section=library&tool=locations'
      : actionId === 'desk.export-set' && item
        ? `/account?focus=${encodeURIComponent(item.id)}&tool=output`
        : item ? createDeskStudioReturnTo(item.id) : '/account',
  });

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
    reviseGeneratedCards,
    allArtifactsSelected,
    allVisibleCardsSelected,
    availableFields,
    beginDeskDrag,
    beginDeskMarquee,
    cardQuery,
    cardStageRef,
    closeContextStudio,
    closeGenerate,
    closePipelineSubmission,
    confirmDirtyClose,
    commitRename,
    createWork,
    deleteCardSet,
    deskPositions,
    deskCamera,
    deskMarquee,
    detail,
    dirtyCloseRequested,
    duplicateWork,
    effectiveMoveTargetId,
    endDeskDrag,
    endDeskMarquee,
    focusWork,
    focusArtifactContext,
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
    moveDeskMarquee,
    nudgeDeskSelection,
    moveTargetId,
    openContextStudio,
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
    query,
    removeGeneratedCards,
    reflectiveGroupings,
    renameDraft,
    renaming,
    richTextHighlightColor,
    runAction,
    searchRef,
    selectedCard,
    selectedCardIndex,
    selectedCards,
    selectedDeskIds,
    selectDeskWork,
    selectionScope,
    setCardPositions,
    setCardQuery,
    setCardsTag,
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
    setQuery,
    setRenameDraft,
    setRenaming,
    setSelectedCardIds,
    setShowGrid,
    setSnapToGrid,
    setSourceFilter,
    setTagDraft,
    setTagFilter,
    undoLastBulkRevision,
    requestHistoryBack,
    resetToDesk,
    shouldSuppressActivation,
    showGrid,
    showTemplateTool,
    snapToGrid,
    sourceFacets,
    sortedCards,
    sourceFilter,
    statuses,
    studioTool,
    surfaceRef,
    tagDraft,
    tagFilter,
    templates,
    togglePin,
    viewGeneratedCards,
    viewer,
    visibleCards,
    visibleWork,
    workCards,
    workGridRef,
    workWorldRef,
    workItems,
    workTemplate,
    zones,
    ...artifactCommands,
    ...publishedSetStarters,
  };
}
