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
  type ActionOperationResult,
  type EnvironmentViewer,
} from '@/features/app-shell/client/environment';
import { createDeskReturnHref, normalizeStudioReturnTo, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { DEFAULT_EXPERIENCE_SETTINGS, type StudioAutosaveDelaySeconds } from '@/features/experience-settings/client';
import { getEditorPreferences, useEditorPreferences } from '@/features/editor-preferences/client';
import {
  shouldOfferGoogleDriveReconciliation,
  useGoogleDriveWorkingSession,
  type GoogleDriveWorkingSessionPhase,
} from '@/features/project/client/provider-google-drive';
import { prepareSelectedSet, useSpatialWorkspacePreferences, type PreparedSelectedSet } from '@/features/project/client/workspace';
import { getProjectPersistenceScope, type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { createPublishedSetCopy } from '@/features/project/client/published-sets';
import { createGoogleDriveProjectThumbnail } from '@/features/card-generator/client';
import { useWorkspaceUpdates } from '@/features/project/client/ui';
import { applyAccountLibraryOrganizationOperation, applyAccountLibraryPrivateOrganization, useAccountLibraryProjection, type AccountLibraryItem, type AccountLibraryOrganizationOperation, type AccountLibrarySource } from '@/features/storage-management/client';

import {
  getDeskToolCard,
  visibleWorkKinds,
  type DeskAccountStatus,
} from '../model/desk';
import { createDeskAccountStatuses } from '../model/accountStatuses';
import { isDeskSourceSnapshotReady, resolveDeskMissingFocus } from '../model/deskArrival';
import { getDeskSetPresentationFootprint } from '../model/deskSetFootprint';
import { useCreatorNavigation } from './useCreatorNavigation';
import { useArtifactCommands } from './useArtifactCommands';
import { useDeskActionRuntime } from './useDeskActionRuntime';
import { useDeskLayout } from './useDeskLayout';
import { useDeskArrival } from './useDeskArrival';
import { useDeskWorkDiscovery } from './useDeskWorkDiscovery';
import { useDeskViewPreferences, type DeskViewId } from './useDeskViewPreferences';
import { usePublishedSetStarters } from '@/features/project/client/new-set';
import { useDeskProjectWorkspace } from './useDeskProjectWorkspace';
import { useDeskMembership } from './useDeskMembership';

const driveWorkingNeedsAttention = (phase: GoogleDriveWorkingSessionPhase) => (
  phase === 'offline'
  || phase === 'read-only'
  || phase === 'remote-changed'
  || phase === 'recovery-required'
  || phase === 'error'
);

interface DeskControllerOptions {
  protectedEditWorkId?: string | null;
  defaultAutosaveDelaySeconds?: StudioAutosaveDelaySeconds;
  transitionToDesk?: (commit: () => void) => void;
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
  protectedEditWorkId,
  defaultAutosaveDelaySeconds = DEFAULT_EXPERIENCE_SETTINGS.studioAutosaveDelaySeconds,
  transitionToDesk,
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
  const workspaceUpdates = useWorkspaceUpdates();
  const updateSetIds = useMemo(() => new Set(workspaceUpdates.sets.filter((set) => set.pending > 0).map((set) => set.set.id)), [workspaceUpdates.sets]);
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
  const [returnContextResolved, setReturnContextResolved] = useState(!initialReturnContextKey);
  const initialToolHandledRef = useRef(false);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: experience.contributor.active, owner: experience.owner };
  const searchParams = useSearchParams();
  const outputReference = searchParams.get('outputRef');
  const handoffReference = outputReference ?? (searchParams.has('document')
    ? JSON.stringify([searchParams.get('document'), searchParams.get('revision')])
    : null);
  const [handledHandoffReference, setHandledHandoffReference] = useState<string | null>(null);
  const handoffPending = handoffReference !== null && handledHandoffReference !== handoffReference;
  const outputHandoffPending = outputReference !== null && handoffPending;
  const studioDocumentHandoffPending = outputReference === null && handoffPending;
  const studioDocumentTool: 'design' | 'output' = initialTool === 'output' ? 'output' : 'design';
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
  const reviewReturnRef = useRef<{focus:HTMLElement|null;itemId:string}|null>(null);
  const [reviewWork, setReviewWork] = useState<AccountLibraryItem | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [preparationState, setPreparationStatus] = useState<{ scope: ProjectPersistenceScope; id: string; name: string; operation: 'add' | 'remove' | 'open'; phase: 'preparing' | 'ready' | 'error'; setId?: string; message?: string } | null>(null);
  const preparationStatus = preparationState?.scope === persistenceScope ? preparationState : null;
  const preparingWorkId = preparationStatus?.phase === 'preparing' ? preparationStatus.id : null;
  useEffect(() => { setPreparationStatus(null); }, [persistenceScope]);
  const preparingWorkRef = useRef<string | null>(null);
  const {
    navigationReady,
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
    returnToSet,
    restoreFocusedContext,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setInspectorWorkId,
    setInteractionSession,
  } = useCreatorNavigation({ initialFocusedWorkId, initialFocusedArtifactId, transitionToDesk, toolLayerOwnsHistory: Boolean(reviewWork) });
  const deskMounted = useRef(false);
  useEffect(() => { deskMounted.current = true; return () => { deskMounted.current = false; }; }, []);
  const openContext = useRef({ scope: persistenceScope, session: interactionSession });
  openContext.current = { scope: persistenceScope, session: interactionSession };
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
  const tagFilters = interactionSession.lens.filterIds;
  const tagFilter = tagFilters[0] ?? 'all';
  const setTagFilters = useCallback((values: string[]) => setInteractionSession((current) => setCreatorLens(current, { ...current.lens, filterIds: values })), [setInteractionSession]);
  const setTagFilter = useCallback((value: string) => setTagFilters(value === 'all' ? [] : [value]), [setTagFilters]);
  const [pendingDeleteWork, setPendingDeleteWork] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteCards, setPendingDeleteCards] = useState<DisplayCard[]>([]);
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);
  const [remoteWorkspaceId, setRemoteWorkspaceId] = useState<string | null>(null);
  const [latestGeneratedIds, setLatestGeneratedIds] = useState<string[]>([]);
  const {
    showGrid,
    snapToGrid,
    ready: spatialPreferencesReady,
    unavailable: spatialPreferencesUnavailable,
    setShowGrid,
    setSnapToGrid,
  } = useSpatialWorkspacePreferences();

  const allWorkItems = useMemo(() => applyAccountLibraryPrivateOrganization([
    ...projection.items,
    ...discoveredWork.items,
  ], projection.privateOrganization).filter((item) => (
    visibleWorkKinds.has(item.kind)
  )), [discoveredWork.items, projection.items, projection.privateOrganization]);
  const deviceWorkspaceReady = projection.sourceStatuses.some((source) => source.id === 'workspace' && source.phase === 'ready');
  const localSetIds = useMemo(() => projection.items.flatMap((item) => item.references.localSetId ? [item.references.localSetId] : []), [projection.items]);
  const deskMembership = useDeskMembership(persistenceScope, deviceWorkspaceReady, localSetIds);
  const addDeskMembership = deskMembership.add;
  const placeOnDesk = useCallback(async (setId: string) => {
    await addDeskMembership(setId);
  }, [addDeskMembership]);
  const placeCreatedSet = useCallback((setId: string) => {
    void placeOnDesk(setId).catch(() => toast({ title: 'Desk placement could not be saved', description: 'Your Set is still on this device. Check browser storage and try again.', variant: 'destructive' }));
  }, [placeOnDesk, toast]);
  const placePreparedSet = useCallback(async (setId: string) => {
    try {
      await placeOnDesk(setId);
    } catch {
      projection.refresh();
      throw new Error('The Set was opened on this device, but its Desk placement could not be saved. Your work is still available in Library; check browser storage before trying again.');
    }
  }, [placeOnDesk, projection]);
  const workItems = useMemo(() => allWorkItems.filter((item) => {
    if (item.kind !== 'set') return true;
    const id = item.references.localSetId;
    if (!id) return false;
    return item.id === focusedWorkId || deskMembership.status !== 'ready' || deskMembership.ids.includes(id);
  }), [allWorkItems, deskMembership.ids, deskMembership.status, focusedWorkId]);
  // Deep links and handoffs may focus local work before placement is updated.
  const itemById = useMemo(() => new Map(allWorkItems.map((item) => [item.id, item])), [allWorkItems]);
  const focusedItem = focusedWorkId ? itemById.get(focusedWorkId) ?? null : null;
  const focusedPlacementAttempt = useRef<object | null>(null);
  const [focusedPlacementSettled, setFocusedPlacementSettled] = useState<object | null>(null);
  const focusedPlacementKey = focusedItem?.references.localSetId ? `${persistenceScope}:${focusedItem.references.localSetId}` : null;
  const focusedPlacementIdentity = useMemo(() => focusedPlacementKey ? {} : null, [focusedPlacementKey]);
  useEffect(() => {
    const setId = focusedItem?.references.localSetId;
    if (!setId || !focusedPlacementIdentity) { focusedPlacementAttempt.current = null; return; }
    if (deskMembership.status !== 'ready') return;
    const attempt = focusedPlacementIdentity;
    if (focusedPlacementAttempt.current === attempt) return;
    focusedPlacementAttempt.current = attempt;
    if (deskMembership.ids.includes(setId)) {
      setFocusedPlacementSettled(attempt);
      return;
    }
    void placeOnDesk(setId).catch(() => toast({ title: 'Desk placement could not be saved', description: 'Your Set is still on this device. Check browser storage and try again.', variant: 'destructive' }))
      .finally(() => { if (focusedPlacementAttempt.current === attempt) setFocusedPlacementSettled(attempt); });
  }, [deskMembership.ids, deskMembership.status, focusedItem, focusedPlacementIdentity, placeOnDesk, toast]);
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
    positions: deskPositions,
    preferencesResolved: deskLayoutPreferencesResolved,
    sceneReady: deskSceneReady,
    shouldSuppressActivation,
    sourceFacets,
    tagFacets,
    typeFacets,
    visibleWork,
    workGridRef,
    workWorldRef,
    worldSize: deskWorldSize,
  } = useDeskLayout({
    persistenceScope,
    workItems,
    query,
    sourceFilters: deskViewPreferences.preferences.sources,
    typeFilters: deskViewPreferences.preferences.types,
    tagFilters: deskViewPreferences.preferences.tags,
    tagMatch: deskViewPreferences.preferences.tagMatch,
    viewIds: activeDeskViews,
    updatesOnly: Boolean(deskViewPreferences.preferences.updatesOnly),
    updateSetIds,
    focused: Boolean(focusedItem),
    focusedItemId: focusedItem?.id ?? null,
    snapToGrid,
    selectedIds: selectedDeskIds,
    onSelectionChange: (ids, anchorId) => setInteractionSession((current) => selectCreatorDeskSets(current, ids, anchorId)),
  });
  const inspectorItem = inspectorWorkId ? itemById.get(inspectorWorkId) ?? null : null;
  const focusedLocalSetId = focusedItem?.references.localSetId ?? null;
  const savingPreferences = useEditorPreferences();
  const driveWorkingSession = useGoogleDriveWorkingSession({
    autosave: {
      enabled: savingPreferences.googleDriveAutosaveEnabled,
      delaySeconds: savingPreferences.googleDriveAutosaveDelaySeconds ?? defaultAutosaveDelaySeconds,
      isEnabled: () => getEditorPreferences(persistenceScope).googleDriveAutosaveEnabled,
    },
    setId: focusedLocalSetId,
    name: focusedItem?.name ?? 'CardForge Set',
    enabled: Boolean(focusedLocalSetId),
    renderThumbnail: createGoogleDriveProjectThumbnail,
  });
  const driveWorkingState = driveWorkingSession.state;
  const workingLocationStatus = driveWorkingState.phase === 'unlinked' ? null : {
    phase: driveWorkingState.phase,
    message: driveWorkingState.message,
    needsAttention: driveWorkingNeedsAttention(driveWorkingState.phase),
    onSave: focusedItem?.references.driveFileId && isSignedIn && experience.capabilities.canUseProjectFiles
      ? () => { void driveWorkingSession.saveNow(); }
      : undefined,
    canSave: driveWorkingState.phase === 'clean' || driveWorkingState.phase === 'dirty',
    onRepair: driveWorkingState.phase === 'recovery-required'
      ? () => { void driveWorkingSession.repairLink(); }
      : undefined,
    onReconcile: shouldOfferGoogleDriveReconciliation(driveWorkingState.phase)
      ? () => { void driveWorkingSession.reconcile(); }
      : undefined,
  };
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
  // The existing Workbench must mount before the exact incoming Set exists locally.
  // Do not choose an unrelated active Set while that handoff is still unresolved.
  const studioTool = outputHandoffPending || studioDocumentHandoffPending
    ? { setId: null, tool: outputHandoffPending ? 'output' as const : studioDocumentTool, templateId: null }
    : activeContextTool && activeContextSetId && (activeContextTool.toolId === 'design' || activeContextTool.toolId === 'output')
    ? { setId: activeContextSetId, tool: activeContextTool.toolId, templateId: activeContextTool.targetIds[1] ?? null }
    : null;
  const { actions: projectActions, state: projectState } = useDeskProjectWorkspace({
    focusedSetId: focusedLocalSetId,
    generationSetId: generationContextTool?.targetIds[0] ?? null,
    selectedCardIds,
    latestGeneratedIds,
    cardQuery,
    tagFilters,
    moveTargetId,
  });
  const {
    addGeneratedCards, closeEditDialog, commitTemplateChange, createCardSet, deleteCardSet, duplicateCardSet, removeGeneratedCards, renameCardSet, reviseGeneratedCards,
    setActiveCardSetId, setCardPositions, setCardsTag, setGeneratorSelectedBackingTemplateId,
    setGeneratorSelectedTemplateId, setTemplateEditorSelectedTemplateId, undoLastBulkRevision, unreferenceTemplateFromCardSet,
    updateCardSetMetadata,
  } = projectActions;
  const {
    activeCardSet, activeCardSetId, allArtifactsSelected, allVisibleCardsSelected, availableFields, cardSets,
    displayCards, effectiveMoveTargetId, focusedCards, focusedSet, generationCards, generationSet,
    generatorSelectedBackingTemplateId: storedGeneratorSelectedBackingTemplateId, generatorSelectedTemplateId: storedGeneratorSelectedTemplateId, organization, organizedGroups, otherSets, reflectiveGroupings,
    richTextHighlightColor, selectedCard, selectedCardIndex, selectedCards, selectionScope, sortedCards, templates,
    storedCards, visibleCards,
  } = projectState;
  const generationTargetTemplateId = generationContextTool?.targetIds[1] ?? null;
  const generationTargetBackingId = generationContextTool?.targetIds[2] ?? null;
  const initializedGenerateContextRef = useRef<{ instanceId: string; targetKey: string } | null>(null);
  // A tool instance ID is stable for desk/tool/set, not unique per opening.
  // Clear closed sessions and initialize only a new context or explicit retarget.
  // User selection changes leave targetIds alone, so they never replay history.
  useEffect(() => {
    const instanceId = generationContextTool?.instanceId;
    if (!instanceId) {
      initializedGenerateContextRef.current = null;
      return;
    }
    if (!generationTargetTemplateId || !projection.templateCatalogReady) return;
    const targetKey = JSON.stringify([generationTargetTemplateId, generationTargetBackingId]);
    if (initializedGenerateContextRef.current?.instanceId === instanceId
      && initializedGenerateContextRef.current.targetKey === targetKey) return;
    if (!templates.some((template) => template.id === generationTargetTemplateId)) return;
    if (generationTargetBackingId && !templates.some((template) => template.id === generationTargetBackingId)) return;
    initializedGenerateContextRef.current = { instanceId, targetKey };
    setGeneratorSelectedTemplateId(generationTargetTemplateId);
    setGeneratorSelectedBackingTemplateId(generationTargetBackingId);
  }, [generationContextTool?.instanceId, generationTargetTemplateId, generationTargetBackingId,
    projection.templateCatalogReady, templates, setGeneratorSelectedTemplateId, setGeneratorSelectedBackingTemplateId]);
  const generatorSelectedTemplateId = storedGeneratorSelectedTemplateId;
  const generatorSelectedBackingTemplateId = storedGeneratorSelectedBackingTemplateId;
  const focusedArtifactIdForArrival = interactionSession.focusPath.artifactId;
  const focusedDestinationReady = Boolean(focusedItem)
    && (!focusedArtifactIdForArrival || focusedCards.some((card) => card.uniqueId === focusedArtifactIdForArrival));
  const initialSourceSnapshotReady = isDeskSourceSnapshotReady(deskProjection.isLoading, deskProjection.sourceStatuses);
  const missingFocus = resolveDeskMissingFocus({
    requestedWorkId: focusedWorkId,
    workAvailable: Boolean(focusedItem),
    sourceSnapshotReady: initialSourceSnapshotReady,
    sources: deskProjection.sourceStatuses,
    sourceFailed: deskProjection.failures.length > 0,
  });
  const arrivalAcquisitionReady = initialSourceSnapshotReady
    && (!deviceWorkspaceReady || deskMembership.status !== 'loading')
    && (!focusedPlacementIdentity || deskMembership.status !== 'ready' || focusedPlacementSettled === focusedPlacementIdentity)
    && (projection.privateOrganizationReady || projection.privateOrganizationUnavailable)
    && (deskViewPreferences.ready || deskViewPreferences.unavailable)
    && deskLayoutPreferencesResolved
    && (spatialPreferencesReady || spatialPreferencesUnavailable)
    && returnContextResolved;
  const deskArrival = useDeskArrival({
    scopeKey: persistenceScope,
    acquisitionReady: arrivalAcquisitionReady,
    compositionReady: focusedItem ? focusedDestinationReady : deskSceneReady,
  });

  const recoverMissingWork = useCallback((reason: 'missing' | 'unavailable') => {
    // Return through the normal navigation owner, including dirty-tool protection.
    // Source failures remain on the Desk; they are never treated as an empty read.
    initialToolHandledRef.current = true;
    requestDeskReturn();
    toast({
      title: reason === 'unavailable' ? 'Requested work could not be opened' : 'Work not found in this workspace',
      description: reason === 'unavailable'
        ? 'A work source needs attention. Your current Desk is shown below; restore or retry the source to open the work. Existing work is unchanged.'
        : 'This link does not match work available in the current browser workspace. Your current Desk is unchanged.',
      variant: 'destructive',
    });
  }, [requestDeskReturn, toast]);
  useEffect(() => {
    if (!navigationReady || !returnContextResolved || !missingFocus || (protectedEditWorkId && focusedWorkId === protectedEditWorkId)) return;
    recoverMissingWork(missingFocus);
  }, [focusedWorkId, missingFocus, navigationReady, protectedEditWorkId, recoverMissingWork, returnContextResolved]);

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
    const targetIds = pendingTool.tool === 'design'
      ? pendingTool.templateId ? [pendingTool.templateId] : []
      : pendingTool.tool === 'generate' && pendingTool.templateId
        ? [pendingTool.templateId, ...(pendingTool.backingTemplateId ? [pendingTool.backingTemplateId] : [])]
        : [];
    trackCardForgeEvent('tool_opened', { object_kind: pendingTool.tool, input_method: 'direct' });
    navigateToTool(pendingTool.setId, pendingTool.tool, targetIds);
    setPendingTool(null);
  }, [cardSets, interactionSession.focusPath, navigateToTool, pendingTool, projection.templateCatalogReady, setActiveCardSetId, templateSourceFailure, templates, toast]);
  const activeWorkId = workItems.find((item) => item.references.localSetId === activeCardSetId)?.id
    ?? (projection.featuredItem && itemById.has(projection.featuredItem.id) ? projection.featuredItem.id : null);
  const focusedItemId = focusedItem?.id ?? null;
  const focusedItemName = focusedItem?.name ?? '';
  const publishedSetStarters = usePublishedSetStarters({
    focusCreatedSet: (setId) => { placeCreatedSet(setId); focusWorkContext(`set:${setId}`, setId); },
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
    if (!navigationReady || initialToolHandledRef.current || !initialTool || outputReference !== null || studioDocumentHandoffPending) return;
    if (initialReturnContextKey && !returnContextRestoredRef.current) return;
    const targetSetId = focusedWorkId ? focusedLocalSetId : activeCardSetId;
    if (!targetSetId) return;
    initialToolHandledRef.current = true;
    // Reload restores the complete tool snapshot before replaying URL intent.
    // Do not push a duplicate history entry for the already-restored tool:
    // otherwise the first Done goes back to the same tool instead of the Set.
    if (interactionSession.focusPath.setId === targetSetId
      && interactionSession.toolStack.at(-1)?.toolId === initialTool) return;
    setActiveCardSetId(targetSetId);
    openContextTool(targetSetId, initialTool);
  }, [activeCardSetId, focusedLocalSetId, focusedWorkId, initialReturnContextKey, initialTool, outputReference, studioDocumentHandoffPending, interactionSession.focusPath.setId, interactionSession.toolStack, navigationReady, openContextTool, setActiveCardSetId]);

  useEffect(() => {
    if (!initialReturnContextKey || returnContextRestoredRef.current) return;
    if (!navigationReady) return;
    if (!deskViewPreferences.ready && !deskViewPreferences.unavailable) return;
    const context = readSurfaceReturnContext(initialReturnContextKey);
    if (!context || context.kind !== 'desk') {
      returnContextRestoredRef.current = true;
      setReturnContextResolved(true);
      return;
    }
    if (context.focusedWorkId && !itemById.has(context.focusedWorkId)) {
      const missingReturnFocus = resolveDeskMissingFocus({
        requestedWorkId: context.focusedWorkId,
        workAvailable: false,
        sourceSnapshotReady: initialSourceSnapshotReady,
        sources: deskProjection.sourceStatuses,
        sourceFailed: deskProjection.failures.length > 0,
      });
      if (!missingReturnFocus) return;
      returnContextRestoredRef.current = true;
      setReturnContextResolved(true);
      recoverMissingWork(missingReturnFocus);
      return;
    }
    returnContextRestoredRef.current = true;
    setReturnContextResolved(true);
    setQuery(context.query);
    deskViewPreferences.update((current) => ({
      ...current,
      views: context.deskViews?.length ? context.deskViews : current.views,
      sources: context.deskSources ?? (context.sourceFilter === 'all' || context.sourceFilter === 'connected' || context.sourceFilter === 'temporary' ? current.sources : [context.sourceFilter]),
      types: context.deskTypes ?? current.types,
      tags: context.deskTags ?? current.tags,
      tagMatch: context.deskTagMatch ?? current.tagMatch,
      updatesOnly: context.updatesOnly ?? current.updatesOnly,
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
  }, [deskProjection.failures.length, deskProjection.sourceStatuses, deskViewPreferences, initialReturnContextKey, initialSourceSnapshotReady, itemById, navigationReady, recoverMissingWork, restoreFocusedContext]);

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
      updatesOnly: Boolean(deskViewPreferences.preferences.updatesOnly),
      sort: 'desk',
      selectedCardIds: nextSelectedCardIds,
      cardQuery,
      tagFilter,
      scrollTop: surfaceRef.current?.scrollTop ?? 0,
    });
    return createDeskReturnHref(workId, returnContext);
  };

  const openRemoteWork = async (item: AccountLibraryItem): Promise<ActionOperationResult> => {
    if (preparingWorkRef.current) {
      throw new Error('Another work source is still opening. Let it finish before opening a different source.');
    }
    preparingWorkRef.current = item.id;
    setPreparationStatus({ scope: persistenceScope, id: item.id, name: item.name, operation: 'open', phase: 'preparing' });
    const captured = openContext.current;
    const ensureCurrent = () => {
      if (!deskMounted.current || getProjectPersistenceScope() !== captured.scope || openContext.current.scope !== captured.scope || openContext.current.session !== captured.session) {
        throw new Error('Your Desk context changed while the Set was opening. Check Library before trying again.');
      }
    };
    try {
      if (item.references.campaignId || item.references.pipelineLineageId) {
        focusWorkContext(item.id, null);
        setRemoteWorkspaceId(item.id);
        return { kind: 'tool-opened', toolId: item.references.campaignId ? 'campaign' : 'published-work' };
      }
      if (item.kind === 'set' && (item.references.driveFileId || item.references.localFolderWorkId)) {
        const prepared = await prepareSelectedSet(item, { assertCurrent: ensureCurrent });
        if (prepared.driveBinding) projection.recordDriveWorkBinding(prepared.driveBinding);
        ensureCurrent();
        await placePreparedSet(prepared.setId);
        ensureCurrent();
        setActiveCardSetId(prepared.setId);
        projection.refresh();
        focusWorkContext(`set:${prepared.setId}`, prepared.setId);
        return { kind: 'navigation', href: createDeskReturnHref(`set:${prepared.setId}`) };
      }
      const href = await projection.openItem(item, createDeskStudioReturnTo(item.id));
      return { kind: 'navigation', href };
    } finally {
      preparingWorkRef.current = null;
      setPreparationStatus((current) => current?.id === item.id ? null : current);
    }
  };

  const addLibrarySetToDesk = async (item: AccountLibraryItem) => {
    if (preparingWorkRef.current) throw new Error('Another Set is still being prepared. Let it finish before adding the next one.');
    preparingWorkRef.current = item.id;
    setPreparationStatus({ scope: persistenceScope, id: item.id, name: item.name, operation: 'add', phase: 'preparing' });
    const scope = persistenceScope;
    try {
      const prepared = await prepareSelectedSet(item, { requireSingleSet: true, preserveCurrent: true });
      if (getProjectPersistenceScope() !== scope) throw new Error('The active account changed while preparing this Set. Reopen it in the intended account.');
      if (prepared.driveBinding) projection.recordDriveWorkBinding(prepared.driveBinding);
      await placePreparedSet(prepared.setId);
      if (getProjectPersistenceScope() !== scope) throw new Error('The active account changed while placing this Set. Reopen the intended account to check Desk.');
      projection.refresh();
      if (deskMounted.current) setPreparationStatus({ scope, id: item.id, name: item.name, operation: 'add', phase: 'ready', setId: prepared.setId });
    } catch (error) {
      if (deskMounted.current && getProjectPersistenceScope() === scope) setPreparationStatus({ scope, id: item.id, name: item.name, operation: 'add', phase: 'error', message: error instanceof Error ? error.message : 'This Set could not be prepared. Existing work is unchanged.' });
      throw error;
    } finally {
      preparingWorkRef.current = null;
    }
  };

  const removeSetFromDesk = async (item: AccountLibraryItem) => {
    if (!item.references.localSetId) return;
    if (preparingWorkRef.current) throw new Error('Another Set is still being prepared. Let it finish before changing Desk placement.');
    const scope = persistenceScope;
    preparingWorkRef.current = item.id;
    setPreparationStatus({ scope, id: item.id, name: item.name, operation: 'remove', phase: 'preparing' });
    try {
      await deskMembership.remove(item.references.localSetId);
      if (getProjectPersistenceScope() !== scope) throw new Error('The active account changed. Reopen the intended account to check Desk placement.');
      setInteractionSession((current) => selectCreatorDeskSets(current, current.deskSelection.filter((id) => id !== item.id), current.deskSelectionAnchorId));
      if (deskMounted.current) setPreparationStatus({ scope, id: item.id, name: item.name, operation: 'remove', phase: 'ready', setId: item.references.localSetId });
    } catch (error) {
      if (deskMounted.current && getProjectPersistenceScope() === scope) setPreparationStatus({ scope, id: item.id, name: item.name, operation: 'remove', phase: 'error', message: error instanceof Error ? error.message : 'Desk placement could not be saved. Your work is unchanged.' });
      throw error;
    } finally {
      preparingWorkRef.current = null;
    }
  };

  const focusWork = (item: AccountLibraryItem): ActionOperationResult => {
    trackCardForgeEvent('set_opened', { object_kind: 'set', input_method: 'direct' });
    setRenaming(false);
    if (item.references.localSetId) {
      let prepared: PreparedSelectedSet;
      try {
        prepared = prepareSelectedSet({ ...item, references: { ...item.references, localSetId: item.references.localSetId } });
      } catch (error) {
        toast({ title: 'Set could not be opened', description: error instanceof Error ? error.message : 'The selected Set is unavailable.', variant: 'destructive' });
        return { kind: 'cancelled' };
      }
      if (!selectedDeskIds.includes(item.id)) {
        setInteractionSession((current) => selectCreatorDeskSets(current, [item.id], item.id));
      }
      if (!deskMembership.ids.includes(prepared.setId)) placeCreatedSet(prepared.setId);
      setActiveCardSetId(prepared.setId);
      focusWorkContext(item.id, prepared.setId);
      return { kind: 'navigation', href: createDeskReturnHref(item.id) };
    }
    void openRemoteWork(item).catch((error: unknown) => {
      toast({
        title: 'Work could not be prepared',
        description: error instanceof Error ? error.message : 'The connected source is unavailable.',
        variant: 'destructive',
      });
    });
    return { kind: 'tool-opened', toolId: item.references.driveFileId ? 'drive-working-set' : item.references.localFolderWorkId ? 'folder-working-set' : 'source-work' };
  };

  const createWork = (openDesign = false) => {
    const id = createCardSet();
    placeCreatedSet(id);
    setCreateOpen(false);
    setRenaming(true);
    if (openDesign) {
      setActiveCardSetId(id);
      openContextTool(id, 'design');
    } else focusWorkContext(`set:${id}`, id);
  };

  const focusOpenedSetFile = (id: string) => {
    placeCreatedSet(id);
    setRenaming(false);
    focusWorkContext(`set:${id}`, id);
  };

  const duplicateWork = (item: AccountLibraryItem) => {
    if (!item.references.localSetId) throw new Error('Choose a local Set to duplicate.');
    const duplicateId = duplicateCardSet(item.references.localSetId);
    if (!duplicateId) throw new Error('The Set could not be duplicated.');
    placeCreatedSet(duplicateId);
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

  const completeOutputHandoff = useCallback((setId: string, reference: string) => {
    if (reference !== outputReference) return;
    placeCreatedSet(setId);
    initialToolHandledRef.current = true;
    setHandledHandoffReference(reference);
    setActiveCardSetId(setId);
    navigateToTool(setId, 'output');
  }, [navigateToTool, outputReference, placeCreatedSet, setActiveCardSetId, setHandledHandoffReference]);

  const completeStudioDocumentHandoff = useCallback(({ activeSetId: setId }: { activeSetId: string | null }) => {
    if (!setId || outputReference !== null) return;
    placeCreatedSet(setId);
    initialToolHandledRef.current = true;
    setHandledHandoffReference(handoffReference);
    navigateToTool(setId, studioDocumentTool);
  }, [handoffReference, navigateToTool, outputReference, placeCreatedSet, setHandledHandoffReference, studioDocumentTool]);

  const closeContextStudio = () => {
    setHandledHandoffReference(handoffReference);
    closeContextTool();
    requestAnimationFrame(() => cardStageRef.current?.focus());
  };
  const artifactCommands = useArtifactCommands({
    actions: projectActions,
    state: projectState,
    focusedSetId: focusedLocalSetId,
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

  const createPublishedWorkingCopy = useCallback(async (item: AccountLibraryItem) => {
    const packageUrl = item.references.pipelineSourceUrl;
    if (item.references.pipelineAssetType !== 'sets' || !packageUrl) return;
    try {
      const result = await createPublishedSetCopy({ packageUrl, expectedName: item.name });
      await placePreparedSet(result.setId);
      projection.refresh();
      setRemoteWorkspaceId(null);
      focusWorkContext(`set:${result.setId}`, result.setId);
      toast({ title: 'Editable Set copy created', description: `${result.setName} remains independent browser work while the publication stays immutable.` });
    } catch (error) {
      toast({ title: 'Published Set needs attention', description: error instanceof Error ? error.message : 'CardForge could not create the editable Set copy.', variant: 'destructive' });
    }
  }, [focusWorkContext, placePreparedSet, projection, toast]);

  const { actions, detail, actionError, runAction, runWorkAction } = useDeskActionRuntime({
    experience,
    focusedItem,
    inspectorItem,
    commands: {
      createWork: openCreateMenu,
      reviewUpdates: workspaceUpdates.openSet,
      reviewWork: item => { reviewReturnRef.current = {focus:document.activeElement instanceof HTMLElement ? document.activeElement : null,itemId:item.id}; setReviewWork(item); },
      focusWork,
      openRemoteWork,
      openGenerate: (setId) => openContextTool(setId, 'generate'),
      openOutput: (setId) => openContextStudio(setId, 'output'),
      openLocation: setLocationItem,
      openPipeline: openPipelineSubmission,
      renameWork: (item) => {
        if (focusWork(item).kind !== 'cancelled') setRenaming(true);
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

  const cardsBySetId = useMemo(() => {
    const bySet = new Map<string, DisplayCard[]>();
    const fallbackSetId = cardSets[0]?.id ?? null;
    displayCards.forEach((card) => {
      const setId = card.setId ?? fallbackSetId;
      if (!setId) return;
      bySet.set(setId, [...(bySet.get(setId) ?? []), card]);
    });
    return bySet;
  }, [cardSets, displayCards]);
  const allWorkCards = (item: AccountLibraryItem): DisplayCard[] => item.references.localSetId
    ? cardsBySetId.get(item.references.localSetId) ?? []
    : [];
  const workCards = (item: AccountLibraryItem): DisplayCard[] => allWorkCards(item).slice(0, 5);
  const workFootprint = (item: AccountLibraryItem) => getDeskSetPresentationFootprint(allWorkCards(item));
  const workTemplate = (item: AccountLibraryItem) => {
    if (!item.references.localSetId) return null;
    return allWorkCards(item)[0]?.template ?? null;
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
    setTagFilters([]);
    setLatestGeneratedIds(ids);
    requestAnimationFrame(() => cardStageRef.current?.focus());
  };

  return {
    actions,
    addLibrarySetToDesk,
    deskMembership,
    librarySetItems: projection.items.filter((item) => item.kind === 'set' && Boolean(item.references.localSetId || item.references.driveFileId || item.references.localFolderWorkId)),
    removeSetFromDesk,
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
    closeEditDialog,
    commitTemplateChange,
    createPublishedWorkingCopy,
    closeContextStudio,
    completeOutputHandoff,
    completeStudioDocumentHandoff,
    closeGenerate,
    closePipelineSubmission,
    confirmDirtyClose,
    commitRename,
    createWork,
    focusOpenedSetFile,
    deleteCardSet,
    deskArrival,
    deskPositions,
    deskSceneReady,
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
    focusedSet,
    workingLocationStatus,
    onWorkLocationChanged: () => {
      refreshDeskSources();
      void driveWorkingSession.reconcile();
    },
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
    reviewWork,
    closeReviewWork: () => { const restore=reviewReturnRef.current; setReviewWork(null); requestAnimationFrame(()=>{ const focus=restore?.focus?.isConnected ? restore.focus : document.getElementById(`set-info-${restore?.itemId}`) ?? document.getElementById(`set-${restore?.itemId}`); focus?.focus({preventScroll:true}); }); },
    pipelineSubmitSetId,
    preparingWorkId,
    preparationStatus,
    dismissPreparationStatus: () => setPreparationStatus(null),
    projection: deskProjection,
    refreshDeskSources,
    query,
    removeGeneratedCards,
    reflectiveGroupings,
    renameDraft,
    renaming,
    richTextHighlightColor,
    remoteWorkspaceItem,
    actionError,
    runAction,
    runWorkAction,
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
    setTemplateEditorSelectedTemplateId,
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
    setTagFilters,
    tagFilters,
    undoLastBulkRevision,
    unreferenceTemplateFromCardSet,
    requestHistoryBack,
    requestDeskReturn,
    resetToDesk,
    returnToSet,
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
    updateSelectedWorkOrganization,
    viewGeneratedCards,
    viewer,
    visibleCards,
    visibleWork,
    workCards,
    workFootprint,
    workGridRef,
    workWorldRef,
    deskWorldSize,
    workItems,
    workTemplate,
    zones,
    ...artifactCommands,
    ...publishedSetStarters,
  };
}
