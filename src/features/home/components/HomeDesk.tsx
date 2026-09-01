"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
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
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { PublicAuthControls } from '@/features/account/client/auth';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { AuthoredObjectPreview } from '@/features/card-rendering/client';
import type { ContributorAccessSessionState } from '@/features/contributor-access/client';
import type { ProjectPersistenceScope } from '@/features/project/client';
import {
  WorkLocationDialog,
  type AccountLibraryItem,
} from '@/features/storage-management/client';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

import {
  workSource,
  type HomeAccountStatus,
} from '../model/homeDesk';
import { DeskOverviewSurface } from './DeskOverviewSurface';
import { FocusedWorkSurface } from './FocusedWorkSurface';
import { HomeDeskDialogs } from './HomeDeskDialogs';
import { useHomeDeskController } from '../hooks/useHomeDeskController';
import styles from './HomeDesk.module.css';

const CampaignDeskShelf = dynamic(() => import(
  '@/features/marketing-content/client'
).then((module) => module.CampaignDeskShelf));
const PipelineContributionPanel = dynamic(() => import(
  '@/features/pipeline/client'
).then((module) => module.PipelineContributionPanel));
const DeskGenerationWorkspace = dynamic(() => import(
  '@/features/card-generator/client/generation-workspace'
).then((module) => module.GenerationWorkspace), { ssr: false });
const DeskDesignWorkspace = dynamic(() => import(
  '@/features/app-shell/client/studio'
).then((module) => module.CardForgeStudioShell), { ssr: false });

export type { HomeAccountStatus } from '../model/homeDesk';

export interface HomeDeskProps {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialFocusedWorkId?: string | null;
  initialTool?: 'design' | 'generate' | 'output' | 'pipeline' | null;
  initialContributorAccess: ContributorAccessSessionState;
  initialReturnContextKey?: string | null;
  homeAccessStatus?: HomeAccountStatus;
  homeSecurityStatus?: HomeAccountStatus;
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

export function HomeDesk({
  persistenceScope,
  experience,
  initialFocusedWorkId,
  initialTool = null,
  initialContributorAccess,
  initialReturnContextKey,
  homeAccessStatus,
  homeSecurityStatus,
}: HomeDeskProps) {
  const {
    actions,
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
    commitRename,
    confirmDirtyClose,
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
    setSort,
    setSourceFilter,
    setTagDraft,
    setTagFilter,
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
  } = useHomeDeskController({
    persistenceScope,
    experience,
    initialFocusedWorkId,
    initialTool,
    initialReturnContextKey,
    homeAccessStatus,
    homeSecurityStatus,
  });
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
        onCommand={() => {
          if (!focusedItem) { searchRef.current?.focus(); return; }
          requestHistoryBack();
        }}
        onAction={runAction}
        onCloseDetail={() => setInspectorWorkId(null)}
      >
        <div className={styles.spatialPlane} data-home-desk-plane data-focused={Boolean(focusedItem)}>
          <DeskOverviewSurface
            workItemsCount={workItems.length}
            visibleWork={visibleWork}
            focusedItemId={focusedItem?.id ?? null}
            activeWorkId={activeWorkId}
            pinnedIds={pinnedIds}
            positions={deskPositions}
            isLoading={projection.isLoading}
            failureMessage={projection.failures[0]?.message ?? null}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            query={query}
            sourceFilter={sourceFilter}
            sort={sort}
            searchRef={searchRef}
            workGridRef={workGridRef}
            canUseProjectFiles={experience.capabilities.canUseProjectFiles}
            canSubmit={experience.contributor.canSubmit}
            statuses={statuses}
            campaignShelf={experience.contributor.canDraftCampaigns ? <CampaignDeskShelf onOpen={(campaignId) => projection.router.push(`/account?section=library&scope=campaigns${campaignId ? `&campaign=${encodeURIComponent(campaignId)}` : ''}`)} /> : null}
            renderWorkPreview={(item, featured, focused) => item.references.localSetId ? <AuthoredObjectPreview cards={workCards(item)} template={workTemplate(item)} label={item.name} size={focused ? 'compact' : featured ? 'large' : 'standard'} emptyLabel={workCards(item).length ? undefined : 'Empty Set'} /> : <div className={styles.sourceFallback}><WorkSourceIcon item={item} /><span>Preview after opening</span></div>}
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
              onBack={() => { setRenaming(false); requestHistoryBack(); }}
              onRenameDraftChange={setRenameDraft}
              onCommitRename={commitRename}
              onToggleRenaming={() => setRenaming((current) => !current)}
              onOpenWork={() => openWorkLane(item, 'open')}
              onOpenDesign={() => focusedLocalSetId && openContextStudio(focusedLocalSetId, 'design')}
              onOpenGenerate={() => openWorkLane(item, 'generate')}
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
              onDeleteSelected={() => setPendingDeleteCards(selectedCards)}
              onSetCardsTag={setCardsTag}
              onTagDraftChange={setTagDraft}
              onApplyNewTag={applyNewTag}
              onClearGenerated={() => { setLatestGeneratedIds([]); setSelectedCardIds([]); }}
              onMoveArtifacts={(positions) => focusedLocalSetId && setCardPositions(focusedLocalSetId, positions)}
            />}
            beginDrag={beginDeskDrag}
            moveDrag={moveDeskDrag}
            endDrag={endDeskDrag}
            shouldSuppressFocus={shouldSuppressFocus}
            onQueryChange={setQuery}
            onSourceFilterChange={setSourceFilter}
            onSortChange={setSort}
            onShowGridChange={() => setShowGrid((value) => !value)}
            onSnapToGridChange={() => setSnapToGrid((value) => !value)}
            onFocusWork={focusWork}
            onTogglePin={togglePin}
            onOpenLane={openWorkLane}
            onOpenLocation={setLocationItem}
            onOpenPipeline={openPipelineSubmission}
            onDuplicate={duplicateWork}
            onMoveWork={moveDeskWork}
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
          title={`Generate into ${generationSet.name}`}
          summary="The Set stays open behind this tool. Generated cards return here as the active selection."
          closeLabel="Close Generate"
          onClose={closeGenerate}
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
        >
          <DeskDesignWorkspace
            embedded
            businessIdentity={{ brandName: 'CardForge', copyrightHolder: 'CardForge' }}
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

      <HomeDeskDialogs
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
