
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { CheckCircle2, MenuIcon, X } from 'lucide-react';

import { TABS_CONFIG } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { StudioHeader } from '@/features/app-shell/components/StudioHeader';
import { useCardForgeWorkspaceState } from '@/features/app-shell/hooks/useCardForgeWorkspaceState';
import { useProjectFileActions } from '@/features/project/hooks/useProjectFileActions';
import { useBootstrapLibraries } from '@/features/app-shell/hooks/useBootstrapLibraries';
import { useCheckoutActions } from '@/features/billing/hooks/useCheckoutActions';
import { useCardZipExportActions } from '@/features/card-generator/hooks/useCardZipExportActions';
import { useGeneratedOutputActions } from '@/features/card-generator/hooks/useGeneratedOutputActions';
import { useTemplateLibraryActions } from '@/features/template-library/hooks/useTemplateLibraryActions';
import { canUploadCustomLocalAssets } from '@/features/project/lib/projectLocalAssets';

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
            <p className="mt-2 text-sm leading-6 text-[#cbb58b]">Loading the editor, library assets, and generated-output workspace.</p>
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
  () => import('@/features/template-editor/components/CardTemplateMaker').then((module) => module.CardTemplateMaker),
  { ssr: false, loading: WorkspaceLoadingState },
);

const GenerationWorkspace = dynamic(
  () => import('@/features/card-generator/components/GenerationWorkspace').then((module) => module.GenerationWorkspace),
  { ssr: false, loading: WorkspaceLoadingState },
);

