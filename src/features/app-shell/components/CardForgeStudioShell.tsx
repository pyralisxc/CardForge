"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { STUDIO_TABS } from '@/features/app-shell/lib/studioTabs';
import { formatAccessExpiration, STUDIO_GUIDE_STORAGE_KEY } from '@/features/app-shell/lib/studioPresentation';
import { useToast } from '@/components/ui/use-toast';

import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { useDeveloperAccess, type DeveloperAccessSessionState } from '@/features/developer-access/client';
import { StudioHeader } from '@/features/app-shell/components/StudioHeader';
import { StudioFirstRunGuide } from '@/features/app-shell/components/StudioFirstRunGuide';
import { CardTemplateMaker, EditCardDialog, GenerationWorkspace } from '@/features/app-shell/components/StudioLazyWorkspaces';
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
  const developerAccess = useDeveloperAccess(
    accountEntitlement.isSignedIn ? accountEntitlement.accountUserId : null,
    initialDeveloperAccess,
  );
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
      canSubmitTemplateRevisions: developerAccess.canSubmitTemplateRevisions,
      canPublishSharedLibrary: developerAccess.canPublishSharedLibrary,
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
    exportGateMessage,
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

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-[#0c0b09] text-[#f7ead0]">
      <StudioHeader
        authConfigured={accountEntitlement.authConfigured}
        isLoadingAccount={accountEntitlement.isLoadingEntitlement}
        isSignedIn={accountEntitlement.isSignedIn}
        modeLabel={exportEntitlementLabel}
        saveStatus={workspaceSaveStatus}
        onRefreshEntitlement={accountEntitlement.refreshEntitlement}
        developerCockpitHref={developerAccess.hasCockpitAccess ? developerAccess.cockpitHref : null}
      />
      <main className="cardforge-studio-main container mx-auto w-full max-w-full flex-grow p-4 md:p-6 lg:p-8">
        {isStudioReady ? (
          <div data-testid="studio-ready" className="sr-only">Studio ready</div>
        ) : (
          <div data-testid="studio-loading" className="sr-only">Preparing studio</div>
        )}
        {templateLibraryFailed || styleLibraryFailed ? (
          <div className="mb-4 flex flex-col gap-3 rounded-md border border-amber-500/45 bg-amber-500/10 p-3 text-sm text-[#f7ead0] sm:flex-row sm:items-center sm:justify-between" role="alert">
            <div>
              <p className="font-semibold">Some Studio library content did not load</p>
              <p className="mt-1 text-xs leading-5 text-[#cbb58b]">
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
        <Tabs value={effectiveActiveTab} onValueChange={handleStudioTabChange} className="w-full min-w-0">
          <div className="cardforge-studio-context mb-4 border border-[#4a3823] bg-[#100c08] px-3 py-2 text-xs leading-5 text-[#cbb58b] no-print md:flex md:items-center md:justify-between md:gap-4">
            <p><span className="font-semibold text-[#fff1c7]">Templates</span> shape editable fronts, backs, fields, and visual foundations.</p>
            <p><span className="font-semibold text-[#fff1c7]">Make Cards</span> adds card details, then keeps every card ready for review and export.</p>
          </div>
          <TabsList className="cardforge-studio-tabs mb-4 grid h-auto w-full grid-cols-2 border border-[#5f4526] bg-[#15100a] p-1 no-print md:mb-6">
            {STUDIO_TABS.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-testid={`studio-tab-${tab.value}`}
                className="flex min-h-11 items-center justify-center gap-2 px-2 text-xs text-[#c8b07f] data-[state=active]:bg-[#24180e] data-[state=active]:text-[#ffe7ad] sm:text-sm"
              >
                <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="template-maker" forceMount data-testid="layout-studio-panel" tabIndex={-1} className="space-y-3 data-[state=inactive]:hidden">
            {generatorBackWorkflow ? (
              <GeneratorBackWorkflowBanner mode={generatorBackWorkflow} onReturn={handleReturnToGenerator} />
            ) : null}
            <CardTemplateMaker
              canUseProjectFiles={projectCapabilities.canUseProjectFiles}
              showCardWatermark={showVisibleCardWatermark}
              isActive={effectiveActiveTab === 'template-maker'}
              onSaveTemplate={handleSaveTemplate}
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
              canSubmitSharedTemplateRevision={developerAccess.canSubmitTemplateRevisions}
              canPublishSharedLibrary={developerAccess.canPublishSharedLibrary}
              canUploadCustomAssets={canUploadCustomAssets}
              onReturnToTemplateMaker={() => setActiveTabAction('template-maker')}
              requestedBackFormat={matchingBackRequest}
              onRequestedBackFormatConsumed={clearMatchingBackRequest}
            />
          </TabsContent>

          <TabsContent value="generator" data-testid="generator-panel">
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

        </Tabs>
      </main>
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
      <footer className="border-t border-[#5f4526] p-4 text-center text-sm text-[#a8946d] no-print">
        {businessIdentity.brandName} &copy; {new Date().getFullYear()} {businessIdentity.copyrightHolder}
      </footer>
    </div>
  );
}

    
