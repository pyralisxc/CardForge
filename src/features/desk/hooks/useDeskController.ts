"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';

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
  setCreatorToolDirty,
  type EnvironmentViewer,
} from '@/features/app-shell/client/environment';
import { createDeskReturnHref, normalizeStudioReturnTo, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { useSpatialWorkspacePreferences } from '@/features/project/client/workspace';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { createPublishedSetCopy } from '@/features/project/client/published-sets';
import { applyAccountLibraryOrganizationOperation, applyAccountLibraryPrivateOrganization, useAccountLibraryProjection, type AccountLibraryItem, type AccountLibraryOrganizationOperation, type AccountLibrarySource } from '@/features/storage-management/client';

import {
  getDeskToolCard,
  visibleWorkKinds,
  type DeskAccountStatus,
} from '../model/desk';
import { createDeskAccountStatuses } from '../model/accountStatuses';
import { useCreatorNavigation } from './useCreatorNavigation';
import { useArtifactCommands } from './useArtifactCommands';
import { useDeskActionRuntime } from './useDeskActionRuntime';
import { useDeskLayout } from './useDeskLayout';
import { useDeskWorkDiscovery } from './useDeskWorkDiscovery';
import { useDeskViewPreferences, type DeskViewId } from './useDeskViewPreferences';
import { usePublishedSetStarters } from './usePublishedSetStarters';
import { useDeskProjectWorkspace } from './useDeskProjectWorkspace';

interface DeskControllerOptions {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialFocusedWorkId?: string | null;
  initialFocusedArtifactId?: string | null;
  initialTool?: 'design' | 'generate' | 'output' | 'pipeline' | null;
  initialReturnContextKey?: string | null;
  accessStatus?: DeskAccountStatus;
  securityStatus?: DeskAccountStatus;
}

export function useDeskController({
  persistenceScope,
  experience,
  initialFocusedWorkId,
  initialFocusedArtifactId,
  initialTool = null,
  initialReturnContextKey,
  accessStatus,
  securityStatus,
}: DeskControllerOptions) {
  const { toast } = useToast();
  const isSignedIn = experience.signedIn;
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const discoveredWork = useDeskWorkDiscovery({ persistenceScope, experience });
  const refreshDeskSources = useCallback(() => {
    projection.refresh();
    void discoveredWork.refresh();
  }, [discoveredWork, projection]);
  const deskProjection = useMemo(() => ({
    ...projection,
    failures: [...projection.failures, ...discoveredWork.failures],
    isLoading: projection.isLoading || discoveredWork.loading,
    loadingSources: projection.loadingSources || discoveredWork.loading,
    sourceStatuses: [...projection.sourceStatuses, ...discoveredWork.sourceStatuses],
    refresh: refreshDeskSources,
  }), [discoveredWork.failures, discoveredWork.loading, discoveredWork.sourceStatuses, projection, refreshDeskSources]);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const cardStageRef = useRef<HTMLDivElement | null>(null);
  const returnContextRestoredRef = useRef(false);
  const initialToolHandledRef = useRef(false);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: experience.contributor.active, owner: experience.owner };
  const searchParams = useSearchParams();
  const originHref = normalizeStudioReturnTo(searchParams.get('returnTo'));
  const libraryOrigin = originHref && new URL(originHref, 'https://cardforge.local').searchParams.get('section') === 'library' ? originHref : null;
  const zones = getVisibleEnvironmentZones(viewer).map((zone) => zone.id === 'library' && libraryOrigin ? { ...zone, href: libraryOrigin } : zone);
  const [query, setQuery] = useState('');
  const deskViewPreferences = useDeskViewPreferences(persistenceScope);
  const availableDeskViews = useMemo(() => ([
    'my-work',
    ...(discoveredWork.canLoadCampaigns ? ['campaigns'] : []),
    ...(discoveredWork.canLoadPublished ? ['my-published'] : []),
  ] as DeskViewId[]), [discoveredWork.canLoadCampaigns, discoveredWork.canLoadPublished]);
  const activeDeskViews = useMemo(() => {
    const authorized = deskViewPreferences.preferences.views.filter((view) => availableDeskViews.includes(view));
    return authorized.length ? authorized : ['my-work'] as DeskViewId[];
  }, [availableDeskViews, deskViewPreferences.preferences.views]);
  const sourceFilter = deskViewPreferences.preferences.sources[0] ?? 'all';
  const setSourceFilter = useCallback((source: 'all' | AccountLibrarySource) => {
    deskViewPreferences.update((current) => ({ ...current, sources: source === 'all' ? [] : [source] }));
  }, [deskViewPreferences]);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const {
    closeContextTool,
    confirmDirtyClose,
    dirtyCloseRequested,
    dirtyCloseToDesk,
    focusArtifactContext: navigateToArtifact,
    focusWorkContext,
    focusedWorkId,
    inspectorWorkId,
    interactionSession,
    openContextTool: navigateToTool,
    requestHistoryBack,
    requestDeskReturn,
    resetToDesk,
    restoreFocusedContext,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setInspectorWorkId,
    setInteractionSession,
  } = useCreatorNavigation({ initialFocusedWorkId, initialFocusedArtifactId });
  const [pendingTool, setPendingTool] = useState<{
    setId: string;
    tool: Parameters<typeof navigateToTool>[1];
    templateId?: string;
    backingTemplateId?: string | null;
    origin: typeof interactionSession.focusPath;
  } | null>(null);
  const focusArtifactContext = useCallback((nextSession: Parameters<typeof navigateToArtifact>[0]) => {
    trackCardForgeEvent('artifact_focused', { object_kind: 'card', input_method: 'direct' });
    navigateToArtifact(nextSession);
  }, [navigateToArtifact]);
  const selectedCardIds = interactionSession.selection;
  const selectedDeskIds = interactionSession.deskSelection;
  const setSelectedCardIds = (next: SetStateAction<string[]>) => {
    setInteractionSession((current) => selectCreatorArtifacts(
      current,
      typeof next === 'function' ? next(current.selection) : next,
    ));
  };
  const cardQuery = interactionSession.lens.query;
  const setCardQuery = useCallback((value: string) => setInteractionSession((current) => setCreatorLens(current, { ...current.lens, query: value })), [setInteractionSession]);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const tagFilter = interactionSession.lens.filterIds[0] ?? 'all';
  const setTagFilter = useCallback((value: string) => setInteractionSession((current) => setCreatorLens(current, { ...current.lens, filterIds: value === 'all' ? [] : [value] })), [setInteractionSession]);
  const [pendingDeleteWork, setPendingDeleteWork] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteCards, setPendingDeleteCards] = useState<DisplayCard[]>([]);
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);
  const [remoteWorkspaceId, setRemoteWorkspaceId] = useState<string | null>(null);
  const [latestGeneratedIds, setLatestGeneratedIds] = useState<string[]>([]);
  const { showGrid, snapToGrid, setShowGrid, setSnapToGrid } = useSpatialWorkspacePreferences();

  const workItems = useMemo(() => applyAccountLibraryPrivateOrganization([
    ...projection.items,
    ...discoveredWork.items,
  ], projection.privateOrganization).filter((item) => (
    visibleWorkKinds.has(item.kind)
  )), [discoveredWork.items, projection.items, projection.privateOrganization]);
  const itemById = useMemo(() => new Map(workItems.map((item) => [item.id, item])), [workItems]);
  const remoteWorkspaceItem = remoteWorkspaceId ? itemById.get(remoteWorkspaceId) ?? null : null;
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
    tagFacets,
    togglePin,
    typeFacets,
    visibleWork,
    workGridRef,
    workWorldRef,
  } = useDeskLayout({
    persistenceScope,
    workItems,
    query,
    sourceFilters: deskViewPreferences.preferences.sources,
    typeFilters: deskViewPreferences.preferences.types,
    tagFilters: deskViewPreferences.preferences.tags,
    tagMatch: deskViewPreferences.preferences.tagMatch,
    viewIds: activeDeskViews,
    focused: Boolean(focusedWorkId),
    snapToGrid,
    selectedIds: selectedDeskIds,
    onSelectionChange: (ids, anchorId) => setInteractionSession((current) => selectCreatorDeskSets(current, ids, anchorId)),
  });
  const focusedItem = focusedWorkId ? itemById.get(focusedWorkId) ?? null : null;
  const inspectorItem = inspectorWorkId ? itemById.get(inspectorWorkId) ?? null : null;
  const focusedLocalSetId = focusedItem?.references.localSetId ?? null;
  useEffect(() => {
    if (remoteWorkspaceId && !remoteWorkspaceItem) setRemoteWorkspaceId(null);
  }, [remoteWorkspaceId, remoteWorkspaceItem]);
  const activeContextTool = interactionSession.toolStack.at(-1) ?? null;
  const generationContextTool = interactionSession.toolStack.findLast((tool) => tool.toolId === 'generate');
  const setGenerationToolDirty = useCallback((dirty: boolean) => {
    setInteractionSession((current) => {
      const tool = current.toolStack.findLast((candidate) => candidate.toolId === 'generate');
      return tool && tool.dirty !== dirty ? setCreatorToolDirty(current, tool.instanceId, dirty) : current;
    });
  }, [setInteractionSession]);
  const activeContextSetId = activeContextTool?.targetIds[0] ?? null;
  const pipelineSubmitSetId = activeContextTool?.toolId === 'pipeline' ? activeContextSetId : null;
  const studioTool = activeContextTool && activeContextSetId && (activeContextTool.toolId === 'design' || activeContextTool.toolId === 'output')
    ? { setId: activeContextSetId, tool: activeContextTool.toolId }
    : null;
  const { actions: projectActions, state: projectState } = useDeskProjectWorkspace({
    focusedSetId: focusedLocalSetId,
    generationSetId: generationContextTool?.targetIds[0] ?? null,
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
    updateCardSetMetadata,
  } = projectActions;
  const {
    activeCardSet, activeCardSetId, allArtifactsSelected, allVisibleCardsSelected, availableFields, cardSets,
    displayCards, effectiveMoveTargetId, focusedCards, generationCards, generationSet,
    generatorSelectedBackingTemplateId, generatorSelectedTemplateId, organization, organizedGroups, otherSets, reflectiveGroupings,
    richTextHighlightColor, selectedCard, selectedCardIndex, selectedCards, selectionScope, sortedCards, templates,
    storedCards, visibleCards,
  } = projectState;
  const openContextTool = useCallback((setId: string, tool: Parameters<typeof navigateToTool>[1], context?: { designTemplateId?: string; generationCard?: DisplayCard }) => {
    const setCards = storedCards.filter((card) => card.setId === setId || (!card.setId && cardSets[0]?.id === setId));
    const card = getDeskToolCard(setCards, interactionSession.focusPath.artifactId, selectedCardIds, context?.generationCard?.uniqueId);
    setPendingTool({
      setId, tool, origin: interactionSession.focusPath,
      templateId: tool === 'design' ? context?.designTemplateId ?? card?.templateId : tool === 'generate' ? card?.templateId : undefined,
      backingTemplateId: tool === 'generate' ? card?.backingTemplateId : undefined,
    });
  }, [cardSets, interactionSession.focusPath, selectedCardIds, storedCards]);

  const templateSourceFailure = projection.failures.find((failure) => failure.id === 'published-library');
  useEffect(() => {
    if (!pendingTool) return;
    if (pendingTool.origin.setId !== interactionSession.focusPath.setId
      || pendingTool.origin.artifactId !== interactionSession.focusPath.artifactId
      || !cardSets.some((set) => set.id === pendingTool.setId)) {
      setPendingTool(null);
      return;
    }
    const missingTemplate = [pendingTool.templateId, pendingTool.backingTemplateId]
      .some((id) => id && !templates.some((template) => template.id === id));
    if (missingTemplate) {
      // A contextual tool depends on Templates, not the whole Desk. In
      // particular, a slow Drive/folder/draft request must not block it, while
      // a delayed catalog response must not be mistaken for a missing design.
      if (!projection.templateCatalogReady) return;
      toast({
        title: templateSourceFailure ? 'Template source unavailable' : 'Template not found',
        description: templateSourceFailure
          ? `${templateSourceFailure.message} Your cards are unchanged. Restore the source in Library, then open the tool again.`
          : 'This Set’s front or back Template was not found. Your cards are unchanged. Restore the Template in Library, then open the tool again.',
        variant: 'destructive',
      });
      setPendingTool(null);
      return;
    }
    setActiveCardSetId(pendingTool.setId);
    if (pendingTool.tool === 'design' && pendingTool.templateId) {
      setTemplateEditorSelectedTemplateId(pendingTool.templateId);
    } else if (pendingTool.tool === 'generate' && pendingTool.templateId) {
      setGeneratorSelectedTemplateId(pendingTool.templateId);
      setGeneratorSelectedBackingTemplateId(pendingTool.backingTemplateId ?? null);
    }
    trackCardForgeEvent('tool_opened', { object_kind: pendingTool.tool, input_method: 'direct' });
    navigateToTool(pendingTool.setId, pendingTool.tool);
    setPendingTool(null);
  }, [cardSets, interactionSession.focusPath, navigateToTool, pendingTool, projection.templateCatalogReady, setActiveCardSetId, setGeneratorSelectedBackingTemplateId, setGeneratorSelectedTemplateId, setTemplateEditorSelectedTemplateId, templateSourceFailure, templates, toast]);
  const activeWorkId = workItems.find((item) => item.references.localSetId === activeCardSetId)?.id
    ?? (projection.featuredItem && itemById.has(projection.featuredItem.id) ? projection.featuredItem.id : null);
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
  }, [focusedItemId, focusedItemName]);

  useEffect(() => {
    setLatestGeneratedIds([]);
  }, [focusedItemId]);

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
    if (!deskViewPreferences.ready && !deskViewPreferences.unavailable) return;
    const context = readSurfaceReturnContext(initialReturnContextKey);
    if (!context || context.kind !== 'desk') {
      returnContextRestoredRef.current = true;
      return;
    }
    if (context.focusedWorkId && !itemById.has(context.focusedWorkId)) return;
    returnContextRestoredRef.current = true;
    setQuery(context.query);
    deskViewPreferences.update((current) => ({
      ...current,
      views: context.deskViews?.length ? context.deskViews : current.views,
      sources: context.deskSources ?? (context.sourceFilter === 'all' || context.sourceFilter === 'connected' || context.sourceFilter === 'temporary' ? current.sources : [context.sourceFilter]),
      types: context.deskTypes ?? current.types,
      tags: context.deskTags ?? current.tags,
      tagMatch: context.deskTagMatch ?? current.tagMatch,
    }));
    const restoredSetId = context.focusedWorkId?.startsWith('set:') ? context.focusedWorkId.slice(4) : null;
    restoreFocusedContext({
      focusedWorkId: context.focusedWorkId,
      inspectorWorkId: context.inspectorWorkId && itemById.has(context.inspectorWorkId) ? context.inspectorWorkId : null,
      session: setCreatorLens(selectCreatorArtifacts(
        restoredSetId ? focusCreatorSet(createCreatorInteractionSession(), restoredSetId) : createCreatorInteractionSession(),
        context.selectedCardIds,
      ), { query: context.cardQuery, filterIds: context.tagFilter === 'all' ? [] : [context.tagFilter] }),
    });
    requestAnimationFrame(() => surfaceRef.current?.scrollTo({ top: context.scrollTop }));
  }, [deskViewPreferences, initialReturnContextKey, itemById, restoreFocusedContext]);

  const statuses = createDeskAccountStatuses({ accessStatus, isSignedIn, projection, securityStatus });

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
  const selectedWorkItems = useMemo(() => workItems.filter((item) => selectedDeskIds.includes(item.id)), [selectedDeskIds, workItems]);
  const updateSelectedWorkOrganization = useCallback((operation: AccountLibraryOrganizationOperation) => {
    selectedWorkItems.forEach((item) => {
      const patch = applyAccountLibraryOrganizationOperation(item.organization, operation);
      if (item.references.localSetId) updateCardSetMetadata(item.references.localSetId, patch);
      else projection.updatePersonalOrganization(item, patch);
    });
  }, [projection, selectedWorkItems, updateCardSetMetadata]);

  const focusWork = (item: AccountLibraryItem) => {
    trackCardForgeEvent('set_opened', { object_kind: 'set', input_method: 'direct' });
    if (!selectedDeskIds.includes(item.id)) {
      setInteractionSession((current) => selectCreatorDeskSets(current, [item.id], item.id));
    }
    if (item.references.localSetId) setActiveCardSetId(item.references.localSetId);
    setRenaming(false);
    focusWorkContext(item.id, item.references.localSetId ?? null);
    return { kind: 'navigation' as const, href: createDeskReturnHref(item.id) };
  };

  const createWork = (openDesign = false) => {
    const id = createCardSet();
    setCreateOpen(false);
    setRenaming(true);
    if (openDesign) {
      setActiveCardSetId(id);
      openContextTool(id, 'design');
    } else focusWorkContext(`set:${id}`, id);
  };

  const duplicateWork = (item: AccountLibraryItem) => {
    if (!item.references.localSetId) throw new Error('Choose a local Set to duplicate.');
    const duplicateId = duplicateCardSet(item.references.localSetId);
    if (!duplicateId) throw new Error('The Set could not be duplicated.');
    setRenaming(false);
    focusWorkContext(`set:${duplicateId}`, duplicateId);
    toast({ title: 'Work duplicated', description: 'The copied Set and its cards are independently editable.' });
    return duplicateId;
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

  const openContextStudio = (setId: string, tool: 'design' | 'output', designTemplateId?: string) => {
    openContextTool(setId, tool, { designTemplateId });
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
      deskViews: deskViewPreferences.preferences.views,
      deskSources: deskViewPreferences.preferences.sources,
      deskTypes: deskViewPreferences.preferences.types,
      deskTags: deskViewPreferences.preferences.tags,
      deskTagMatch: deskViewPreferences.preferences.tagMatch,
      sort: 'desk',
      selectedCardIds: nextSelectedCardIds,
      cardQuery,
      tagFilter,
      scrollTop: surfaceRef.current?.scrollTop ?? 0,
    });
    return createDeskReturnHref(workId, returnContext);
  };

  const openRemoteWork = async (item: AccountLibraryItem) => {
    if (item.references.campaignId || item.references.pipelineLineageId) {
      // The specialized owner is mounted as a contextual Desk tool. It keeps
      // the focused object and return scene intact instead of routing through
      // Library or inventing a local Set identity.
      setRemoteWorkspaceId(item.id);
      return { kind: 'tool-opened' as const, toolId: item.references.campaignId ? 'campaign' : 'published-work' };
    }
    return { kind: 'navigation' as const, href: await projection.openItem(item, createDeskStudioReturnTo(item.id)) };
  };

  const createPublishedWorkingCopy = useCallback(async (item: AccountLibraryItem) => {
    const packageUrl = item.references.pipelineSourceUrl;
    if (item.references.pipelineAssetType !== 'sets' || !packageUrl) return;
    try {
      const result = await createPublishedSetCopy({ packageUrl, expectedName: item.name });
      projection.refresh();
      setRemoteWorkspaceId(null);
      focusWorkContext(`set:${result.setId}`, result.setId);
      toast({ title: 'Editable Set copy created', description: `${result.setName} remains independent browser work while the publication stays immutable.` });
    } catch (error) {
      toast({ title: 'Published Set could not be copied', description: error instanceof Error ? error.message : 'CardForge could not create the editable Set copy.', variant: 'destructive' });
    }
  }, [focusWorkContext, projection, toast]);

  const { actions, detail, runAction } = useDeskActionRuntime({
    experience,
    focusedItem,
    inspectorItem,
    pinned: pinnedIds.includes((inspectorItem ?? focusedItem)?.id ?? ''),
    commands: {
      createWork: openCreateMenu,
      focusWork,
      openRemoteWork,
      togglePin,
      openGenerate: (setId) => openContextTool(setId, 'generate'),
      openOutput: (setId) => openContextStudio(setId, 'output'),
      openLocation: setLocationItem,
      openPipeline: openPipelineSubmission,
      renameWork: (item) => {
        focusWork(item);
        setRenaming(true);
      },
      duplicateWork,
      deleteWork: setPendingDeleteWork,
      manageLocation: () => {
        const href = '/account?section=library&tool=locations';
        projection.router.push(href);
        return { kind: 'navigation', href };
      },
    },
  });

  const openWorkLane = (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export', generationCard?: DisplayCard) => {
    if (!item.references.localSetId) {
      if (lane === 'open') void openRemoteWork(item).catch((error: unknown) => toast({ title: 'Work could not be opened', description: error instanceof Error ? error.message : 'The source is unavailable.', variant: 'destructive' }));
      else setLocationItem(item);
      return;
    }
    setActiveCardSetId(item.references.localSetId);
    if (lane === 'generate') {
      openContextTool(item.references.localSetId, 'generate', { generationCard });
      return;
    }
    openContextStudio(item.references.localSetId, lane === 'export' ? 'output' : 'design');
  };

  const workCards = (item: AccountLibraryItem): DisplayCard[] => item.references.localSetId
    ? displayCards.filter((card) => card.setId === item.references.localSetId || (!card.setId && cardSets[0]?.id === item.references.localSetId)).slice(0, 5)
    : [];
  const workTemplate = (item: AccountLibraryItem) => {
    if (!item.references.localSetId) return null;
    return workCards(item)[0]?.template ?? null;
  };
  const closeGenerate = () => closeContextTool();
  const showTemplateTool = (templateId?: string | null) => {
    const setId = generationSet?.id ?? focusedLocalSetId ?? activeCardSet?.id;
    if (setId) openContextStudio(setId, 'design', templateId ?? undefined);
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
    closeRemoteWorkspace: () => setRemoteWorkspaceId(null),
    createPublishedWorkingCopy,
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
    deskViewPreferences,
    detail,
    dirtyCloseRequested,
    dirtyCloseToDesk,
    duplicateWork,
    effectiveMoveTargetId,
    endDeskDrag,
    endDeskMarquee,
    focusWork,
    focusArtifactContext,
    focusedCards,
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
    projection: deskProjection,
    refreshDeskSources,
    query,
    removeGeneratedCards,
    reflectiveGroupings,
    renameDraft,
    renaming,
    richTextHighlightColor,
    remoteWorkspaceItem,
    runAction,
    searchRef,
    selectedCard,
    selectedCardIndex,
    selectedCards,
    selectedDeskIds,
    selectedWorkItems,
    selectDeskWork,
    selectionScope,
    setCardPositions,
    setCardQuery,
    setCardsTag,
    setActiveToolDirty,
    setGenerationToolDirty,
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
    requestDeskReturn,
    resetToDesk,
    shouldSuppressActivation,
    showGrid,
    showTemplateTool,
    snapToGrid,
    sourceFacets,
    tagFacets,
    typeFacets,
    activeDeskViews,
    availableDeskViews,
    sortedCards,
    sourceFilter,
    statuses,
    studioTool,
    surfaceRef,
    tagDraft,
    tagFilter,
    templates,
    togglePin,
    updateSelectedWorkOrganization,
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