const EditCardDialog = dynamic(
  () => import('@/features/card-generator/components/EditCardDialog').then((module) => module.EditCardDialog),
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

const firstRunSteps = [
  'Pick or clone a template',
  'Edit the layout and variables',
  'Generate single or bulk outputs',
  'Upgrade for clean exports and project files',
] as const;

export function CardForgeStudioShell() {
  const { toast } = useToast();
  const accountEntitlement = useAccountEntitlement();
  const projectCapabilities = accountEntitlement.capabilities;
  const exportEntitlementCopy = accountEntitlement.copy;
  const exportGateMessage = accountEntitlement.copy.gateMessage;
  const exportEntitlementLabel = accountEntitlement.authConfigured
    ? exportEntitlementCopy.modeLabel
    : 'Local setup mode';
  const accessExpiresOn = formatAccessExpiration(accountEntitlement.accessExpiresAt);
  const exportEntitlementMessage = accountEntitlement.authConfigured
    ? accessExpiresOn
      ? `${exportEntitlementCopy.panelMessage} Beta access is active through ${accessExpiresOn}.`
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
      setActiveTabAction,
      setAppearanceStylesFromFilesAction,
      setDefaultTemplatesFromFilesAction,
      setExportDpiAction,
      setExportModeAction,
      setPdfOptionsAction,
      setSelectedPaperSizeAction,
      setSingleCardGeneratorSelectedTemplateIdAction,
      setStoredCardsFromFileAction,
      setUserTemplatesFromFilesAction,
      updateGeneratedCardAction,
    },
    state: {
      activeTab,
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
      selectedPaperSize,
      singleCardGeneratorSelectedTemplateId,
      standardDefaultTemplates,
      storedCards,
      templatesFromStore,
      userTemplatesFromStore,
    },
  } = useCardForgeWorkspaceState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(true);
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
    handleDeleteAppearanceStyle,
    handleDeleteTemplate,
    handleSaveAppearanceStyle,
    handleSaveTemplate,
    setTemplatePendingDeleteId,
    templatePendingDeleteId,
  } = useTemplateLibraryActions({
    addOrUpdateAppearanceStyle: addOrUpdateAppearanceStyleAction,
    addOrUpdateTemplate: addOrUpdateTemplateAction,
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
    handleSaveEditedCard,
    handleSingleCardAdded,
    isClearCardsDialogOpen,
    setIsClearCardsDialogOpen,
  } = useGeneratedOutputActions({
    addGeneratedCards: addGeneratedCardsAction,
    clearGeneratedCards: clearGeneratedCardsAction,
    closeEditDialog: closeEditDialogAction,
    openEditDialog: openEditDialogAction,
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
    zipProgress,
  } = useCardZipExportActions({
    canExportClean: projectCapabilities.canExportClean,
    exportDpi,
    exportGateMessage,
    exportMode,
    generatedDisplayCards,
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

  const handleMobileMenuSelect = useCallback((tabValue: string) => {
    setActiveTabAction(tabValue);
    setIsMobileMenuOpen(false);
  }, [setActiveTabAction]);

  const handleDismissFirstRunGuide = useCallback(() => {
    setShowFirstRunGuide(false);
    window.localStorage.setItem(STUDIO_GUIDE_STORAGE_KEY, 'dismissed');
  }, []);

  useEffect(() => {
    setShowFirstRunGuide(window.localStorage.getItem(STUDIO_GUIDE_STORAGE_KEY) !== 'dismissed');
  }, []);

  const effectiveActiveTab = TABS_CONFIG.some(tab => tab.value === activeTab) ? activeTab : TABS_CONFIG[0].value;
  const isStudioReady = !isLoadingTemplates;

  // Comment: Initial selection of template for single card generator (and now bulk generator)
  // is handled by Zustand's _rehydrateCallback or other actions modifying the templates list.

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-[#0c0b09] text-[#f7ead0]">
      <StudioHeader
        authConfigured={accountEntitlement.authConfigured}
        isSignedIn={accountEntitlement.isSignedIn}
        modeLabel={exportEntitlementLabel}
        onRefreshEntitlement={accountEntitlement.refreshEntitlement}
      />
      <main className="cardforge-studio-main container mx-auto w-full max-w-full flex-grow p-4 md:p-6 lg:p-8">
        {isStudioReady ? (
          <div data-testid="studio-ready" className="sr-only">Studio ready</div>
        ) : (
          <div data-testid="studio-loading" className="sr-only">Preparing studio</div>
        )}
        {showFirstRunGuide ? (
          <section className="mb-4 border border-[#6d4f2b] bg-[#15100a] p-4 no-print md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2aa4a]">First run path</p>
                <h1 className="mt-2 font-serif text-2xl font-semibold text-[#fff1c7]">Make one card before tuning everything.</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cbb58b]">
                  CardForge is local-first: design work stays in this browser until you export a project file, card images, or submit an asset for review.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start text-[#c8b07f] hover:bg-[#24180e] hover:text-[#fff3ca]"
                onClick={handleDismissFirstRunGuide}
                aria-label="Dismiss first run guide"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {firstRunSteps.map((step, index) => (
                <div key={step} className="flex gap-3 border border-[#4a3823] bg-[#100c08] p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#e2aa4a]" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">{String(index + 1).padStart(2, '0')}</p>
                    <p className="text-sm leading-5 text-[#d8c49a]">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <Tabs value={effectiveActiveTab} onValueChange={setActiveTabAction} className="w-full min-w-0">
          <div className="cardforge-studio-context mb-4 border border-[#4a3823] bg-[#100c08] px-3 py-2 text-xs leading-5 text-[#cbb58b] no-print md:flex md:items-center md:justify-between md:gap-4">
            <p><span className="font-semibold text-[#fff1c7]">Layout Studio</span> builds templates, text modes, and variables.</p>
            <p><span className="font-semibold text-[#fff1c7]">Generate</span> fills those contracts and keeps outputs visible for review, edits, and export.</p>
          </div>
          <div className="md:hidden mb-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <MenuIcon className="h-5 w-5" />
                  Menu ({TABS_CONFIG.find(t => t.value === effectiveActiveTab)?.label})
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="text-lg font-semibold">Navigation</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col space-y-2">
                  {TABS_CONFIG.map(tab => (
                    <Button
                      key={tab.value}
                      variant={effectiveActiveTab === tab.value ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleMobileMenuSelect(tab.value)}
                    >
                      <tab.icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </Button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          <TabsList className="cardforge-studio-tabs mb-6 hidden w-full border border-[#5f4526] bg-[#15100a] md:grid md:grid-cols-2 no-print">
            {TABS_CONFIG.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 text-[#c8b07f] data-[state=active]:bg-[#24180e] data-[state=active]:text-[#ffe7ad]"
                onClick={() => setActiveTabAction(tab.value)}
              >
                <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="template-maker" forceMount data-testid="layout-studio-panel" className="data-[state=inactive]:hidden">
            <CardTemplateMaker
              canUseProjectFiles={projectCapabilities.canExportClean}
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
              onDeleteAppearanceStyle={handleDeleteAppearanceStyle}
              onDeleteTemplate={handleDeleteTemplate}
              onCloneTemplate={handleCloneTemplate}
              onExportProject={handleExportProject}
              onImportProject={handleChooseImportProject}
              onLoadProject={handleImportProject}
              onStartCheckout={handleStartCheckout}
              projectFileGateMessage={exportGateMessage}
              selectedTemplateIdForEditing={singleCardGeneratorSelectedTemplateId}
              onSelectTemplateForEditing={setSingleCardGeneratorSelectedTemplateIdAction}
              canUploadCustomAssets={canUploadCustomAssets}
            />
          </TabsContent>

          <TabsContent value="generator" data-testid="generator-panel">
            <GenerationWorkspace
              isLoadingTemplates={isLoadingTemplates}
              templates={freeformTemplatesForGenerator}
              generatorSelectedTemplateId={generatorSelectedTemplateId}
              selectedPaperSize={selectedPaperSize}
              pdfMarginMm={pdfMarginMm}
              pdfCardSpacingMm={pdfCardSpacingMm}
              pdfIncludeCutLines={pdfIncludeCutLines}
              pdfDuplexLayout={pdfDuplexLayout}
              exportMode={exportMode}
              exportDpi={exportDpi}
              generatedDisplayCards={generatedDisplayCards}
              zipProgress={zipProgress}
              gallerySearch={gallerySearch}
              gallerySort={gallerySort}
              isZipExporting={isZipExporting}
              isCheckoutStarting={isCheckoutStarting}
              canExportClean={projectCapabilities.canExportClean}
              exportGateMessage={exportGateMessage}
              exportEntitlementLabel={exportEntitlementLabel}
              exportEntitlementMessage={exportEntitlementMessage}
              accountAccessMode={accountEntitlement.authConfigured ? accountEntitlement.accessMode : 'setup'}
              accountEmail={accountEntitlement.accountEmail}
              accountSource={accountEntitlement.source}
              authConfigured={accountEntitlement.authConfigured}
              isSignedIn={accountEntitlement.isSignedIn}
              onOpenTemplateMaker={() => setActiveTabAction('template-maker')}
              onSingleCardAdded={handleSingleCardAdded}
              onBulkCardsGenerated={handleBulkCardsGenerated}
              onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateIdAction}
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
            />
          </TabsContent>

        </Tabs>
      </main>
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
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const template = templatesFromStore.find(t => t.id === templatePendingDeleteId);
                const dependentCardCount = storedCards.filter(card => card.templateId === templatePendingDeleteId).length;
                return `"${template?.name || templatePendingDeleteId || 'This template'}" will be permanently removed from this browser. ${dependentCardCount} generated output${dependentCardCount === 1 ? '' : 's'} using it will also be removed.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isClearCardsDialogOpen} onOpenChange={setIsClearCardsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all generated outputs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {generatedDisplayCards.length} generated output{generatedDisplayCards.length === 1 ? '' : 's'} from this browser. Templates will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearGeneratedCards} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear Outputs
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
                  {pendingProjectImport?.preview.templateCount ?? 0} template{pendingProjectImport?.preview.templateCount === 1 ? '' : 's'},{' '}
                  {pendingProjectImport?.preview.outputCount ?? 0} generated output{pendingProjectImport?.preview.outputCount === 1 ? '' : 's'},{' '}
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
                  Replace loads the file as the local project. Merge adds or updates templates, outputs, styles, assets, and export settings without clearing current local work.
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
        CardForge Studio &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    

