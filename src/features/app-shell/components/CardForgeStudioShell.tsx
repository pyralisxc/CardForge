
"use client";

import { useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/card-forge/Header';
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
import { useCardForgeWorkspaceState } from '@/features/app-shell/hooks/useCardForgeWorkspaceState';
import { useProjectFileActions } from '@/features/project/hooks/useProjectFileActions';
import { useBootstrapLibraries } from '@/features/app-shell/hooks/useBootstrapLibraries';
import { useCheckoutActions } from '@/features/billing/hooks/useCheckoutActions';
import { useCardZipExportActions } from '@/features/card-generator/hooks/useCardZipExportActions';
import { useGeneratedOutputActions } from '@/features/card-generator/hooks/useGeneratedOutputActions';
import { useTemplateLibraryActions } from '@/features/template-library/hooks/useTemplateLibraryActions';
import { canUploadCustomLocalAssets } from '@/features/project/lib/projectLocalAssets';

const WorkspaceLoadingState = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e4aa43] border-t-transparent" aria-label="Loading workspace" />
  </div>
);

const CardTemplateMaker = dynamic(
  () => import('@/components/card-forge/CardTemplateMaker').then((module) => module.CardTemplateMaker),
  { ssr: false, loading: WorkspaceLoadingState },
);

const GenerationWorkspace = dynamic(
  () => import('@/features/card-generator/components/GenerationWorkspace').then((module) => module.GenerationWorkspace),
  { ssr: false, loading: WorkspaceLoadingState },
);

const EditCardDialog = dynamic(
  () => import('@/components/card-forge/EditCardDialog').then((module) => module.EditCardDialog),
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
  'Generate one card or import rows',
  'Export previews or save a project file',
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
      openEditDialogAction,
      retargetGeneratedCardsTemplateAction,
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
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(() => (
    typeof window === 'undefined'
      ? true
      : window.localStorage.getItem(STUDIO_GUIDE_STORAGE_KEY) !== 'dismissed'
  ));
  const [gallerySearch, setGallerySearch] = useState('');
  const [gallerySort, setGallerySort] = useState<'default' | 'name-asc' | 'name-desc' | 'template'>('default');

  const { isLoadingTemplates } = useBootstrapLibraries({
    setAppearanceStylesFromFiles: setAppearanceStylesFromFilesAction,
    setDefaultTemplatesFromFiles: setDefaultTemplatesFromFilesAction,
    setUserTemplatesFromFiles: setUserTemplatesFromFilesAction,
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
    retargetGeneratedCardsTemplate: retargetGeneratedCardsTemplateAction,
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
    handleExportProject,
    handleImportProject,
  } = useProjectFileActions({
    appearanceStyles,
    exportDpi,
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
    setSelectedPaperSize: setSelectedPaperSizeAction,
    setStoredCardsFromFile: setStoredCardsFromFileAction,
    setUserTemplatesFromFiles: setUserTemplatesFromFilesAction,
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

  const effectiveActiveTab = TABS_CONFIG.some(tab => tab.value === activeTab) ? activeTab : TABS_CONFIG[0].value;

  // Comment: Initial selection of template for single card generator (and now bulk generator)
  // is handled by Zustand's _rehydrateCallback or other actions modifying the templates list.

  return (
    <div className="flex min-h-screen flex-col bg-[#0c0b09] text-[#f7ead0]">
      <Header
        authConfigured={accountEntitlement.authConfigured}
        isSignedIn={accountEntitlement.isSignedIn}
        modeLabel={exportEntitlementLabel}
        onRefreshEntitlement={accountEntitlement.refreshEntitlement}
      />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
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
        <Tabs value={effectiveActiveTab} onValueChange={setActiveTabAction} className="w-full">
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

          <TabsList className="mb-6 hidden w-full border border-[#5f4526] bg-[#15100a] md:grid md:grid-cols-2 no-print">
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

          <TabsContent value="template-maker">
            <CardTemplateMaker
              onSaveTemplate={handleSaveTemplate}
              templates={templatesFromStore}
              defaultTemplates={standardDefaultTemplates}
              backFaceTemplates={backFacePresetTemplates}
              userTemplates={userTemplatesFromStore}
              appearanceStyles={appearanceStyles}
              onSaveAppearanceStyle={handleSaveAppearanceStyle}
              onDeleteAppearanceStyle={handleDeleteAppearanceStyle}
              onDeleteTemplate={handleDeleteTemplate}
              onCloneTemplate={handleCloneTemplate}
              selectedTemplateIdForEditing={singleCardGeneratorSelectedTemplateId}
              onSelectTemplateForEditing={setSingleCardGeneratorSelectedTemplateIdAction}
              canUploadCustomAssets={canUploadCustomAssets}
            />
          </TabsContent>

          <TabsContent value="generator">
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
              fileInputRef={fileInputRef}
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
              onSaveCardSet={handleExportProject}
              onLoadCardSet={handleImportProject}
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
      <footer className="border-t border-[#5f4526] p-4 text-center text-sm text-[#a8946d] no-print">
        CardForge Studio &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    

