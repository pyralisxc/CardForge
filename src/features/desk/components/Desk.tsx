"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
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
import type { WorkbenchBusinessIdentity } from '@/features/creator-workbench/client';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { PublicAuthControls } from '@/features/account/client/auth';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { hasCardBacking } from '@/domain/rendering';
import { AuthoredObjectPreview } from '@/features/card-rendering/client';
import type { ContributorAccessSessionState } from '@/features/contributor-access/client';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import {
  WorkLocationDialog,
  type AccountLibraryItem,
} from '@/features/storage-management/client';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

import {
  workSource,
  type DeskAccountStatus,
} from '../model/desk';
import { DeskOverviewSurface } from './DeskOverviewSurface';
import { FocusedWorkSurface } from './FocusedWorkSurface';
import { DeskDialogs } from './DeskDialogs';
import { useDeskController } from '../hooks/useDeskController';
import styles from './Desk.module.css';

const CampaignDeskShelf = dynamic(() => import(
  '@/features/marketing-content/client'
).then((module) => module.CampaignDeskShelf));
const PipelineContributionPanel = dynamic(() => import(
  '@/features/pipeline/client/contribution-panel'
).then((module) => module.PipelineContributionPanel));
const DeskGenerationWorkspace = dynamic(() => import(
  '@/features/card-generator/client/generation-workspace'
).then((module) => module.GenerationWorkspace), { ssr: false });
const DeskDesignWorkspace = dynamic(() => import(
  '@/features/creator-workbench/client'
).then((module) => module.CreatorWorkbench), { ssr: false });

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
    detail,
    dirtyCloseRequested,
    duplicateSelectedCards,
    duplicateWork,
    editSelectedCard,
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
    requestHistoryBack,
    renameDraft,
    renaming,
    reorderSelectedCard,
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
    setActiveToolDirty,
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
    setSourceFilter,
    setTagDraft,
    setTagFilter,
    undoLastBulkRevision,
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
    updateOrganization,
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
  return (
    <>
      <EnvironmentShell
        ariaLabel="CardForge Desk"
        brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
        viewer={viewer}
        zones={zones.length ? zones : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'desk' || zone.id === 'library' || zone.id === 'profile')}
        activeZone="desk"
        viewportPolicy="desk"
        primaryScroll="contained"
        detail={detail}
        actions={actions}
        accountControl={<PublicAuthControls />}
        focusReturnId={inspectorItem ? `set-info-${inspectorItem.id}` : undefined}
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
        onCommand={() => {
          if (!focusedItem) { searchRef.current?.focus(); return; }
          requestHistoryBack();
        }}
        onAction={runAction}
        onCloseDetail={() => setInspectorWorkId(null)}
      >
        <div className={styles.spatialPlane} data-desk-plane data-focused={Boolean(focusedItem)} data-artifact-focused={Boolean(interactionSession.focusPath.artifactId)}>
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
            failureMessage={projection.failures[0]?.message ?? null}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            query={query}
            sourceFilter={sourceFilter}
            sourceFacets={sourceFacets}
            searchRef={searchRef}
            workGridRef={workGridRef}
            workWorldRef={workWorldRef}
            camera={deskCamera}
            canUseProjectFiles={experience.capabilities.canUseProjectFiles}
            canSubmit={experience.contributor.canSubmit}
            statuses={statuses}
            campaignShelf={experience.contributor.canDraftCampaigns ? <CampaignDeskShelf onOpen={(campaignId) => projection.router.push(`/account?section=library&scope=campaigns${campaignId ? `&campaign=${encodeURIComponent(campaignId)}` : ''}`)} /> : null}
            renderWorkPreview={(item, featured, focused, face) => item.references.localSetId ? <AuthoredObjectPreview cards={workCards(item)} template={workTemplate(item)} label={item.name} size={focused ? 'compact' : featured ? 'large' : 'standard'} emptyLabel={workCards(item).length ? undefined : 'Empty Set'} face={face} /> : <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>Preview after opening</span></div>}
            canFlipWork={(item) => workCards(item).some(hasCardBacking)}
            renderFocusedSurface={(item) => <FocusedWorkSurface
              item={item}
              localSetId={focusedLocalSetId}
              remoteIcon={<WorkSourceIcon item={item} />}
              contentsLabel={focusedContentsLabel}
              renaming={renaming}
              renameDraft={renameDraft}
              pinned={pinnedIds.includes(item.id)}
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
              onBack={() => { setRenaming(false); requestHistoryBack(); }}
              onRenameDraftChange={setRenameDraft}
              onCommitRename={commitRename}
              onToggleRenaming={() => setRenaming((current) => !current)}
              onOpenWork={() => openWorkLane(item, 'open')}
              onOpenDesign={() => focusedLocalSetId && openContextStudio(focusedLocalSetId, 'design')}
              onOpenGenerate={() => { setGenerationRevisionScopeIds([]); openWorkLane(item, 'generate'); }}
              onOpenLocation={() => setLocationItem(item)}
              onDuplicateWork={() => duplicateWork(item)}
              onOpenOutput={() => openWorkLane(item, 'export')}
              onTogglePin={() => togglePin(item.id)}
              onInspect={() => inspectItem(item)}
              onDeleteWork={() => setPendingDeleteWork(item)}
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
                setGenerationRevisionScopeIds(selectedCards.map((card) => card.uniqueId));
                setGeneratorSelectedTemplateId(selectedCards[0]?.template.id ?? null);
                setGeneratorSelectedBackingTemplateId(selectedCards[0]?.backingTemplateId ?? null);
                openWorkLane(item, 'generate');
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
            onNudgeSelection={nudgeDeskSelection}
            onClearSelection={() => setInteractionSession((current) => ({ ...current, deskSelection: [], deskSelectionAnchorId: null }))}
            onQueryChange={setQuery}
            onSourceFilterChange={setSourceFilter}
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
            onRetry={projection.refresh}
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
        >
          <PipelineContributionPanel compact initialSubmitSetId={pipelineSubmitSetId} />
        </EnvironmentToolLayer> : null}
        {generationSet ? <EnvironmentToolLayer
          id="desk-generate-title"
          eyebrow="Desk tool"
          title={generationRevisionScopeIds.length ? `Revise ${generationRevisionScopeIds.length} selected Artifact${generationRevisionScopeIds.length === 1 ? '' : 's'}` : `Generate into ${generationSet.name}`}
          summary={generationRevisionScopeIds.length ? 'The selected stable Artifact identities stay scoped while you revise values or map Library resources.' : 'The Set stays open behind this tool. Generated cards return here as the active selection.'}
          closeLabel="Close Generate"
          onClose={() => { setGenerationRevisionScopeIds([]); closeGenerate(); }}
          manageHistory={false}
        >
          <DeskGenerationWorkspace
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
            onCreateMatchingBack={(template) => showTemplateTool(template.id)}
            onEditSelectedBack={(templateId) => showTemplateTool(templateId)}
            onManageCardBacks={() => showTemplateTool()}
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
          title={studioTool.tool === 'output' ? 'Output Set' : 'Design Artifacts'}
          summary="The focused Set remains on the Desk while this reusable Studio tool operates on it."
          closeLabel="Close Studio tool"
          onClose={closeContextStudio}
          manageHistory={false}
          dirty={interactionSession.toolStack.at(-1)?.dirty ?? false}
          onDirtyCloseRequest={() => setDirtyCloseRequested(true)}
          presentation="workspace"
        >
          <DeskDesignWorkspace
            businessIdentity={businessIdentity}
            initialContributorAccess={initialContributorAccess}
            onDirtyChange={studioTool.tool === 'design' ? setActiveToolDirty : undefined}
          />
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
    </>
  );
}
