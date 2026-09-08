"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  Boxes,
  Cloud,
  FileArchive,
  Sparkles,
} from 'lucide-react';
import {
  ENVIRONMENT_ZONES,
  EnvironmentShell,
  EnvironmentStatus,
  EnvironmentToolLayer,
} from '@/features/app-shell/client/environment';
import type { DesignToolIntent, WorkbenchBusinessIdentity } from '@/features/creator-workbench/client';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { PublicAuthControls } from '@/features/account/client/auth';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { hasCardBacking, type DisplayCard } from '@/domain/rendering';
import type { CardFace } from '@/domain/cards';
import { ArtifactScene, AuthoredObjectPreview } from '@/features/card-rendering/client';
import type { ContributorAccessSessionState } from '@/features/contributor-access/client';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
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
const DeskCardEditor = dynamic(() => import(
  '@/features/card-generator/client/card-editor'
).then((module) => module.CardEditor), { ssr: false, loading: DeskToolLoading });
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

function DeskWorkPreview({
  item,
}: {
  item: AccountLibraryItem;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getAccountLibraryWorkPreview(item);
  const previewKey = preview.kind === 'image' ? preview.url : preview.kind === 'fallback' ? preview.reason : preview.kind;
  useEffect(() => setImageFailed(false), [previewKey]);
  if (preview.kind === 'image' && !imageFailed) {
    return <img src={preview.url} alt="" className={styles.remoteWorkPreview} onError={() => setImageFailed(true)} />;
  }
  return <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>{imageFailed ? 'Preview unavailable' : workPreviewFallbackLabel(item)}</span></div>;
}

const deskSourceStatusLabel = (sourceStatuses: readonly { phase: string }[]): string => {
  const phases = new Set(sourceStatuses.map((source) => source.phase).filter((phase) => phase !== 'ready' && phase !== 'empty'));
  if (!phases.size) return 'Sources ready';
  const labels: Record<string, string> = {
    loading: 'Sources loading',
    unavailable: 'Source unavailable',
    'permission-required': 'Source permission required',
    expired: 'Source sign-in expired',
    incomplete: 'Source incomplete',
  };
  return [...phases].map((phase) => labels[phase] ?? 'Source issue').join(' · ');
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
}: DeskProps) {
  const [generationRevisionScopeIds, setGenerationRevisionScopeIds] = useState<string[]>([]);
  const [designIntent, setDesignIntent] = useState<DesignToolIntent | null>(null);
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
    editSelectedCard,
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
    requestHistoryBack,
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
    statuses,
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
  const sourceStatusLabel = deskSourceStatusLabel(projection.sourceStatuses);
  const activeTool = interactionSession.toolStack.at(-1) ?? null;
  const focusedArtifactId = interactionSession.focusPath.artifactId;
  const focusedArtifact = focusedArtifactId
    ? focusedCards.find((card) => card.uniqueId === focusedArtifactId) ?? null
    : null;
  const editingCardId = useProjectStore((state) => state.isEditDialogOpen ? state.editingCardUniqueId : null);
  const editingCard = studioTool?.tool === 'design' && editingCardId
    ? focusedCards.find((card) => card.uniqueId === editingCardId) ?? null : null;
  const primarySelectedSet = visibleWork.find((item) => selectedDeskIds.includes(item.id)) ?? null;
  const contextDepth = remoteWorkspaceItem ? 'tool' : activeTool ? 'tool' : focusedArtifact ? 'artifact' : focusedItem ? 'set' : 'desk';
  const toolName = remoteWorkspaceItem?.references.campaignId ? 'Campaign workspace'
    : remoteWorkspaceItem?.references.pipelineLineageId ? 'Published work'
    : activeTool?.toolId === 'design' ? (editingCard ? 'Edit card' : 'Design')
    : activeTool?.toolId === 'generate' ? (generationRevisionScopeIds.length ? 'Revise' : 'Generate')
      : activeTool?.toolId === 'output' ? 'Output'
        : activeTool?.toolId === 'pipeline' ? 'Pipeline'
          : undefined;
  const designCard = (card: DisplayCard, face: CardFace = 'front', copy = false) => {
    const template = face === 'back' ? card.backingTemplate : card.template;
    if (!template?.id || !focusedLocalSetId) return;
    const project = useProjectStore.getState();
    let templateId = template.id;
    if (copy) {
      const copiedId = project.cloneTemplate(templateId);
      if (!copiedId) return;
      const copiedTemplate = useProjectStore.getState().userTemplates.find((candidate) => candidate.id === copiedId);
      if (!copiedTemplate) return;
      templateId = copiedId;
      project.updateGeneratedCard(face === 'back'
        ? { ...card, backingTemplate: copiedTemplate, backingTemplateId: copiedId }
        : { ...card, template: copiedTemplate });
    }
    project.closeEditDialog();
    if (activeTool?.toolId === 'design') project.setTemplateEditorSelectedTemplateId(templateId);
    else openContextStudio(focusedLocalSetId, 'design', templateId);
  };
  const openSelectedRevision = () => {
    if (!focusedItem || !selectedCards.length) return;
    setGenerationRevisionScopeIds(selectedCards.map((card) => card.uniqueId));
    openWorkLane(focusedItem, 'generate', selectedCards[0]);
  };
  const closeActiveTool = () => {
    if (remoteWorkspaceItem) { closeRemoteWorkspace(); return; }
    if (activeTool?.dirty) {
      setDirtyCloseRequested(true);
      return;
    }
    if (activeTool?.toolId === 'pipeline') closePipelineSubmission();
    else if (activeTool?.toolId === 'generate') { setGenerationRevisionScopeIds([]); closeGenerate(); }
    else closeContextStudio();
  };
  return (
    <ArtifactScene activeSetId={focusedLocalSetId}>
      <EnvironmentShell
        ariaLabel="CardForge Desk"
        brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
        viewer={viewer}
        zones={zones.length ? zones : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'desk' || zone.id === 'library' || zone.id === 'profile')}
        activeZone="desk"
        onActiveZoneNavigate={requestDeskReturn}
        viewportPolicy="desk"
        primaryScroll="contained"
        detail={detail}
        actions={actions}
        accountControl={<PublicAuthControls />}
        showPrimaryAction={!focusedItem}
        contextBand={<DeskContextRail
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
          onBack={() => { setRenaming(false); requestHistoryBack(); }}
          onReturnToDesk={() => { setRenaming(false); requestDeskReturn(); }}
          onCloseTool={closeActiveTool}
          onOpenSelectedSet={() => { if (primarySelectedSet) focusWork(primarySelectedSet); }}
          onClearDeskSelection={() => setInteractionSession((current) => ({ ...current, deskSelection: [], deskSelectionAnchorId: null }))}
          onNudgeDeskSelection={nudgeDeskSelection}
          onRenameDraftChange={setRenameDraft}
          onCommitRename={commitRename}
          onToggleRenaming={() => setRenaming((current) => !current)}
          onOpenWork={() => { if (focusedItem) openWorkLane(focusedItem, 'open'); }}
          artifactId={focusedArtifactId ?? undefined}
          onOpenDesign={(face) => focusedArtifact ? designCard(focusedArtifact, face) : focusedLocalSetId && openContextStudio(focusedLocalSetId, 'design')}
          onDesignArtifactCopy={(face) => { if (focusedArtifact) designCard(focusedArtifact, face, true); }}
          onOpenGenerate={() => { if (focusedItem) { setGenerationRevisionScopeIds([]); openWorkLane(focusedItem, 'generate'); } }}
          onOpenLocation={() => { if (focusedItem) setLocationItem(focusedItem); }}
          onDuplicateWork={() => { if (focusedItem) duplicateWork(focusedItem); }}
          onOpenOutput={() => { if (focusedItem) openWorkLane(focusedItem, 'export'); }}
          onTogglePin={() => { if (focusedItem) togglePin(focusedItem.id); }}
          onInspect={() => { if (focusedItem) inspectItem(focusedItem); }}
          onDeleteWork={() => { if (focusedItem) setPendingDeleteWork(focusedItem); }}
          onEditArtifact={() => { if (focusedArtifactId) editSelectedCard(focusedArtifactId); }}
          onReviseSelected={openSelectedRevision}
          onDuplicateSelected={duplicateSelectedCards}
          onDeleteSelected={() => setPendingDeleteCards(selectedCards)}
        />}
        focusDepth={contextDepth === 'desk' ? 'zone' : contextDepth}
        focusReturnId={inspectorItem ? `set-info-${inspectorItem.id}` : undefined}
        surfaceRef={surfaceRef}
        statusContent={<>
          <EnvironmentStatus label={projection.isLoading ? 'Refreshing workspace' : `${workItems.length} open work object${workItems.length === 1 ? '' : 's'}`} tone={projection.isLoading ? 'warning' : 'neutral'} />
          <EnvironmentStatus label={sourceStatusLabel} tone={projection.failures.length || projection.sourceStatuses.some((source) => source.phase === 'loading' || source.phase === 'incomplete') ? 'warning' : 'success'} />
        </>}
        footerContent={focusedItem ? <span>{focusedItem.name}</span> : isSignedIn ? <span>Private creator desk</span> : (
          <span className="flex items-center gap-3">
            <span>Local creator desk</span>
            <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
            <Link className="font-semibold text-[var(--cf-accent-strong)] underline-offset-4 hover:underline" href={createAuthRouteHref('/sign-up', '/account')} prefetch={false} onClick={markSignUpIntent}>Create account</Link>
          </span>
        )}
        onCommand={() => {
          if (!focusedItem) { searchRef.current?.focus(); return; }
          requestHistoryBack();
        }}
        onAction={runAction}
        onCloseDetail={() => setInspectorWorkId(null)}
      >
        <div className={styles.spatialPlane} data-desk-plane data-scene-hidden={Boolean(studioTool?.tool === 'design' && !editingCard)} data-artifact-editing={Boolean(editingCard)} data-focused={Boolean(focusedItem)} data-artifact-focused={Boolean(interactionSession.focusPath.artifactId)}>
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
            searchRef={searchRef}
            workGridRef={workGridRef}
            workWorldRef={workWorldRef}
            camera={deskCamera}
            canUseProjectFiles={experience.capabilities.canUseProjectFiles}
            canSubmit={experience.contributor.canSubmit}
            statuses={statuses}
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
              onEditSelected={editSelectedCard}
              onDuplicateSelected={duplicateSelectedCards}
              onReviseSelected={() => {
                openSelectedRevision();
              }}
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
            previewUrl: remoteWorkspacePreview?.kind === 'image'
              ? remoteWorkspacePreview.url
              : null,
            publishedAt: remoteWorkspaceItem.updatedAt,
            revision: remoteWorkspaceItem.revision, sourceNotes: remoteWorkspaceItem.references.pipelineSourceNotes ?? null,
          }} onCreateWorkingCopy={remoteWorkspaceItem.references.pipelineAssetType === 'sets' && remoteWorkspaceItem.references.pipelineSourceUrl ? () => void createPublishedWorkingCopy(remoteWorkspaceItem) : undefined} /> : null}
        </EnvironmentToolLayer> : null}
        {generationSet ? <EnvironmentToolLayer
          id="desk-generate-title"
          eyebrow="Desk tool"
          title={generationRevisionScopeIds.length ? `Revise ${generationRevisionScopeIds.length} selected Artifact${generationRevisionScopeIds.length === 1 ? '' : 's'}` : `Generate into ${generationSet.name}`}
          summary={generationRevisionScopeIds.length ? 'The selected stable Artifact identities stay scoped while you revise values or map Library resources.' : 'The Set stays open behind this tool. Generated cards return here as the active selection.'}
          closeLabel="Close Generate"
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
          title={studioTool.tool === 'output' ? 'Output Set' : editingCard ? 'Edit card content' : 'Design Artifacts'}
          summary="The focused Set remains on the Desk while this reusable Studio tool operates on it."
          closeLabel="Close Studio tool"
          onClose={closeContextStudio}
          manageHistory={false}
          dirty={interactionSession.toolStack.at(-1)?.dirty ?? false}
          onDirtyCloseRequest={() => setDirtyCloseRequested(true)}
          presentation={activeTool?.presentation}
          sceneVisible={Boolean(editingCard)}
          railOwned
        >
          {editingCard ? <DeskCardEditor
            key={editingCard.uniqueId}
            card={editingCard}
            onDirtyChange={setActiveToolDirty}
            onClose={confirmDirtyClose}
            onSave={(card) => { useProjectStore.getState().updateGeneratedCard(card); confirmDirtyClose(); }}
            onDesign={(face, savedCard) => { if (savedCard) useProjectStore.getState().updateGeneratedCard(savedCard); designCard(savedCard ?? editingCard, face); }}
            onDuplicate={(card) => addGeneratedCards([{ ...card, uniqueId: crypto.randomUUID() }])}
          /> : <DeskDesignWorkspace
            tool={studioTool.tool === 'output' ? 'output' : 'design'}
            onCloseTool={confirmDirtyClose}
            businessIdentity={businessIdentity}
            initialContributorAccess={initialContributorAccess}
            onDirtyChange={studioTool.tool === 'design' ? setActiveToolDirty : undefined}
            designIntent={designIntent}
            onDesignIntentConsumed={() => setDesignIntent(null)}
            onReturnToGenerator={closeActiveTool}
          />}
        </EnvironmentToolLayer> : null}
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
        onConfirmDeleteWork={() => { const localId = pendingDeleteWork?.references.localSetId; if (localId && deleteCardSet(localId)) resetToDesk(); setPendingDeleteWork(null); }}
        onDeleteCardsOpenChange={(open) => { if (!open) setPendingDeleteCards([]); }}
        onConfirmDeleteCards={() => { removeGeneratedCards(pendingDeleteCards.map((card) => card.uniqueId)); setPendingDeleteCards([]); setSelectedCardIds([]); }}
      />
    </ArtifactScene>
  );
}
