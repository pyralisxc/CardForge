"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Boxes,
  Cloud,
  FileArchive,
  HardDrive,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  ENVIRONMENT_ZONES,
  deriveCreatorSurfaceContext,
  EnvironmentBoundaryNotice,
  EnvironmentShell,
  EnvironmentStatus,
  EnvironmentToolLayer,
} from '@/features/app-shell/client/environment';
import type { DesignToolIntent, WorkbenchBusinessIdentity } from '@/features/creator-workbench/client';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { PublicAuthControls } from '@/features/account/client/auth';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { hasCardBacking, type DisplayCard } from '@/domain/rendering';
import type { CardFace } from '@/domain/cards';
import { ArtifactScene, AuthoredObjectPreview } from '@/features/card-rendering/client';
import type { ContributorAccessSessionState } from '@/features/contributor-access/client';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import {
  requestBrowserWorkspaceRecovery,
  useBrowserStoragePersistence,
  useBrowserWorkspaceSaveStatus,
} from '@/features/project/client/ui';
import { useProjectStore } from '@/features/project/client/workspace';
import {
  getAccountLibraryWorkPreview,
  WorkLocationDialog,
  type AccountLibraryItem,
} from '@/features/storage-management/client';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

import {
  workSource,
  getCardTitle,
  workDetailRecord,
  type DeskAccountStatus,
} from '../model/desk';
import { DeskContextRail } from './DeskContextRail';
import { DeskOverviewSurface } from './DeskOverviewSurface';
import { FocusedWorkSurface } from './FocusedWorkSurface';
import { DeskDialogs } from './DeskDialogs';
import { useDeskController } from '../hooks/useDeskController';
import styles from './Desk.module.css';

const DeskToolLoading = () => (
  <div role="status" aria-live="polite" className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-[var(--cf-text-muted)]">
    Loading workspace tools…
  </div>
);

const PipelineContributionPanel = dynamic(() => import(
  '@/features/pipeline/client/contribution-panel'
).then((module) => module.PipelineContributionPanel), { loading: DeskToolLoading });
const DeskGenerationWorkspace = dynamic(() => import(
  '@/features/card-generator/client/generation-workspace'
).then((module) => module.GenerationWorkspace), { ssr: false, loading: DeskToolLoading });
const DeskDesignWorkspace = dynamic(() => import(
  '@/features/creator-workbench/client'
).then((module) => module.CreatorWorkbench), { ssr: false, loading: DeskToolLoading });
const DeskCampaignWorkspace = dynamic(() => import(
  '@/features/marketing-content/client'
).then((module) => module.CampaignLibraryWorkspace), { ssr: false, loading: DeskToolLoading });
const DeskPublishedWorkspace = dynamic(() => import(
  '@/features/pipeline/client'
).then((module) => module.OwnPublishedDeskWorkspace), { ssr: false, loading: DeskToolLoading });

export type { DeskAccountStatus } from '../model/desk';

export interface DeskProps {
  businessIdentity: WorkbenchBusinessIdentity;
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialFocusedWorkId?: string | null;
  initialFocusedArtifactId?: string | null;
  initialTool?: 'design' | 'generate' | 'output' | 'pipeline' | null;
  initialContributorAccess: ContributorAccessSessionState;
  initialReturnContextKey?: string | null;
  accessStatus?: DeskAccountStatus;
  securityStatus?: DeskAccountStatus;
  storageConnections?: ReactNode;
}

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

const workPreviewFallbackLabel = (item: AccountLibraryItem): string => {
  const preview = getAccountLibraryWorkPreview(item);
  if (preview.kind !== 'fallback') return '';
  if (preview.reason === 'permission-required') return 'Permission required for preview';
  if (preview.reason === 'unavailable') return 'Preview unavailable';
  return item.references.campaignId ? 'No media attached' : 'No visual preview';
};

