"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatAccessExpiration, STUDIO_GUIDE_STORAGE_KEY } from '@/features/app-shell/lib/studioPresentation';
import { useToast } from '@/components/ui/use-toast';

import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { hasContributionScope, useContributorAccess, type ContributorAccessSessionState } from '@/features/contributor-access/client';
import { StudioFirstRunGuide } from '@/features/app-shell/components/StudioFirstRunGuide';
import {
  CardTemplateMaker,
  EditCardDialog,
  GenerationWorkspace,
} from '@/features/app-shell/components/StudioLazyWorkspaces';
import { StudioCommandBar } from '@/features/app-shell/components/StudioCommandBar';
import { StudioContextTools, type StudioContextTool } from '@/features/app-shell/components/StudioContextTools';
import { GeneratorBackWorkflowBanner } from '@/features/app-shell/components/GeneratorBackWorkflowBanner';
import { StudioConfirmationDialogs } from '@/features/app-shell/components/StudioConfirmationDialogs';
import { useCardForgeWorkspaceState } from '@/features/app-shell/hooks/useCardForgeWorkspaceState';
import { useTemplateStudioHandoffs } from '@/features/app-shell/hooks/useTemplateStudioHandoffs';
import {
  BrowserStorageAlerts,
  useBrowserWorkspaceSaveStatus,
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

export type StudioBusinessIdentity = {
  brandName: string;
  copyrightHolder: string;
};

export function CardForgeStudioShell({
  businessIdentity,
  initialContributorAccess,
}: {
  businessIdentity: StudioBusinessIdentity;
  initialContributorAccess: ContributorAccessSessionState;
}) {
  const { toast } = useToast();
  const accountEntitlement = useAccountEntitlement();
  const contributorAccess = useContributorAccess({
    eligible: accountEntitlement.accessMode === 'dev' || accountEntitlement.ownerAccess.isOwner,
    initialState: initialContributorAccess,
    isOwner: accountEntitlement.ownerAccess.isOwner,
    sessionKey: accountEntitlement.isSignedIn ? accountEntitlement.accountUserId : null,
  });
  const canSubmitTemplateRevisions = hasContributionScope(contributorAccess.scopes, 'library.submit');
  const canPublishSharedLibrary = hasContributionScope(contributorAccess.scopes, 'library.publish');
  const projectCapabilities = accountEntitlement.capabilities;
  const workspaceSaveStatus = useBrowserWorkspaceSaveStatus();
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
    : 'Clerk sign-in is not fully configured. Local development can still validate export behavior, but real free, paid, and dev account testing starts after adding CLERK_SECRET_KEY.';
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
      setActiveCardSetBackingTemplateIdAction,
      setActiveCardSetFrontTemplateIdAction,
      setSingleCardGeneratorSelectedTemplateIdAction,
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
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
    activeBackingTemplateId: activeCardSet.backingTemplateId,
    focusStudioRegion,
    retargetGeneratedCardsBackingTemplate: retargetGeneratedCardsBackingTemplateAction,
    retargetGeneratedCardsTemplate: retargetGeneratedCardsTemplateAction,
    saveTemplateToLibrary,
    setActiveCardSetBackingTemplateId: setActiveCardSetBackingTemplateIdAction,
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
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
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
    url.searchParams.delete('tool');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
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

  const showGenerateTool = useCallback(() => {
    handleStudioViewChange('generate');
    setOpenStudioSheet(null);
    focusStudioRegion('[data-workflow-step="setup"]');
  }, [focusStudioRegion, handleStudioViewChange]);

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {accountEntitlement.entitlementError ? (
        <div role="status" className="border-b border-[#8b4c35] bg-[#2a130e] px-4 py-2 text-sm text-[#efb6a4] md:px-6">
          Account and connected-service access could not be verified. Local Studio work remains available; retry provider or account actions after the service recovers.
        </div>
      ) : null}

      <div className="cardforge-studio-workbench flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <StudioCommandBar
          activeSetName={activeCardSet.name}
          studioView={studioView}
          cardCount={generatedDisplayCards.length}
          canSubmitToPipeline={canSubmitTemplateRevisions}
          authConfigured={accountEntitlement.authConfigured}
          isLoadingAccount={accountEntitlement.isLoadingEntitlement}
          isSignedIn={accountEntitlement.isSignedIn}
          modeLabel={exportEntitlementLabel}
          saveStatus={workspaceSaveStatus}
          onRefreshEntitlement={accountEntitlement.refreshEntitlement}
          onShowTemplate={showTemplateTool}
          onShowGenerate={showGenerateTool}
          onOpenSave={() => setSaveMoveOpen(true)}
          onOpenOutput={() => setOpenStudioSheet('output')}
          onOpenPipeline={() => setOpenStudioSheet('pipeline')}
        />

        <main className="cardforge-studio-main container mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden p-3 md:p-5 lg:p-6">
          {isStudioReady ? (
            <div data-testid="studio-ready" className="sr-only">Studio ready</div>
          ) : (
            <div data-testid="studio-loading" className="sr-only">Preparing studio</div>
          )}
          {templateLibraryFailed || styleLibraryFailed ? (
            <div className="mb-4 flex flex-col gap-3 rounded-md border border-amber-500/45 bg-amber-500/10 p-3 text-sm text-[var(--cf-text)] sm:flex-row sm:items-center sm:justify-between" role="alert">
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
            />
          </div>

          <div hidden={studioView !== 'generate'} data-testid="generator-panel" className="min-h-0 flex-1 overflow-auto">
            <GenerationWorkspace
              isLoadingTemplates={isLoadingTemplates}
              templates={freeformTemplatesForGenerator}
              backFaceTemplates={backFacePresetTemplates}
              activeCardSet={activeCardSet}
              generatorSelectedTemplateId={generatorSelectedTemplateId}
              richTextHighlightColor={richTextHighlightColor}
              generatedDisplayCards={generatedDisplayCards}
              canExportClean={projectCapabilities.canExportClean}
              onOpenTemplateMaker={showTemplateTool}
              onCreateMatchingBack={handleCreateMatchingBack}
              onEditSelectedBack={handleEditCardBack}
              onManageCardBacks={handleManageCardBacks}
              onBulkCardsGenerated={handleBulkCardsGenerated}
              onTemplateSelectionChange={setActiveCardSetFrontTemplateIdAction}
              onSetActiveCardSetBackingTemplateId={setActiveCardSetBackingTemplateIdAction}
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
      {isEditDialogOpen && editingCardFromStore && (
        <EditCardDialog
          isOpen={isEditDialogOpen}
          card={editingCardFromStore}
          onSave={handleSaveEditedCard}
          onDuplicate={handleDuplicateCard}
          onClose={handleCloseEditDialog}
        />
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
