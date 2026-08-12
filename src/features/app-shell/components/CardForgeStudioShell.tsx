
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { X } from 'lucide-react';

import { STUDIO_TABS } from '@/features/app-shell/lib/studioTabs';
import { useToast } from '@/components/ui/use-toast';

import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { StudioHeader } from '@/features/app-shell/components/StudioHeader';
import { useCardForgeWorkspaceState } from '@/features/app-shell/hooks/useCardForgeWorkspaceState';
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

const WorkspaceLoadingState = () => (
  <div data-testid="studio-loading" className="min-h-[60vh] rounded border border-[#5f4526] bg-[#090807] text-[#f7ead0]" role="status" aria-live="polite">
    <div className="grid min-h-[60vh] gap-0 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="hidden border-r border-[#2f2417] bg-[#0d1118] p-5 lg:block">
        <div className="h-4 w-28 rounded bg-[#d8b365]/25" />
        <div className="mt-5 space-y-3">
          <div className="h-20 rounded border border-[#2f3a47] bg-[#111827]" />
          <div className="h-20 rounded border border-[#2f3a47] bg-[#111827]" />
          <div className="h-20 rounded border border-[#2f3a47] bg-[#111827]" />
        </div>
      </aside>
      <section className="flex items-center justify-center bg-[linear-gradient(90deg,rgba(216,179,101,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(216,179,101,0.08)_1px,transparent_1px)] bg-[size:32px_32px] p-8">
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#e4aa43] border-t-transparent" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2aa4a]">Preparing Studio</p>
            <p className="mt-2 text-sm leading-6 text-[#cbb58b]">Loading your card designs and card set.</p>
          </div>
        </div>
      </section>
      <aside className="hidden border-l border-[#2f2417] bg-[#11161f] p-5 lg:block">
        <div className="h-4 w-24 rounded bg-[#d8b365]/25" />
        <div className="mt-5 space-y-3">
          <div className="h-24 rounded border border-[#2f3a47] bg-[#0d1118]" />
          <div className="h-28 rounded border border-[#2f3a47] bg-[#0d1118]" />
          <div className="h-16 rounded border border-[#2f3a47] bg-[#0d1118]" />
        </div>
      </aside>
    </div>
  </div>
);

const CardTemplateMaker = dynamic(
  () => import('@/features/template-editor/client')
    .then((module) => module.loadCardTemplateMaker())
    .then((module) => module.CardTemplateMaker),
  { ssr: false, loading: WorkspaceLoadingState },
);

const GenerationWorkspace = dynamic(
  () => import('@/features/card-generator/client')
    .then((module) => module.loadGenerationWorkspace())
    .then((module) => module.GenerationWorkspace),
  { ssr: false, loading: WorkspaceLoadingState },
);

const EditCardDialog = dynamic(
  () => import('@/features/card-generator/client')
    .then((module) => module.loadEditCardDialog())
    .then((module) => module.EditCardDialog),
  { ssr: false },
);

const formatAccessExpiration = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const STUDIO_GUIDE_STORAGE_KEY = 'cardforge-studio-guide-dismissed';

export type StudioBusinessIdentity = {
  brandName: string;
  copyrightHolder: string;
};

export function CardForgeStudioShell({
  businessIdentity,
}: {
  businessIdentity: StudioBusinessIdentity;
}) {
  const { toast } = useToast();
  const accountEntitlement = useAccountEntitlement();
  const projectCapabilities = accountEntitlement.capabilities;
  const workspaceSaveStatus = useBrowserWorkspaceSaveStatus();
  const showVisibleCardWatermark = shouldShowVisibleCardWatermark(projectCapabilities.canExportClean);
  const exportEntitlementCopy = accountEntitlement.copy;
  const exportGateMessage = accountEntitlement.copy.gateMessage;
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
      singleCardGeneratorSelectedTemplateId,
      standardDefaultTemplates,
      storedCards,
      templatesFromStore,
      userTemplatesFromStore,
    },
  } = useCardForgeWorkspaceState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstRunGuideDismissedRef = useRef(false);
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [gallerySort, setGallerySort] = useState<'default' | 'name-asc' | 'name-desc' | 'template'>('default');

  const { isLoadingTemplates } = useBootstrapLibraries({
    setAppearanceStylesFromFiles: setAppearanceStylesFromFilesAction,
    setDefaultTemplatesFromFiles: setDefaultTemplatesFromFilesAction,
    mergeUserTemplatesFromFiles: mergeUserTemplatesFromFilesAction,
  });

  const {
    handleCloneTemplate,
    handleConfirmDeleteTemplate,
    handleDeleteTemplate,
    handleSaveAppearanceStyle,
    handleSaveTemplate,
    setTemplatePendingDeleteId,
    templatePendingDeleteId,
  } = useTemplateLibraryActions({
    addOrUpdateAppearanceStyle: addOrUpdateAppearanceStyleAction,
    addOrUpdateTemplate: addOrUpdateTemplateAction,
    appearanceStyles,
    cloneTemplate: cloneTemplateAction,
    deleteAppearanceStyle: deleteAppearanceStyleAction,
    deleteTemplate: deleteTemplateAction,
    projectCapabilities,
    setSingleCardGeneratorSelectedTemplateId: setSingleCardGeneratorSelectedTemplateIdAction,
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
    canUseProjectFiles: projectCapabilities.canExportClean,
    exportDpi,
    projectFileGateMessage: exportGateMessage,
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

  // Comment: Initial selection of template for single card generator (and now bulk generator)
  // is handled by Zustand's _rehydrateCallback or other actions modifying the templates list.

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-[#0c0b09] text-[#f7ead0]">
      <StudioHeader
        authConfigured={accountEntitlement.authConfigured}
        isLoadingAccount={accountEntitlement.isLoadingEntitlement}
        isSignedIn={accountEntitlement.isSignedIn}
        modeLabel={exportEntitlementLabel}
        saveStatus={workspaceSaveStatus}
        onRefreshEntitlement={accountEntitlement.refreshEntitlement}
      />
      <main className="cardforge-studio-main container mx-auto w-full max-w-full flex-grow p-4 md:p-6 lg:p-8">
        {isStudioReady ? (
          <div data-testid="studio-ready" className="sr-only">Studio ready</div>
        ) : (
          <div data-testid="studio-loading" className="sr-only">Preparing studio</div>
        )}
        {showFirstRunGuide ? (
          <section className="relative mb-4 border border-[#6d4f2b] bg-[#15100a] p-4 no-print md:p-5">
            <div className="pr-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2aa4a]">Welcome to the forge</p>
                <h1 className="mt-2 font-serif text-2xl font-semibold text-[#fff1c7]">Make one card, then build the set.</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cbb58b]">
                  Choose a ready-made card design and add your card details. Your work saves in this browser as you go. Clearing browser data or changing devices can remove this copy; a downloaded project backup is the portable recovery path when it is available to you.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 text-[#c8b07f] hover:bg-[#24180e] hover:text-[#fff3ca]"
              onClick={handleDismissFirstRunGuide}
              aria-label="Dismiss first run guide"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={handleStartMakingCards}>Start making cards</Button>
              <Button type="button" variant="outline" onClick={handleEditDesignFirst}>Design the layout first</Button>
            </div>
          </section>
        ) : null}
        <Tabs value={effectiveActiveTab} onValueChange={setActiveTabAction} className="w-full min-w-0">
          <div className="cardforge-studio-context mb-4 border border-[#4a3823] bg-[#100c08] px-3 py-2 text-xs leading-5 text-[#cbb58b] no-print md:flex md:items-center md:justify-between md:gap-4">
            <p><span className="font-semibold text-[#fff1c7]">Design layouts</span> shapes card designs and their fields.</p>
            <p><span className="font-semibold text-[#fff1c7]">Make Cards</span> adds card details, then keeps every card ready for review and export.</p>
          </div>
          <TabsList className="cardforge-studio-tabs mb-4 grid h-auto w-full grid-cols-2 border border-[#5f4526] bg-[#15100a] p-1 no-print md:mb-6">
            {STUDIO_TABS.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-testid={`studio-tab-${tab.value}`}
                className="flex min-h-11 items-center justify-center gap-2 px-2 text-xs text-[#c8b07f] data-[state=active]:bg-[#24180e] data-[state=active]:text-[#ffe7ad] sm:text-sm"
                onClick={() => setActiveTabAction(tab.value)}
              >
                <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="template-maker" forceMount data-testid="layout-studio-panel" tabIndex={-1} className="data-[state=inactive]:hidden">
            <CardTemplateMaker
              canUseProjectFiles={projectCapabilities.canExportClean}
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
              projectFileGateMessage={exportGateMessage}
              selectedTemplateIdForEditing={singleCardGeneratorSelectedTemplateId}
              onSelectTemplateForEditing={setSingleCardGeneratorSelectedTemplateIdAction}
              canSavePipelineTemplate={projectCapabilities.canWriteShippedLibrary}
              canUploadCustomAssets={canUploadCustomAssets}
              onReturnToTemplateMaker={() => setActiveTabAction('template-maker')}
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
      <BrowserStorageAlerts canUseProjectFiles={projectCapabilities.canExportClean} />
      {isEditDialogOpen && editingCardFromStore && (
        <EditCardDialog
            isOpen={isEditDialogOpen}
            card={editingCardFromStore}
            onSave={handleSaveEditedCard}
            onDuplicate={handleDuplicateCard}
            onClose={handleCloseEditDialog}
        />
      )}
      <AlertDialog open={!!templatePendingDeleteId} onOpenChange={(open) => !open && setTemplatePendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card design?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const template = templatesFromStore.find(t => t.id === templatePendingDeleteId);
                const dependentCardCount = storedCards.filter(card => card.templateId === templatePendingDeleteId).length;
                return `"${template?.name || templatePendingDeleteId || 'This card design'}" will be permanently removed from this browser. ${dependentCardCount} card${dependentCardCount === 1 ? '' : 's'} using it will also be removed.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Card Design
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isClearCardsDialogOpen} onOpenChange={setIsClearCardsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all cards from this set?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {generatedDisplayCards.length} card{generatedDisplayCards.length === 1 ? '' : 's'} from this browser. Card designs will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearGeneratedCards} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Cards
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!pendingProjectImport} onOpenChange={(open) => !open && clearPendingProjectImport()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import project file?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm leading-6">
                <p>
                  {pendingProjectImport?.preview.fileName || 'Selected file'} includes{' '}
                  {pendingProjectImport?.preview.templateCount ?? 0} card design{pendingProjectImport?.preview.templateCount === 1 ? '' : 's'},{' '}
                  {pendingProjectImport?.preview.outputCount ?? 0} card{pendingProjectImport?.preview.outputCount === 1 ? '' : 's'},{' '}
                  {pendingProjectImport?.preview.appearanceStyleCount ?? 0} style preset{pendingProjectImport?.preview.appearanceStyleCount === 1 ? '' : 's'}, and{' '}
                  {pendingProjectImport?.preview.customAssetCount ?? 0} custom asset{pendingProjectImport?.preview.customAssetCount === 1 ? '' : 's'}.
                </p>
                {(pendingProjectImport?.preview.templateIdConflicts.length || pendingProjectImport?.preview.templateNameConflicts.length) ? (
                  <p>
                    Matching templates found: {[
                      ...(pendingProjectImport?.preview.templateIdConflicts ?? []),
                      ...(pendingProjectImport?.preview.templateNameConflicts ?? []),
                    ].slice(0, 4).join(', ')}.
                  </p>
                ) : null}
                <p>
                  Replace loads the file as the local project. Merge adds or updates card designs, cards, styles, assets, and export settings without clearing current local work.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => applyPendingProjectImport('merge')}>
              Merge Into Current
            </Button>
            <AlertDialogAction onClick={() => applyPendingProjectImport('replace')}>
              Replace Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <footer className="border-t border-[#5f4526] p-4 text-center text-sm text-[#a8946d] no-print">
        {businessIdentity.brandName} &copy; {new Date().getFullYear()} {businessIdentity.copyrightHolder}
      </footer>
    </div>
  );
}

    
