"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { STUDIO_TABS } from '@/features/app-shell/lib/studioTabs';
import { formatAccessExpiration, STUDIO_GUIDE_STORAGE_KEY } from '@/features/app-shell/lib/studioPresentation';
import { useToast } from '@/components/ui/use-toast';

import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { hasContributionScope, useDeveloperAccess, type DeveloperAccessSessionState } from '@/features/developer-access/client';
import { StudioHeader } from '@/features/app-shell/components/StudioHeader';
import { StudioFirstRunGuide } from '@/features/app-shell/components/StudioFirstRunGuide';
import { CardTemplateMaker, EditCardDialog, GenerationWorkspace, SetLibraryWorkspace } from '@/features/app-shell/components/StudioLazyWorkspaces';
import { GeneratorBackWorkflowBanner } from '@/features/app-shell/components/GeneratorBackWorkflowBanner';
import { StudioConfirmationDialogs } from '@/features/app-shell/components/StudioConfirmationDialogs';
import { useCardForgeWorkspaceState } from '@/features/app-shell/hooks/useCardForgeWorkspaceState';
import { useTemplateStudioHandoffs } from '@/features/app-shell/hooks/useTemplateStudioHandoffs';
import { BrowserStorageAlerts, useBrowserWorkspaceSaveStatus, useProjectFileActions } from '@/features/project/client';
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
  initialDeveloperAccess,
}: {
  businessIdentity: StudioBusinessIdentity;
  initialDeveloperAccess: DeveloperAccessSessionState;
}) {
  const { toast } = useToast();
  const accountEntitlement = useAccountEntitlement();
  const developerAccess = useDeveloperAccess({
    eligible: accountEntitlement.accessMode === 'dev' || accountEntitlement.ownerAccess.isOwner,
    initialState: initialDeveloperAccess,
    isOwner: accountEntitlement.ownerAccess.isOwner,
    sessionKey: accountEntitlement.isSignedIn ? accountEntitlement.accountUserId : null,
  });
  const canSubmitTemplateRevisions = hasContributionScope(developerAccess.scopes, 'library.submit');
  const canPublishSharedLibrary = hasContributionScope(developerAccess.scopes, 'library.publish');
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
      setActiveTabAction,
      setAppearanceStylesFromFilesAction,
      setDefaultTemplatesFromFilesAction,
      setExportDpiAction,
      setExportModeAction,
      setPdfOptionsAction,
      setSelectedPaperSizeAction,
      setActiveCardSetBackingTemplateIdAction,
      setActiveCardSetFrontTemplateIdAction,
      setActiveCardSetNameAction,
      setSingleCardGeneratorSelectedTemplateIdAction,
      setTemplateEditorSelectedTemplateIdAction,
      setStoredCardsFromFileAction,
      setUserTemplatesFromFilesAction,
      updateGeneratedCardAction,
    },
    state: {
      activeTab,
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
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [gallerySort, setGallerySort] = useState<'default' | 'name-asc' | 'name-desc' | 'template'>('default');
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
    handleEditCardRequest,
    handleRemoveCard,
    handleSaveEditedCard,
    handleSingleCardAdded,
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
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
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
    handleStudioTabChange,
    matchingBackRequest,
    pendingTemplateRetarget,
  } = useTemplateStudioHandoffs({
    activeBackingTemplateId: activeCardSet.backingTemplateId,
    focusStudioRegion,
    retargetGeneratedCardsBackingTemplate: retargetGeneratedCardsBackingTemplateAction,
    retargetGeneratedCardsTemplate: retargetGeneratedCardsTemplateAction,
    saveTemplateToLibrary,
    setActiveCardSetBackingTemplateId: setActiveCardSetBackingTemplateIdAction,
    setActiveTab: setActiveTabAction,
    setTemplateEditorSelectedTemplateId: setTemplateEditorSelectedTemplateIdAction,
    storedCards,
    toast,
  });

  const handleStartMakingCards = useCallback(() => {
    setActiveTabAction('generator');
    handleDismissFirstRunGuide();
    focusStudioRegion('[data-workflow-step="setup"]');
  }, [focusStudioRegion, handleDismissFirstRunGuide, setActiveTabAction]);

  const handleEditDesignFirst = useCallback(() => {
    setActiveTabAction('template-maker');
    handleDismissFirstRunGuide();
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, handleDismissFirstRunGuide, setActiveTabAction]);

  const effectiveActiveTab = STUDIO_TABS.some(tab => tab.value === activeTab) ? activeTab : STUDIO_TABS[0].value;
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
    setActiveTabAction('template-maker');
    url.searchParams.delete('editTemplate');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, isLoadingTemplates, setActiveTabAction, setTemplateEditorSelectedTemplateIdAction, templatesFromStore, toast]);

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
    setActiveTab: setActiveTabAction,
    setExportDpi: setExportDpiAction,
    setExportMode: setExportModeAction,
    setPdfOptions: setPdfOptionsAction,
    setSelectedPaperSize: setSelectedPaperSizeAction,
    setSelectedTemplateId: setSingleCardGeneratorSelectedTemplateIdAction,
    setTemplateEditorSelectedTemplateId: setTemplateEditorSelectedTemplateIdAction,
    toast,
  });

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <StudioHeader
        authConfigured={accountEntitlement.authConfigured}
        isLoadingAccount={accountEntitlement.isLoadingEntitlement}
        isSignedIn={accountEntitlement.isSignedIn}
        modeLabel={exportEntitlementLabel}
        saveStatus={workspaceSaveStatus}
        onRefreshEntitlement={accountEntitlement.refreshEntitlement}
        developerCockpitHref={developerAccess.hasCockpitAccess ? developerAccess.cockpitHref : null}
      />

      {accountEntitlement.entitlementError ? (
        <div role="status" className="border-b border-[#8b4c35] bg-[#2a130e] px-4 py-2 text-sm text-[#efb6a4] md:px-6">
          Account and connected-service access could not be verified. Local Studio work remains available; retry provider or account actions after the service recovers.
        </div>
      ) : null}

      <Tabs
        value={effectiveActiveTab}
        onValueChange={handleStudioTabChange}
        className="cardforge-studio-tabs-root flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="cardforge-studio-workspace-nav shrink-0 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] no-print">
          <div className="container mx-auto flex max-w-full items-center px-4 md:px-6 lg:px-8">
            <TabsList className="cardforge-studio-tabs grid h-10 w-full grid-cols-3 rounded-none border-0 bg-transparent p-0 sm:w-auto sm:min-w-[26rem]">
              {STUDIO_TABS.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  data-testid={`studio-tab-${tab.value}`}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 py-1 text-xs text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent-strong)] data-[state=active]:bg-[var(--cf-surface-raised)] data-[state=active]:text-[var(--cf-text-strong)] sm:text-sm"
                >
                  <tab.icon className="h-4 w-4" /> {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <main className="cardforge-studio-main container mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden p-4 md:p-6 lg:p-8">
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
          {showFirstRunGuide ? (
            <StudioFirstRunGuide
              onDismiss={handleDismissFirstRunGuide}
              onStartMakingCards={handleStartMakingCards}
              onEditDesignFirst={handleEditDesignFirst}
            />
          ) : null}

          <TabsContent value="template-maker" forceMount data-testid="layout-studio-panel" tabIndex={-1} className="!mt-0 min-h-0 flex-1 space-y-3 data-[state=inactive]:hidden">
            {generatorBackWorkflow ? (
              <GeneratorBackWorkflowBanner mode={generatorBackWorkflow} onReturn={handleReturnToGenerator} />
            ) : null}
            <CardTemplateMaker
              canUseProjectFiles={projectCapabilities.canUseProjectFiles}
              showCardWatermark={showVisibleCardWatermark}
              isActive={effectiveActiveTab === 'template-maker'}
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
              onReturnToTemplateMaker={() => setActiveTabAction('template-maker')}
              requestedBackFormat={matchingBackRequest}
              onRequestedBackFormatConsumed={clearMatchingBackRequest}
            />
          </TabsContent>

          <TabsContent value="generator" data-testid="generator-panel" className="!mt-0 min-h-0 flex-1">
            <GenerationWorkspace
              isLoadingTemplates={isLoadingTemplates}
              templates={freeformTemplatesForGenerator}
              backFaceTemplates={backFacePresetTemplates}
              activeCardSet={activeCardSet}
              generatorSelectedTemplateId={generatorSelectedTemplateId}
              selectedPaperSize={selectedPaperSize}
              pdfMarginMm={pdfMarginMm}
              pdfCardSpacingMm={pdfCardSpacingMm}
              pdfIncludeCutLines={pdfIncludeCutLines}
              pdfDuplexLayout={pdfDuplexLayout}
              richTextHighlightColor={richTextHighlightColor}
              exportMode={exportMode}
              exportDpi={exportDpi}
              generatedDisplayCards={generatedDisplayCards}
              zipProgress={zipProgress}
              gallerySearch={gallerySearch}
              gallerySort={gallerySort}
              isZipExporting={isZipExporting}
              zipExportKind={zipExportKind}
              isCheckoutStarting={isCheckoutStarting}
              canExportClean={projectCapabilities.canExportClean}
              exportGateMessage={exportGateMessage}
              exportEntitlementLabel={exportEntitlementLabel}
              exportEntitlementMessage={exportEntitlementMessage}
              onOpenTemplateMaker={() => setActiveTabAction('template-maker')}
              onCreateMatchingBack={handleCreateMatchingBack}
              onEditSelectedBack={handleEditCardBack}
              onManageCardBacks={handleManageCardBacks}
              onSingleCardAdded={handleSingleCardAdded}
              onBulkCardsGenerated={handleBulkCardsGenerated}
              onTemplateSelectionChange={setActiveCardSetFrontTemplateIdAction}
              onSetActiveCardSetName={setActiveCardSetNameAction}
              onSetActiveCardSetBackingTemplateId={setActiveCardSetBackingTemplateIdAction}
              onSelectPaperSize={setSelectedPaperSizeAction}
              onSetPdfOptions={setPdfOptionsAction}
              onSetExportMode={setExportModeAction}
              onSetExportDpi={setExportDpiAction}
              onStartCheckout={handleStartCheckout}
              onExportAllAsZip={handleExportAllAsZip}
              onExportTabletopSimulatorSpritesheets={handleExportTabletopSimulatorSpritesheets}
              onClearCardsRequest={() => setIsClearCardsDialogOpen(true)}
              onGallerySearchChange={setGallerySearch}
              onGallerySortChange={setGallerySort}
              onEditCardRequest={handleEditCardRequest}
              onRemoveCard={handleRemoveCard}
            />
          </TabsContent>

          <TabsContent value="sets" data-testid="sets-panel" className="!mt-0 min-h-0 flex-1 overflow-hidden">
            <SetLibraryWorkspace
              onOpenMakeCards={() => setActiveTabAction('generator')}
              onEditCardRequest={handleEditCardRequest}
              selectedPaperSize={selectedPaperSize}
              pdfMarginMm={pdfMarginMm}
              pdfCardSpacingMm={pdfCardSpacingMm}
              pdfIncludeCutLines={pdfIncludeCutLines}
              pdfDuplexLayout={pdfDuplexLayout}
              exportMode={exportMode}
              exportDpi={exportDpi}
              zipProgress={zipProgress}
              isZipExporting={isZipExporting}
              zipExportKind={zipExportKind}
              isCheckoutStarting={isCheckoutStarting}
              canExportClean={projectCapabilities.canExportClean}
              exportGateMessage={exportGateMessage}
              exportEntitlementLabel={exportEntitlementLabel}
              exportEntitlementMessage={exportEntitlementMessage}
              onSelectPaperSize={setSelectedPaperSizeAction}
              onSetPdfOptions={setPdfOptionsAction}
              onSetExportMode={setExportModeAction}
              onSetExportDpi={setExportDpiAction}
              onStartCheckout={handleStartCheckout}
              onExportAllAsZip={handleExportAllAsZip}
              onExportTabletopSimulatorSpritesheets={handleExportTabletopSimulatorSpritesheets}
              onClearCardsRequest={() => setIsClearCardsDialogOpen(true)}
            />
          </TabsContent>
        </main>
      </Tabs>

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
