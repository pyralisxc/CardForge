"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatAccessExpiration, STUDIO_GUIDE_STORAGE_KEY } from '@/features/app-shell/lib/studioPresentation';
import { useToast } from '@/components/ui/use-toast';

import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { useSafeCurrentReturnPath } from '@/infrastructure/auth/useSafeCurrentReturnPath';
import { hasContributionScope, useContributorAccess, type ContributorAccessSessionState } from '@/features/contributor-access/client';
import { StudioFirstRunGuide } from '@/features/app-shell/components/StudioFirstRunGuide';
import {
  CardTemplateMaker,
  EditCardDialog,
  GenerationWorkspace,
} from '@/features/app-shell/components/StudioLazyWorkspaces';
import { createDeskReturnHref, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';
import { resolveStudioReturnTarget } from '@/features/app-shell/lib/studioNavigation';
import { StudioContextTools, type StudioContextTool } from '@/features/app-shell/components/StudioContextTools';
import { GeneratorBackWorkflowBanner } from '@/features/app-shell/components/GeneratorBackWorkflowBanner';
import { StudioConfirmationDialogs } from '@/features/app-shell/components/StudioConfirmationDialogs';
import { useCardForgeWorkspaceState } from '@/features/app-shell/hooks/useCardForgeWorkspaceState';
import { useTemplateStudioHandoffs } from '@/features/app-shell/hooks/useTemplateStudioHandoffs';
import {
  BrowserStorageAlerts,
  useProjectFileActions,
} from '@/features/project/client';
import { useBootstrapLibraries } from '@/features/app-shell/hooks/useBootstrapLibraries';
import { useCheckoutActions } from '@/features/billing/client';
import { useCardZipExportActions, useGeneratedOutputActions } from '@/features/card-generator/client';
import { shouldShowVisibleCardWatermark } from '@/features/card-rendering/client';
import { useTemplateLibraryActions } from '@/features/template-editor/client';
import {
  canUploadCustomLocalAssets,
  readProjectPreference,
  writeProjectPreference,
} from '@/features/project/client';
import { useStudioDocumentHandoff } from '@/features/studio-documents/client';
import type { DisplayCard } from '@/domain/rendering';

export type StudioBusinessIdentity = {
  brandName: string;
  copyrightHolder: string;
};

export interface CardForgeStudioShellProps {
  businessIdentity: StudioBusinessIdentity;
  initialContributorAccess: ContributorAccessSessionState;
  onDirtyChange?: (dirty: boolean) => void;
}

export function CardForgeStudioShell({
  businessIdentity,
  initialContributorAccess,
  onDirtyChange,
}: CardForgeStudioShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const checkoutReturnTo = useSafeCurrentReturnPath('/account?section=profile&utility=billing');
  const accountEntitlement = useAccountEntitlement();
  const contributorAccess = useContributorAccess({
    eligible: accountEntitlement.accessMode === 'contributor' || accountEntitlement.ownerAccess.isOwner,
    initialState: initialContributorAccess,
    isOwner: accountEntitlement.ownerAccess.isOwner,
    sessionKey: accountEntitlement.isSignedIn ? accountEntitlement.accountUserId : null,
  });
  const canSubmitTemplateRevisions = hasContributionScope(contributorAccess.scopes, 'library.submit');
  const canPublishSharedLibrary = hasContributionScope(contributorAccess.scopes, 'library.publish');
  const projectCapabilities = accountEntitlement.capabilities;
  const showVisibleCardWatermark = shouldShowVisibleCardWatermark(projectCapabilities.canExportClean);
  const exportEntitlementCopy = accountEntitlement.copy;
  const exportGateMessage = accountEntitlement.copy.gateMessage;
  const projectFileGateMessage = accountEntitlement.copy.projectFileGateMessage;
  const exportEntitlementLabel = accountEntitlement.authConfigured
    ? exportEntitlementCopy.modeLabel
    : 'Local setup mode';
  const accessExpiresOn = formatAccessExpiration(accountEntitlement.accessExpiresAt);
  const exportEntitlementMessage = accountEntitlement.authConfigured
    ? accessExpiresOn
      ? `${exportEntitlementCopy.panelMessage} Your access is active through ${accessExpiresOn}.`
      : exportEntitlementCopy.panelMessage
    : 'Clerk sign-in is not fully configured. Local development can still validate export behavior, but real free, paid, and Contributor account testing starts after adding CLERK_SECRET_KEY.';
  const canUploadCustomAssets = canUploadCustomLocalAssets({
    authConfigured: accountEntitlement.authConfigured,
    isSignedIn: accountEntitlement.isSignedIn,
  });

  const {
    actions: {
      addGeneratedCardsAction,
      addOrUpdateAppearanceStyleAction,
      addOrUpdateTemplateAction,
      clearGeneratedCardsAction,
      cloneTemplateAction,
      closeEditDialogAction,
      createCardSetAction,
      deleteAppearanceStyleAction,
      deleteTemplateAction,
      mergeUserTemplatesFromFilesAction,
      mergeStoredCardsFromFileAction,
      openEditDialogAction,
      replaceAppearanceStylesFromFilesAction,
      removeGeneratedCardAction,
      retargetGeneratedCardsBackingTemplateAction,
      retargetGeneratedCardsTemplateAction,
      setStudioViewAction,
      setAppearanceStylesFromFilesAction,
      setDefaultTemplatesFromFilesAction,
      setExportDpiAction,
      setExportModeAction,
      setPdfOptionsAction,
      setSelectedPaperSizeAction,
      setSingleCardGeneratorSelectedTemplateIdAction,
      setSingleCardGeneratorSelectedBackingTemplateIdAction,
      setTemplateEditorSelectedTemplateIdAction,
      setStoredCardsFromFileAction,
      setUserTemplatesFromFilesAction,
      updateGeneratedCardAction,
    },
    state: {
      studioView,
      activeCardSet,
      appearanceStyles,
      backFacePresetTemplates,
      editingCardFromStore,
      exportDpi,
      exportMode,
      freeformTemplatesForGenerator,
      generatedDisplayCards,
      generatorSelectedTemplateId,
      singleCardGeneratorSelectedBackingTemplateId,
      isEditDialogOpen,
      pdfCardSpacingMm,
      pdfDuplexLayout,
      pdfIncludeCutLines,
      pdfMarginMm,
      richTextHighlightColor,
      selectedPaperSize,
      standardDefaultTemplates,
      storedCards,
      templateEditorSelectedTemplateId,
      templatesFromStore,
      userTemplatesFromStore,
    },
  } = useCardForgeWorkspaceState();
  const returnTarget = resolveStudioReturnTarget({
    activeSetId: activeCardSet?.id ?? '',
    activeSetName: activeCardSet?.name ?? 'Desk',
    requestedReturnTo: searchParams.get('returnTo'),
  });
  const viewGeneratedCardsOnDesk = useCallback((cards: DisplayCard[]) => {
    if (!activeCardSet) return;
    const workId = `set:${activeCardSet.id}`;
    const previousContextKey = new URL(returnTarget.href, 'https://cardforge.local').searchParams.get('returnContext');
    const previousContext = readSurfaceReturnContext(previousContextKey);
    const returnContext = storeSurfaceReturnContext(previousContext?.kind === 'desk'
      ? { ...previousContext, focusedWorkId: workId, inspectorWorkId: null, selectedCardIds: cards.map((card) => card.uniqueId), cardQuery: '', tagFilter: 'all' }
      : {
          kind: 'desk', focusedWorkId: workId, inspectorWorkId: null, query: '', sourceFilter: 'all', sort: 'desk',
          selectedCardIds: cards.map((card) => card.uniqueId), cardQuery: '', tagFilter: 'all', scrollTop: 0,
        });
    router.push(createDeskReturnHref(workId, returnContext));
  }, [activeCardSet, returnTarget.href, router]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstRunGuideDismissedRef = useRef(false);
  const requestedTemplateHandledRef = useRef(false);
  const requestedToolHandledRef = useRef(false);
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const [openStudioSheet, setOpenStudioSheet] = useState<StudioContextTool>(null);
  const [saveMoveOpen, setSaveMoveOpen] = useState(false);
  const {
    isLoadingTemplates,
    retryLibraries,
    styleLibraryFailed,
    templateLibraryFailed,
  } = useBootstrapLibraries({
    setAppearanceStylesFromFiles: setAppearanceStylesFromFilesAction,
    setDefaultTemplatesFromFiles: setDefaultTemplatesFromFilesAction,
    mergeUserTemplatesFromFiles: mergeUserTemplatesFromFilesAction,
  });

  const {
    handleCloneTemplate,
    handleConfirmDeleteTemplate,
    handleDeleteTemplate,
    handleSaveAppearanceStyle,
    handleSaveTemplate: saveTemplateToLibrary,
    handleContinueNewTemplateInPipeline,
    setTemplatePendingDeleteId,
    templatePendingDeleteId,
  } = useTemplateLibraryActions({
    addOrUpdateAppearanceStyle: addOrUpdateAppearanceStyleAction,
    addOrUpdateTemplate: addOrUpdateTemplateAction,
    appearanceStyles,
    cloneTemplate: cloneTemplateAction,
    deleteAppearanceStyle: deleteAppearanceStyleAction,
    deleteTemplate: deleteTemplateAction,
    projectCapabilities: {
      canSubmitTemplateRevisions,
      canPublishSharedLibrary,
    },
    setSingleCardGeneratorSelectedTemplateId: setSingleCardGeneratorSelectedTemplateIdAction,
    setTemplateEditorSelectedTemplateId: setTemplateEditorSelectedTemplateIdAction,
    storedCards,
    templates: templatesFromStore,
    toast,
  });
  const {
    handleBulkCardsGenerated,
    handleClearGeneratedCards,
    handleCloseEditDialog,
    handleDuplicateCard,
    handleSaveEditedCard,
    isClearCardsDialogOpen,
    setIsClearCardsDialogOpen,
  } = useGeneratedOutputActions({
    addGeneratedCards: addGeneratedCardsAction,
    clearGeneratedCards: clearGeneratedCardsAction,
    closeEditDialog: closeEditDialogAction,
    openEditDialog: openEditDialogAction,
    removeGeneratedCard: removeGeneratedCardAction,
    toast,
    updateGeneratedCard: updateGeneratedCardAction,
  });

  const {
    applyPendingProjectImport,
    clearPendingProjectImport,
    handleChooseImportProject,
    handleExportProject,
    handleImportProject,
    pendingProjectImport,
  } = useProjectFileActions({
    appearanceStyles,
    canUseProjectFiles: projectCapabilities.canUseProjectFiles,
    exportDpi,
    projectFileGateMessage,
    exportMode,
    fileInputRef,
    pdfCardSpacingMm,
    pdfDuplexLayout,
    pdfIncludeCutLines,
    pdfMarginMm,
    selectedPaperSize,
    setAppearanceStylesFromFiles: setAppearanceStylesFromFilesAction,
    setExportDpi: setExportDpiAction,
    setExportMode: setExportModeAction,
    setPdfOptions: setPdfOptionsAction,
    setSelectedTemplateId: setSingleCardGeneratorSelectedTemplateIdAction,
    setSelectedPaperSize: setSelectedPaperSizeAction,
    setStoredCardsFromFile: setStoredCardsFromFileAction,
    mergeStoredCardsFromFile: mergeStoredCardsFromFileAction,
    setUserTemplatesFromFiles: setUserTemplatesFromFilesAction,
    mergeUserTemplatesFromFiles: mergeUserTemplatesFromFilesAction,
    replaceAppearanceStylesFromFiles: replaceAppearanceStylesFromFilesAction,
    storedCards,
    toast,
    userTemplates: userTemplatesFromStore,
  });

  const {
    handleExportAllAsZip,
    handleExportTabletopSimulatorSpritesheets,
    isZipExporting,
    zipExportKind,
    zipProgress,
  } = useCardZipExportActions({
    canExportClean: projectCapabilities.canExportClean,
    exportDpi,
    exportMode,
    generatedDisplayCards,
    richTextHighlightColor,
    toast,
  });

  const {
    handleStartCheckout,
    isCheckoutStarting,
  } = useCheckoutActions({
    authConfigured: accountEntitlement.authConfigured,
    isSignedIn: accountEntitlement.isSignedIn,
    returnTo: checkoutReturnTo,
    toast,
  });

  const handleDismissFirstRunGuide = useCallback(() => {
    firstRunGuideDismissedRef.current = true;
    setShowFirstRunGuide(false);
    void writeProjectPreference(STUDIO_GUIDE_STORAGE_KEY, true);
  }, []);

  const focusStudioRegion = useCallback((selector: string) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      const panel = target.closest<HTMLElement>('[data-testid="generator-panel"]');
      if (panel && panel !== target) {
        panel.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }
      target.focus({ preventScroll: true });
    });
  }, []);

  const {
    applyPendingTemplateRetarget,
    clearMatchingBackRequest,
    dismissPendingTemplateRetarget,
    generatorBackWorkflow,
    handleCreateMatchingBack,
    handleEditCardBack,
    handleManageCardBacks,
    handleReturnToGenerator,
    handleSaveTemplate,
    handleStudioViewChange,
    matchingBackRequest,
    pendingTemplateRetarget,
  } = useTemplateStudioHandoffs({
    activeBackingTemplateId: singleCardGeneratorSelectedBackingTemplateId,
    focusStudioRegion,
    retargetGeneratedCardsBackingTemplate: retargetGeneratedCardsBackingTemplateAction,
    retargetGeneratedCardsTemplate: retargetGeneratedCardsTemplateAction,
    saveTemplateToLibrary,
    setGeneratorBackingTemplateId: setSingleCardGeneratorSelectedBackingTemplateIdAction,
    setStudioView: setStudioViewAction,
    setTemplateEditorSelectedTemplateId: setTemplateEditorSelectedTemplateIdAction,
    storedCards,
    toast,
  });

  const handleStartMakingCards = useCallback(() => {
    setStudioViewAction('generate');
    handleDismissFirstRunGuide();
    focusStudioRegion('[data-workflow-step="setup"]');
  }, [focusStudioRegion, handleDismissFirstRunGuide, setStudioViewAction]);

  const handleEditDesignFirst = useCallback(() => {
    setStudioViewAction('template');
    handleDismissFirstRunGuide();
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, handleDismissFirstRunGuide, setStudioViewAction]);
  useEffect(() => {
    if (isLoadingTemplates || requestedTemplateHandledRef.current) return;
    const url = new URL(window.location.href);
    const requestedTemplateId = url.searchParams.get('editTemplate');
    if (!requestedTemplateId) {
      requestedTemplateHandledRef.current = true;
      return;
    }
    requestedTemplateHandledRef.current = true;
    const template = templatesFromStore.find((candidate) => candidate.id === requestedTemplateId);
    if (!template) {
      toast({
        title: 'Template is not available',
        description: 'This Template may be archived, restricted, or no longer published.',
        variant: 'destructive',
      });
      return;
    }
    setTemplateEditorSelectedTemplateIdAction(template.id);
    setStudioViewAction('template');
    url.searchParams.delete('editTemplate');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, isLoadingTemplates, setStudioViewAction, setTemplateEditorSelectedTemplateIdAction, templatesFromStore, toast]);

  useEffect(() => {
    if (requestedToolHandledRef.current) return;
    const url = new URL(window.location.href);
    const requestedTool = url.searchParams.get('tool');
    if (!requestedTool) {
      requestedToolHandledRef.current = true;
      return;
    }
    if (requestedTool === 'output') setOpenStudioSheet('output');
    else if (requestedTool === 'pipeline' && canSubmitTemplateRevisions) setOpenStudioSheet('pipeline');
    else if (requestedTool === 'save') setSaveMoveOpen(true);
    requestedToolHandledRef.current = true;
  }, [canSubmitTemplateRevisions]);

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<boolean>(STUDIO_GUIDE_STORAGE_KEY).then((dismissed) => {
      if (!cancelled && !firstRunGuideDismissedRef.current) {
        setShowFirstRunGuide(dismissed !== true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isStudioReady = !isLoadingTemplates;
  useStudioDocumentHandoff({
    isAccountLoading: accountEntitlement.isLoadingEntitlement,
    isSignedIn: accountEntitlement.isSignedIn,
    isStudioReady,
    mergeAppearanceStyles: setAppearanceStylesFromFilesAction,
    mergeStoredCards: mergeStoredCardsFromFileAction,
    mergeUserTemplates: mergeUserTemplatesFromFilesAction,
    setStudioView: setStudioViewAction,
    setExportDpi: setExportDpiAction,
    setExportMode: setExportModeAction,
    setPdfOptions: setPdfOptionsAction,
    setSelectedPaperSize: setSelectedPaperSizeAction,
    setSelectedTemplateId: setSingleCardGeneratorSelectedTemplateIdAction,
    setTemplateEditorSelectedTemplateId: setTemplateEditorSelectedTemplateIdAction,
    toast,
  });

  const showTemplateTool = useCallback(() => {
    handleStudioViewChange('template');
    setOpenStudioSheet(null);
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, handleStudioViewChange]);

  if (!activeCardSet) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--cf-canvas)] p-5 text-[var(--cf-text)]">
        <section className="w-full max-w-xl border-y border-[var(--cf-border-subtle)] py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Studio</p>
          <h1 className="mt-3 font-serif text-3xl text-[var(--cf-text-strong)]">Choose the work you want to edit</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--cf-text-muted)]">
            Studio opens around a card or Template inside a Set. Start a Set here, or return to your Desk and open existing work.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button type="button" onClick={() => createCardSetAction('Untitled Set')}>Create a Set</Button>
            <Button type="button" variant="outline" onClick={() => router.push('/account')}>Return to Desk</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cardforge-studio-workspace flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-[var(--cf-canvas)] text-[var(--cf-text)]" data-studio-presentation="contextual-tool">
      {accountEntitlement.entitlementError ? (
        <div role="status" className="border-b border-[#8b4c35] bg-[#2a130e] px-4 py-2 text-sm text-[#efb6a4] md:px-6">
          Account and connected-service access could not be verified. Local Studio work remains available; retry provider or account actions after the service recovers.
        </div>
      ) : null}

      {isEditDialogOpen && editingCardFromStore ? (
        <EditCardDialog
          isOpen={isEditDialogOpen}
          card={editingCardFromStore}
          onSave={handleSaveEditedCard}
          onDuplicate={handleDuplicateCard}
          onClose={handleCloseEditDialog}
          presentation="workspace"
        />
      ) : (
        <>
      <div className="cardforge-studio-workbench flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <main className="cardforge-studio-main flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden p-0">
          {isStudioReady ? (
            <div data-testid="studio-ready" className="sr-only">Studio ready</div>
          ) : (
            <div data-testid="studio-loading" className="sr-only">Preparing studio</div>
          )}
          {templateLibraryFailed || styleLibraryFailed ? (
            <div className="flex shrink-0 flex-col gap-2 border-b border-amber-500/45 bg-amber-500/10 py-2 pl-3 pr-16 text-sm text-[var(--cf-text)] sm:flex-row sm:items-center sm:justify-between" role="alert">
              <div>
                <p className="font-semibold">Some Studio library content did not load</p>
                <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">
                  {templateLibraryFailed && styleLibraryFailed
                    ? 'Templates and appearance styles are temporarily unavailable.'
                    : templateLibraryFailed
                      ? 'Templates are temporarily unavailable.'
                      : 'Appearance styles are temporarily unavailable.'}{' '}
                  Your browser-saved work is unchanged.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={retryLibraries} disabled={isLoadingTemplates}>
                {isLoadingTemplates ? 'Retrying...' : 'Retry library'}
              </Button>
            </div>
          ) : null}
          {showFirstRunGuide && studioView === 'generate' && generatedDisplayCards.length === 0 ? (
            <StudioFirstRunGuide
              onDismiss={handleDismissFirstRunGuide}
              onStartMakingCards={handleStartMakingCards}
              onEditDesignFirst={handleEditDesignFirst}
            />
          ) : null}

          <div hidden={studioView !== 'template'} data-testid="layout-studio-panel" data-state={studioView === 'template' ? 'active' : 'inactive'} tabIndex={-1} className="min-h-0 flex-1 space-y-3">
            {generatorBackWorkflow ? (
              <GeneratorBackWorkflowBanner mode={generatorBackWorkflow} onReturn={handleReturnToGenerator} />
            ) : null}
            <CardTemplateMaker
              canUseProjectFiles={projectCapabilities.canUseProjectFiles}
              showCardWatermark={showVisibleCardWatermark}
              isActive={studioView === 'template'}
              onSaveTemplate={handleSaveTemplate}
              onContinueNewTemplateInPipeline={handleContinueNewTemplateInPipeline}
              templates={templatesFromStore}
              defaultTemplates={standardDefaultTemplates}
              backFaceTemplates={backFacePresetTemplates}
              userTemplates={userTemplatesFromStore}
              fileInputRef={fileInputRef}
              isCheckoutStarting={isCheckoutStarting}
              appearanceStyles={appearanceStyles}
              onSaveAppearanceStyle={handleSaveAppearanceStyle}
              onDeleteTemplate={handleDeleteTemplate}
              onCloneTemplate={handleCloneTemplate}
              onExportProject={handleExportProject}
              onImportProject={handleChooseImportProject}
              onLoadProject={handleImportProject}
              onStartCheckout={handleStartCheckout}
              projectFileGateMessage={projectFileGateMessage}
              selectedTemplateIdForEditing={templateEditorSelectedTemplateId}
              onSelectTemplateForEditing={setTemplateEditorSelectedTemplateIdAction}
              canSubmitSharedTemplateRevision={canSubmitTemplateRevisions}
              canPublishSharedLibrary={canPublishSharedLibrary}
              canUploadCustomAssets={canUploadCustomAssets}
              onReturnToTemplateMaker={showTemplateTool}
              requestedBackFormat={matchingBackRequest}
              onRequestedBackFormatConsumed={clearMatchingBackRequest}
              onDirtyChange={onDirtyChange}
            />
          </div>

          <div hidden={studioView !== 'generate'} data-testid="generator-panel" className="min-h-0 flex-1 overflow-auto">
            <GenerationWorkspace
              isLoadingTemplates={isLoadingTemplates}
              templates={freeformTemplatesForGenerator}
              backFaceTemplates={backFacePresetTemplates}
              activeCardSet={activeCardSet}
              generatorSelectedTemplateId={generatorSelectedTemplateId}
              generatorSelectedBackingTemplateId={singleCardGeneratorSelectedBackingTemplateId}
              richTextHighlightColor={richTextHighlightColor}
              generatedDisplayCards={generatedDisplayCards}
              canExportClean={projectCapabilities.canExportClean}
              onOpenTemplateMaker={showTemplateTool}
              onCreateMatchingBack={handleCreateMatchingBack}
              onEditSelectedBack={handleEditCardBack}
              onManageCardBacks={handleManageCardBacks}
              onBulkCardsGenerated={handleBulkCardsGenerated}
              onViewGeneratedCards={viewGeneratedCardsOnDesk}
              onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateIdAction}
              onBackingTemplateSelectionChange={setSingleCardGeneratorSelectedBackingTemplateIdAction}
            />
          </div>
        </main>
      </div>

      <StudioContextTools
        activeSetName={activeCardSet.name}
        activeSetId={activeCardSet.id}
        openTool={openStudioSheet}
        onOpenToolChange={setOpenStudioSheet}
        canSubmitToPipeline={canSubmitTemplateRevisions}
        saveMoveOpen={saveMoveOpen}
        onSaveMoveOpenChange={setSaveMoveOpen}
        outputPanelProps={{
          canExportClean: projectCapabilities.canExportClean,
          exportDpi,
          exportEntitlementLabel,
          exportEntitlementMessage,
          exportGateMessage,
          exportMode,
          generatedDisplayCards,
          isCheckoutStarting,
          isZipExporting,
          pdfCardSpacingMm,
          pdfDuplexLayout,
          pdfIncludeCutLines,
          pdfMarginMm,
          richTextHighlightColor,
          selectedPaperSize,
          zipExportKind,
          zipProgress,
          onClearCardsRequest: () => setIsClearCardsDialogOpen(true),
          onExportAllAsZip: handleExportAllAsZip,
          onExportTabletopSimulatorSpritesheets: handleExportTabletopSimulatorSpritesheets,
          onSelectPaperSize: setSelectedPaperSizeAction,
          onSetExportDpi: setExportDpiAction,
          onSetExportMode: setExportModeAction,
          onSetPdfOptions: setPdfOptionsAction,
          onStartCheckout: handleStartCheckout,
        }}
        saveMoveDialogProps={{
          isSignedIn: accountEntitlement.isSignedIn,
          canUseProjectFiles: projectCapabilities.canUseProjectFiles,
          setId: activeCardSet.id,
          setName: activeCardSet.name,
        }}
      />

      <BrowserStorageAlerts canUseProjectFiles={projectCapabilities.canUseProjectFiles} />
        </>
      )}
      <StudioConfirmationDialogs
        templatePendingDeleteId={templatePendingDeleteId}
        templates={templatesFromStore}
        storedCards={storedCards}
        onCloseTemplateDelete={() => setTemplatePendingDeleteId(null)}
        onConfirmTemplateDelete={handleConfirmDeleteTemplate}
        pendingTemplateRetarget={pendingTemplateRetarget}
        onDismissTemplateRetarget={dismissPendingTemplateRetarget}
        onApplyTemplateRetarget={applyPendingTemplateRetarget}
        clearCardsOpen={isClearCardsDialogOpen}
        generatedCardCount={generatedDisplayCards.length}
        onClearCardsOpenChange={setIsClearCardsDialogOpen}
        onConfirmClearCards={handleClearGeneratedCards}
        pendingProjectImport={pendingProjectImport}
        onClearProjectImport={clearPendingProjectImport}
        onApplyProjectImport={(mode) => void applyPendingProjectImport(mode)}
      />
      <footer className="hidden" aria-hidden="true">
        {businessIdentity.brandName} &copy; {new Date().getFullYear()} {businessIdentity.copyrightHolder}
      </footer>
    </div>
  );
}