function DeskWorkPreview({ item }: { item: AccountLibraryItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getAccountLibraryWorkPreview(item);
  const previewKey = preview.kind === 'image' ? preview.url : preview.kind === 'fallback' ? preview.reason : preview.kind;
  useEffect(() => setImageFailed(false), [previewKey]);
  if (preview.kind === 'image' && !imageFailed) {
    return <img src={preview.url} alt="" className={styles.remoteWorkPreview} onError={() => setImageFailed(true)} />;
  }
  return <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>{imageFailed ? 'Preview unavailable' : workPreviewFallbackLabel(item)}</span></div>;
}

const deskStorageStatusLabel = (sourceStatuses: readonly { phase: string }[]): string => {
  const phases = new Set(sourceStatuses.map((source) => source.phase).filter((phase) => phase !== 'ready' && phase !== 'empty'));
  if (!phases.size) return 'Storage ready';
  const labels: Record<string, string> = {
    loading: 'Storage checking',
    unavailable: 'Storage unavailable',
    'permission-required': 'Storage permission required',
    expired: 'Storage sign-in expired',
    incomplete: 'Storage partially loaded',
  };
  return [...phases].map((phase) => labels[phase] ?? 'Storage needs attention').join(' · ');
};

export function Desk({
  businessIdentity,
  persistenceScope,
  experience,
  initialFocusedWorkId,
  initialFocusedArtifactId,
  initialTool = null,
  initialContributorAccess,
  initialReturnContextKey,
  accessStatus,
  securityStatus,
  storageConnections,
}: DeskProps) {
  const { toast } = useToast();
  const browserSaveStatus = useBrowserWorkspaceSaveStatus();
  const browserStoragePersistence = useBrowserStoragePersistence();
  const [generationRevisionScopeIds, setGenerationRevisionScopeIds] = useState<string[]>([]);
  const [designIntent, setDesignIntent] = useState<DesignToolIntent | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);
  const [artifactEditId, setArtifactEditId] = useState<string | null>(null);
  const [artifactEditDirty, setArtifactEditDirty] = useState(false);
  const [artifactDiscardOpen, setArtifactDiscardOpen] = useState(false);
  const pendingArtifactExitRef = useRef<(() => void) | null>(null);
  const {
    actions,
    activeWorkId,
    addGeneratedCards,
    reviseGeneratedCards,
    allArtifactsSelected,
    allVisibleCardsSelected,
    applyNewTag,
    availableFields,
    beginDeskDrag,
    beginDeskMarquee,
    cardQuery,
    cardStageRef,
    closeRemoteWorkspace,
    createPublishedWorkingCopy,
    closeContextStudio,
    closeGenerate,
    closePipelineSubmission,
    commitRename,
    confirmDirtyClose,
    createFromPublishedSet,
    createOpen,
    createWork,
    creatingPublishedSetId,
    deleteCardSet,
    deskPositions,
    deskCamera,
    deskMarquee,
    deskViewPreferences,
    detail,
    dirtyCloseRequested,
    dirtyCloseToDesk,
    duplicateSelectedCards,
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
    moveSelectedCards,
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
    reflectiveGroupings,
    refreshDeskSources,
    requestDeskReturn,
    renameDraft,
    renaming,
    reorderSelectedCard,
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
    setActiveToolDirty,
    setGenerationToolDirty,
    setCardQuery,
    setCardsTag,
    setCreateOpen,
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
    setTagDraft,
    setTagFilter,
    undoLastBulkRevision,
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
    studioTool,
    surfaceRef,
    tagDraft,
    tagFilter,
    templates,
    togglePin,
    updateOrganization,
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
  } = useDeskController({
    persistenceScope,
    experience,
    initialFocusedWorkId,
    initialFocusedArtifactId,
    initialTool,
    initialReturnContextKey,
    accessStatus,
    securityStatus,
  });
  const remoteWorkspacePreview = remoteWorkspaceItem ? getAccountLibraryWorkPreview(remoteWorkspaceItem) : null;
  const storageStatusLabel = deskStorageStatusLabel(projection.sourceStatuses);
  const activeTool = interactionSession.toolStack.at(-1) ?? null;
  const focusedArtifactId = interactionSession.focusPath.artifactId;
  const focusedArtifact = focusedArtifactId
    ? focusedCards.find((card) => card.uniqueId === focusedArtifactId) ?? null
    : null;
  const artifactEditing = Boolean(focusedArtifactId && artifactEditId === focusedArtifactId);
  const primarySelectedSet = visibleWork.find((item) => selectedDeskIds.includes(item.id)) ?? null;
  const creatorSurface = deriveCreatorSurfaceContext({
    session: interactionSession,
    toolActive: Boolean(storageOpen || remoteWorkspaceItem || activeTool),
    activity: artifactEditing || activeTool?.toolId === 'design'
      ? 'edit'
      : storageOpen || remoteWorkspaceItem || activeTool
        ? 'task'
        : 'none',
  });
  const contextDepth = creatorSurface.depth;
  const presentation = creatorSurface.presentation;
  const toolName = storageOpen ? 'Locations & connections'
    : remoteWorkspaceItem?.references.campaignId ? 'Campaign workspace'
      : remoteWorkspaceItem?.references.pipelineLineageId ? 'Published work'
        : activeTool?.toolId === 'design' ? 'Design'
          : activeTool?.toolId === 'generate' ? (generationRevisionScopeIds.length ? 'Edit selected' : 'Generate')
            : activeTool?.toolId === 'output' ? 'Output'
              : activeTool?.toolId === 'pipeline' ? 'Pipeline'
                : undefined;
  const designCard = (card: DisplayCard, face: CardFace = 'front') => {
    const template = face === 'back' ? card.backingTemplate : card.template;
    if (!template?.id || !focusedLocalSetId) return;
    const project = useProjectStore.getState();
    const selected = selectedCards.some((candidate) => candidate.uniqueId === card.uniqueId) ? selectedCards : [card];
    const compatibleSelection = selected.every((candidate) => (
      face === 'back' ? candidate.backingTemplate?.id === template.id : candidate.template.id === template.id
    ));
    const artifactIds = compatibleSelection ? selected.map((candidate) => candidate.uniqueId) : [card.uniqueId];
    if (!compatibleSelection && selected.length > 1) {
      toast({
        title: 'Designing the focused Template',
        description: 'The selection uses different Templates, so this Design scope starts with the focused Artifact only. Edit one design group at a time to avoid changing unrelated layouts.',
      });
    }
    project.closeEditDialog();
    project.setTemplateEditorSelectedTemplateId(template.id);
    setDesignIntent({ kind: 'artifact-design', artifactIds, face });
    if (activeTool?.toolId !== 'design') openContextStudio(focusedLocalSetId, 'design', template.id);
  };
  useEffect(() => {
    if (artifactEditId && artifactEditId !== focusedArtifactId) {
      setArtifactEditId(null);
      setArtifactEditDirty(false);
    }
  }, [artifactEditId, focusedArtifactId]);
  const startArtifactEdit = (artifactId: string) => {
    setArtifactEditId(artifactId);
    setArtifactEditDirty(false);
  };
  const finishArtifactEdit = () => {
    setArtifactEditId(null);
    setArtifactEditDirty(false);
  };
  const requestArtifactExit = (afterExit: () => void) => {
    if (!artifactEditing || !artifactEditDirty) {
      finishArtifactEdit();
      afterExit();
      return;
    }
    pendingArtifactExitRef.current = afterExit;
    setArtifactDiscardOpen(true);
  };
  const confirmArtifactDiscard = () => {
    const afterExit = pendingArtifactExitRef.current;
    pendingArtifactExitRef.current = null;
    setArtifactDiscardOpen(false);
    finishArtifactEdit();
    afterExit?.();
  };
  const openSelectedRevision = () => {
    if (!focusedItem || !selectedCards.length) return;
    setGenerationRevisionScopeIds(selectedCards.map((card) => card.uniqueId));
    openWorkLane(focusedItem, 'generate', selectedCards[0]);
  };
  const closeDesignContext = () => {
    setDesignIntent(null);
    closeContextStudio();
  };
  const closeActiveTool = () => {
    if (storageOpen) { setStorageOpen(false); return; }
    if (remoteWorkspaceItem) { closeRemoteWorkspace(); return; }
    if (activeTool?.dirty) {
      setDirtyCloseRequested(true);
      return;
    }
    if (activeTool?.toolId === 'pipeline') closePipelineSubmission();
    else if (activeTool?.toolId === 'generate') { setGenerationRevisionScopeIds([]); closeGenerate(); }
    else closeDesignContext();
  };
  const storageNeedsAttention = projection.failures.length > 0
    || projection.sourceStatuses.some((source) => source.phase === 'loading' || source.phase === 'incomplete' || source.phase === 'unavailable' || source.phase === 'permission-required' || source.phase === 'expired');
  const saveStatusLabel = browserSaveStatus === 'saving'
    ? 'Saving local working copy…'
    : browserSaveStatus === 'failed'
      ? 'Local working copy not saved'
      : 'Local working copy saved';
  const protectLocalWork = async () => {
    const nextStatus = await browserStoragePersistence.requestPersistence();
    if (nextStatus === 'persistent') {
      toast({
        title: 'Local work protected',
        description: 'This browser granted stronger eviction protection. Keep a separate project backup for device loss or browser cleanup.',
      });
      return;
    }
    toast({
      title: nextStatus === 'best-effort' ? 'Browser kept best-effort storage' : 'Persistent storage unavailable',
      description: 'Your working copy remains saved locally, but this browser did not grant stronger eviction protection. Keep a separate project backup.',
    });
  };

  return (
    <ArtifactScene activeSetId={focusedLocalSetId}>
      <EnvironmentShell
        ariaLabel="CardForge Desk"
        brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
        viewer={viewer}
        zones={zones.length ? zones : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'desk' || zone.id === 'library' || zone.id === 'profile')}
        activeZone="desk"
        onActiveZoneNavigate={() => requestArtifactExit(requestDeskReturn)}
        viewportPolicy="desk"
        primaryScroll="contained"
        detail={detail}
        actionContext={focusedItem ? workDetailRecord(focusedItem) : null}
        actions={actions}
        accountControl={<PublicAuthControls />}
        showPrimaryAction={!focusedItem}
        contextBand={contextDepth === 'desk' ? undefined : <DeskContextRail
          depth={contextDepth}
          setName={focusedItem?.name}
          artifactName={focusedArtifact ? getCardTitle(focusedArtifact, selectedCardIndex) : undefined}
          toolName={toolName}
          toolDirty={activeTool?.dirty}
          localSet={Boolean(focusedLocalSetId)}
          pinned={Boolean(focusedItem && pinnedIds.includes(focusedItem.id))}
          renaming={renaming}
          renameDraft={renameDraft}
          selectedDeskCount={selectedDeskIds.length}
          selectedArtifactCount={selectedCards.length}
          openWorkCount={visibleWork.length}
          camera={deskCamera}
          onBack={() => { setRenaming(false); requestArtifactExit(returnToSet); }}
          onReturnToDesk={() => { setRenaming(false); requestArtifactExit(requestDeskReturn); }}
          onCloseTool={closeActiveTool}
          onOpenSelectedSet={() => { if (primarySelectedSet) focusWork(primarySelectedSet); }}
          onClearDeskSelection={() => setInteractionSession((current) => ({ ...current, deskSelection: [], deskSelectionAnchorId: null }))}
          onNudgeDeskSelection={nudgeDeskSelection}
          onRenameDraftChange={setRenameDraft}
          onCommitRename={commitRename}
          onToggleRenaming={() => setRenaming((current) => !current)}
          onOpenWork={() => { if (focusedItem) openWorkLane(focusedItem, 'open'); }}
          artifactId={focusedArtifactId ?? undefined}
          onOpenDesign={(face) => focusedArtifact ? requestArtifactExit(() => designCard(focusedArtifact, face)) : focusedLocalSetId && openContextStudio(focusedLocalSetId, 'design')}
          onDesignArtifactCopy={(face) => { if (focusedArtifact) designCard(focusedArtifact, face); }}
          onOpenGenerate={() => { if (focusedItem) { setGenerationRevisionScopeIds([]); openWorkLane(focusedItem, 'generate'); } }}
          onOpenLocation={() => { if (focusedItem) setLocationItem(focusedItem); }}
          onDuplicateWork={() => { if (focusedItem) duplicateWork(focusedItem); }}
          onOpenOutput={() => { if (focusedItem) openWorkLane(focusedItem, 'export'); }}
          onTogglePin={() => { if (focusedItem) togglePin(focusedItem.id); }}
          onInspect={() => { if (focusedItem) inspectItem(focusedItem); }}
          onDeleteWork={() => { if (focusedItem) setPendingDeleteWork(focusedItem); }}
          onEditArtifact={() => { if (focusedArtifactId) startArtifactEdit(focusedArtifactId); }}
          onReviseSelected={openSelectedRevision}
          onDuplicateSelected={duplicateSelectedCards}
          onDeleteSelected={() => setPendingDeleteCards(selectedCards)}
        />}
        presentation={presentation}
        focusReturnId={inspectorItem ? `set-info-${inspectorItem.id}` : undefined}
        surfaceRef={surfaceRef}
        statusContent={<>
          <EnvironmentStatus label={projection.isLoading ? 'Refreshing workspace' : `${workItems.length} open work`} tone={projection.isLoading ? 'warning' : 'neutral'} />
          <EnvironmentStatus label={storageStatusLabel} icon={HardDrive} tone={storageNeedsAttention ? 'warning' : 'success'} onClick={() => setStorageOpen(true)} title="Open Locations & connections" />
          <EnvironmentStatus label={saveStatusLabel} tone={browserSaveStatus === 'failed' ? 'danger' : browserSaveStatus === 'saving' ? 'warning' : 'success'} onClick={requestBrowserWorkspaceRecovery} title="Open browser workspace, recovery, and backup tools" />
          {browserStoragePersistence.status === 'best-effort' ? (
            <EnvironmentStatus label="Protect local work" icon={ShieldCheck} tone="warning" onClick={() => { void protectLocalWork(); }} title="Ask this browser for stronger local storage protection" />
          ) : null}
          {browserStoragePersistence.status === 'unavailable' ? (
            <EnvironmentStatus label="Storage protection unavailable" icon={ShieldCheck} tone="warning" title="This browser could not check persistent storage protection" />
          ) : null}
        </>}
        footerContent={focusedItem ? <span>{focusedItem.name}</span> : isSignedIn ? <span>Private creator desk</span> : (
          <span className="flex items-center gap-3">
            <span>Local creator desk</span>
            <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
            <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-up', '/account')} prefetch={false} onClick={markSignUpIntent}>Create account</Link>
          </span>
        )}
        onCommand={() => searchRef.current?.focus()}
        onAction={runAction}
        onCloseDetail={() => setInspectorWorkId(null)}
      >
        <div className={styles.spatialPlane} data-desk-plane data-scene-hidden={Boolean(studioTool?.tool === 'design')} data-focused={Boolean(focusedItem)} data-artifact-focused={Boolean(interactionSession.focusPath.artifactId)}>
          <DeskOverviewSurface
            workItemsCount={workItems.length}
            visibleWork={visibleWork}
            focusedItemId={focusedItem?.id ?? null}
            activeWorkId={activeWorkId}
            pinnedIds={pinnedIds}
            selectedIds={selectedDeskIds}
            positions={deskPositions}
            marquee={deskMarquee}
            isLoading={projection.isLoading}
            failure={projection.failures[0] ?? null}
            sourceStatuses={projection.sourceStatuses}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            query={query}
            searchRef={searchRef}
            sourceFilters={deskViewPreferences.preferences.sources}
            sourceFacets={sourceFacets}
            typeFilters={deskViewPreferences.preferences.types}
            typeFacets={typeFacets}
            tagFilters={deskViewPreferences.preferences.tags}
            tagFacets={tagFacets}
            tagMatch={deskViewPreferences.preferences.tagMatch}
            activeDeskViews={activeDeskViews}
            availableDeskViews={availableDeskViews}
            savedViews={deskViewPreferences.preferences.saved}
            activeRestrictionsLabel={`${activeDeskViews.map((view) => view === 'my-work' ? 'My work' : view === 'campaigns' ? 'Campaigns' : 'My published').join(' + ')}${deskViewPreferences.preferences.sources.length ? ` · ${deskViewPreferences.preferences.sources.length} source${deskViewPreferences.preferences.sources.length === 1 ? '' : 's'}` : ''}${deskViewPreferences.preferences.types.length ? ` · ${deskViewPreferences.preferences.types.length} type${deskViewPreferences.preferences.types.length === 1 ? '' : 's'}` : ''}${deskViewPreferences.preferences.tags.length ? ` · ${deskViewPreferences.preferences.tagMatch === 'all' ? 'all' : 'any'} ${deskViewPreferences.preferences.tags.length} tag${deskViewPreferences.preferences.tags.length === 1 ? '' : 's'}` : ''}`}
            selectedWorkItems={selectedWorkItems}
            workGridRef={workGridRef}
            workWorldRef={workWorldRef}
            camera={deskCamera}
            canUseProjectFiles={experience.capabilities.canUseProjectFiles}
            canSubmit={experience.contributor.canSubmit}
            renderWorkPreview={(item, featured, focused, face) => item.references.localSetId ? <AuthoredObjectPreview setId={item.references.localSetId} sceneHidden={focused} cards={workCards(item)} template={workTemplate(item)} label={item.name} size={featured ? 'large' : 'standard'} emptyLabel={workCards(item).length ? undefined : 'Empty Set'} face={face} /> : <DeskWorkPreview item={item} />}
            previewArtifactIds={(item) => workCards(item).map((card) => card.uniqueId)}
            canFlipWork={(item) => workCards(item).some(hasCardBacking)}
            renderFocusedSurface={(item) => <FocusedWorkSurface canUseProjectFiles={experience.capabilities.canUseProjectFiles}
              canExportClean={experience.capabilities.canExportClean}
              item={item}
              localSetId={focusedLocalSetId}
              remoteIcon={<WorkSourceIcon item={item} />}
              focusedCards={focusedCards}
              visibleCards={visibleCards}
              sortedCards={sortedCards}
              groups={organizedGroups}
              organization={organization}
              availableFields={availableFields}
              reflectiveGroupings={reflectiveGroupings}
              selectedCards={selectedCards}
              selectedCard={selectedCard}
              selectedCardIndex={selectedCardIndex}
              allVisibleSelected={allVisibleCardsSelected}
              allArtifactsSelected={allArtifactsSelected}
              selectionScope={selectionScope}
              otherSets={otherSets}
              moveTargetId={effectiveMoveTargetId}
              cardQuery={cardQuery}
              tagFilter={tagFilter}
              tagDraft={tagDraft}
              latestGeneratedIds={latestGeneratedIds}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              session={interactionSession}
              setSession={setInteractionSession}
              stageRef={cardStageRef}
              onFocusArtifact={focusArtifactContext}
              onOpenWork={() => openWorkLane(item, 'open')}
              onOpenDesign={() => focusedLocalSetId && openContextStudio(focusedLocalSetId, 'design')}
              onDesignTemplate={(templateId) => focusedLocalSetId && openContextStudio(focusedLocalSetId, 'design', templateId)}
              onOpenGenerate={() => { setGenerationRevisionScopeIds([]); openWorkLane(item, 'generate'); }}
              onCardQueryChange={setCardQuery}
              onOrganizationChange={updateOrganization}
              onTagFilterChange={setTagFilter}
              onShowGridChange={() => setShowGrid((value) => !value)}
              onSnapToGridChange={() => setSnapToGrid((value) => !value)}
              onSelectionChange={setSelectedCardIds}
              onReorderSelected={reorderSelectedCard}
              onMoveTargetChange={setMoveTargetId}
              onMoveSelected={moveSelectedCards}
              onEditSelected={(artifactId) => { if (artifactId) startArtifactEdit(artifactId); }}
              editingArtifactId={artifactEditId}
              onCancelArtifactEdit={() => requestArtifactExit(() => undefined)}
              onArtifactEditDirtyChange={setArtifactEditDirty}
              onSaveArtifact={(card) => { useProjectStore.getState().updateGeneratedCard(card); finishArtifactEdit(); }}
              onDesignArtifact={(card, face) => { finishArtifactEdit(); designCard(card, face); }}
              onDuplicateSelected={duplicateSelectedCards}
              onReviseSelected={openSelectedRevision}
              onDeleteSelected={() => setPendingDeleteCards(selectedCards)}
              onSetCardsTag={setCardsTag}
              onTagDraftChange={setTagDraft}
              onApplyNewTag={applyNewTag}
              onClearGenerated={() => { setLatestGeneratedIds([]); setSelectedCardIds([]); }}
              onMoveArtifacts={(positions) => focusedLocalSetId && setCardPositions(focusedLocalSetId, positions)}
            />}
            beginDrag={beginDeskDrag}
            beginMarquee={beginDeskMarquee}
            moveDrag={moveDeskDrag}
            moveMarquee={moveDeskMarquee}
            endDrag={endDeskDrag}
            endMarquee={endDeskMarquee}
            shouldSuppressActivation={shouldSuppressActivation}
            onSelectWork={selectDeskWork}
            onQueryChange={setQuery}
            onSourceFiltersChange={(sources) => deskViewPreferences.update((current) => ({ ...current, sources }))}
            onTypeFiltersChange={(types) => deskViewPreferences.update((current) => ({ ...current, types }))}
            onTagFiltersChange={(tags) => deskViewPreferences.update((current) => ({ ...current, tags }))}
            onTagMatchChange={(tagMatch) => deskViewPreferences.update((current) => ({ ...current, tagMatch }))}
            onDeskViewsChange={(views) => deskViewPreferences.update((current) => ({ ...current, views: views.length ? views : ['my-work'] }))}
            onApplySavedView={deskViewPreferences.applySaved}
            onSaveView={deskViewPreferences.saveCurrent}
            onResetViews={deskViewPreferences.reset}
            onUpdateSelectedOrganization={updateSelectedWorkOrganization}
            onShowGridChange={() => setShowGrid((value) => !value)}
            onSnapToGridChange={() => setSnapToGrid((value) => !value)}
            onFocusWork={focusWork}
            onTogglePin={togglePin}
            onOpenLane={openWorkLane}
            onOpenLocation={setLocationItem}
            onOpenPipeline={openPipelineSubmission}
            onDuplicate={duplicateWork}
            onInspect={inspectItem}
            onDelete={setPendingDeleteWork}
            onCreate={openCreateMenu}
            onRetry={refreshDeskSources}
            onNavigate={projection.router.push}
          />
        </div>
        {storageOpen ? <EnvironmentToolLayer
          id="desk-storage-title"
          eyebrow="Desk tool"
          title="Locations & connections"
          summary="Inspect storage health and choose project locations without leaving the Desk."
          closeLabel="Close locations and connections"
          onClose={() => setStorageOpen(false)}
          manageHistory={false}
          railOwned
        >
          {storageConnections ?? <EnvironmentBoundaryNotice title="Location tools are unavailable" message="CardForge could not compose the location controls. Existing work remains unchanged." />}
        </EnvironmentToolLayer> : null}
        {pipelineSubmitSetId ? <EnvironmentToolLayer
          id="desk-pipeline-submit-title"
          eyebrow="Desk tool"
          title="Send Set to the Pipeline"
          summary="Your Set remains on the Desk while you classify and submit this independent review candidate."
          closeLabel="Close Pipeline submission"
          onClose={closePipelineSubmission}
          manageHistory={false}
          presentation={activeTool?.presentation}
          railOwned
        >
          <PipelineContributionPanel compact initialSubmitSetId={pipelineSubmitSetId} />
        </EnvironmentToolLayer> : null}
        {remoteWorkspaceItem ? <EnvironmentToolLayer
          id="desk-remote-workspace-title"
          eyebrow="Desk workspace"
          title={remoteWorkspaceItem.references.campaignId ? `Campaign · ${remoteWorkspaceItem.name}` : `Published work · ${remoteWorkspaceItem.name}`}
          summary={remoteWorkspaceItem.references.campaignId ? 'This campaign stays in the Desk scene while its native workspace and tools load in context.' : 'This immutable Pipeline publication stays distinct from any working copy while you inspect its exact published identity.'}
          closeLabel="Return to Desk work"
          onClose={closeRemoteWorkspace}
          manageHistory={false}
          railOwned
        >
          {remoteWorkspaceItem.references.campaignId ? <DeskCampaignWorkspace initialCampaignId={remoteWorkspaceItem.references.campaignId} /> : remoteWorkspaceItem.references.pipelineLineageId ? <DeskPublishedWorkspace work={{
            assetType: remoteWorkspaceItem.references.pipelineAssetType ?? (remoteWorkspaceItem.kind === 'set' ? 'sets' : 'resource'),
            description: remoteWorkspaceItem.details.join(' · '), name: remoteWorkspaceItem.name,
            previewUrl: remoteWorkspacePreview?.kind === 'image' ? remoteWorkspacePreview.url : null,
            publishedAt: remoteWorkspaceItem.updatedAt,
            revision: remoteWorkspaceItem.revision, sourceNotes: remoteWorkspaceItem.references.pipelineSourceNotes ?? null,
          }} onCreateWorkingCopy={remoteWorkspaceItem.references.pipelineAssetType === 'sets' && remoteWorkspaceItem.references.pipelineSourceUrl ? () => void createPublishedWorkingCopy(remoteWorkspaceItem) : undefined} /> : null}
        </EnvironmentToolLayer> : null}
        {generationSet ? <EnvironmentToolLayer
          id="desk-generate-title"
          eyebrow="Desk tool"
          title={generationRevisionScopeIds.length ? `Edit ${generationRevisionScopeIds.length} selected Artifact${generationRevisionScopeIds.length === 1 ? '' : 's'}` : `Generate into ${generationSet.name}`}
          summary={generationRevisionScopeIds.length ? 'Only fields you touch are changed across this stable selection. Use Update from data when you want to reconcile a structured list.' : 'The Set stays open behind this tool. Generated cards return here as the active selection.'}
          closeLabel={generationRevisionScopeIds.length ? 'Close selection editor' : 'Close Generate'}
          onClose={() => { setGenerationRevisionScopeIds([]); closeGenerate(); }}
          manageHistory={false}
          dirty={interactionSession.toolStack.findLast((tool) => tool.toolId === 'generate')?.dirty ?? false}
          onDirtyCloseRequest={() => setDirtyCloseRequested(true)}
          presentation={activeTool?.presentation}
          railOwned
        >
          <DeskGenerationWorkspace
            onDirtyChange={setGenerationToolDirty}
            isLoadingTemplates={false}
            templates={templates.filter((template) => template.templateUsage !== 'back-preset')}
            backFaceTemplates={templates.filter((template) => template.templateUsage === 'back-preset')}
            activeCardSet={generationSet}
            generatorSelectedTemplateId={generatorSelectedTemplateId}
            generatorSelectedBackingTemplateId={generatorSelectedBackingTemplateId}
            richTextHighlightColor={richTextHighlightColor}
            generatedDisplayCards={generationCards}
            canExportClean={experience.capabilities.canExportClean}
            onOpenTemplateMaker={() => showTemplateTool()}
            onCreateMatchingBack={(formatSource) => { setDesignIntent({ kind: 'matching-back', formatSource }); showTemplateTool(); }}
            onEditSelectedBack={(templateId) => { setDesignIntent({ kind: 'edit-back', templateId }); showTemplateTool(templateId); }}
            onManageCardBacks={() => { setDesignIntent({ kind: 'manage-backs' }); showTemplateTool(); }}
            onBulkCardsGenerated={addGeneratedCards}
            onBulkCardsRevised={reviseGeneratedCards}
            onUndoBulkRevision={undoLastBulkRevision}
            revisionScopeIds={generationRevisionScopeIds}
            onViewGeneratedCards={viewGeneratedCards}
            onTemplateSelectionChange={setGeneratorSelectedTemplateId}
            onBackingTemplateSelectionChange={setGeneratorSelectedBackingTemplateId}
          />
        </EnvironmentToolLayer> : null}
        {studioTool ? <EnvironmentToolLayer
          id="desk-design-tool-title"
          eyebrow="Desk tool"
          title={studioTool.tool === 'output' ? 'Output Set' : 'Design'}
          summary="The focused Set remains on the Desk while this Studio tool operates on the current object and selection context."
          closeLabel="Close Studio tool"
          onClose={closeDesignContext}
          manageHistory={false}
          dirty={interactionSession.toolStack.at(-1)?.dirty ?? false}
          onDirtyCloseRequest={() => setDirtyCloseRequested(true)}
          presentation={activeTool?.presentation}
          railOwned
        >
          <DeskDesignWorkspace
            tool={studioTool.tool === 'output' ? 'output' : 'design'}
            onCloseTool={confirmDirtyClose}
            businessIdentity={businessIdentity}
            initialContributorAccess={initialContributorAccess}
            onDirtyChange={studioTool.tool === 'design' ? setActiveToolDirty : undefined}
            designIntent={designIntent}
            onDesignIntentConsumed={() => setDesignIntent(null)}
            onReturnToGenerator={closeActiveTool}
            contextSetId={studioTool.setId}
          />
        </EnvironmentToolLayer> : null}
      </EnvironmentShell>

      <WorkLocationDialog
        item={locationItem}
        open={Boolean(locationItem)}
        onOpenChange={(open) => { if (!open) setLocationItem(null); }}
        isSignedIn={isSignedIn}
        canUseProjectFiles={experience.capabilities.canUseProjectFiles}
        driveConnected={Boolean(projection.driveConnection?.connected && projection.driveConnection.rootFolderId)}
        localFolderSupported={projection.localFolderSupported}
        onChanged={projection.refresh}
      />

      <AlertDialog open={artifactDiscardOpen} onOpenChange={(open) => {
        setArtifactDiscardOpen(open);
        if (!open) pendingArtifactExitRef.current = null;
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved Artifact changes?</AlertDialogTitle>
            <AlertDialogDescription>Your saved Artifact will stay unchanged. Keep editing to save the current field changes first.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArtifactDiscard}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeskDialogs
        createOpen={createOpen}
        publishedSets={publishedSets}
        publishedSetsLoading={publishedSetsLoading}
        publishedSetsFailure={publishedSetsFailure}
        creatingPublishedSetId={creatingPublishedSetId}
        pendingDeleteWork={pendingDeleteWork}
        pendingDeleteCards={pendingDeleteCards}
        dirtyCloseRequested={dirtyCloseRequested}
        dirtyCloseToDesk={dirtyCloseToDesk}
        dirtyToolName={toolName}
        selectionScope={selectionScope}
        onDirtyCloseOpenChange={setDirtyCloseRequested}
        onConfirmDirtyClose={confirmDirtyClose}
        onCreateOpenChange={setCreateOpen}
        onCreateWork={createWork}
        onCreatePublishedSet={(set) => { void createFromPublishedSet(set); }}
        onRetryPublishedSets={() => { setPublishedSets([]); setPublishedSetsFailure(null); setPublishedSetsLoading(false); openCreateMenu(); }}
        onDeleteWorkOpenChange={(open) => { if (!open) setPendingDeleteWork(null); }}
        onConfirmDeleteWork={() => {
          const target = pendingDeleteWork;
          const localId = target?.references.localSetId;
          if (!target || !localId) {
            toast({ title: 'Set was not deleted', description: 'This Desk object is not a device-owned Set. Reload its source before trying again.', variant: 'destructive' });
            setPendingDeleteWork(null);
            return;
          }
          if (!deleteCardSet(localId)) {
            toast({ title: 'Set was not deleted', description: 'The device Set could not be found. Reload the Desk before trying again.', variant: 'destructive' });
            setPendingDeleteWork(null);
            return;
          }
          setPendingDeleteWork(null);
          resetToDesk();
          projection.refresh();
          toast({ title: 'Device copy deleted', description: `“${target.name}” was removed from this browser. Other named locations remain unchanged.` });
        }}
        onDeleteCardsOpenChange={(open) => { if (!open) setPendingDeleteCards([]); }}
        onConfirmDeleteCards={() => { removeGeneratedCards(pendingDeleteCards.map((card) => card.uniqueId)); setPendingDeleteCards([]); setSelectedCardIds([]); }}
      />
    </ArtifactScene>
  );
}
