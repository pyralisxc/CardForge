
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
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
import { MenuIcon } from 'lucide-react';

import { useAppStore } from '@/store/appStore';
import { selectAllTemplates, selectEditingCard, selectGeneratedDisplayCards } from '@/store/selectors';
import { TABS_CONFIG } from '@/lib/constants';
import type { AppearanceStyleLibrary, AppearanceStylePreset, TCGCardTemplate, PaperSize, DisplayCard, StoredDisplayCard, CardFace } from '@/types';
import { useToast } from '@/hooks/use-toast';

import { nanoid } from 'nanoid';
import { getExportProfile, type ExportMode } from '@/lib/printValidation';
import { loadBootstrapStyles, loadBootstrapTemplates } from '@/lib/clientBootstrapData';

const WorkspaceLoadingState = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Loading workspace" />
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

export default function CardForgePage() {
  const { toast } = useToast();

  // Zustand store selectors
  const defaultTemplatesFromStore = useAppStore((state) => state.defaultTemplates);
  const userTemplatesFromStore = useAppStore((state) => state.userTemplates);
  const templatesFromStore = useAppStore(selectAllTemplates);
  const standardDefaultTemplates = defaultTemplatesFromStore.filter((template) => template.templateUsage !== 'back-preset');
  const backFacePresetTemplates = defaultTemplatesFromStore.filter((template) => template.templateUsage === 'back-preset');
  const freeformTemplatesForGenerator = templatesFromStore.filter((template) => template.templateUsage !== 'back-preset');
  const appearanceStyles = useAppStore((state) => state.appearanceStyles);
  const storedCards = useAppStore((state) => state.storedCards);
  const generatedDisplayCards = useAppStore(selectGeneratedDisplayCards);
  
  const selectedPaperSize = useAppStore((state) => state.selectedPaperSize);
  const activeTab = useAppStore((state) => state.activeTab);
  const singleCardGeneratorSelectedTemplateId = useAppStore((state) => state.singleCardGeneratorSelectedTemplateId);
  const generatorSelectedTemplateId = freeformTemplatesForGenerator.some(template => template.id === singleCardGeneratorSelectedTemplateId)
    ? singleCardGeneratorSelectedTemplateId
    : (freeformTemplatesForGenerator.find(template => template.id)?.id || null);
  const pdfMarginMm = useAppStore((state) => state.pdfMarginMm);
  const pdfCardSpacingMm = useAppStore((state) => state.pdfCardSpacingMm);
  const pdfIncludeCutLines = useAppStore((state) => state.pdfIncludeCutLines);
  const pdfDuplexLayout = useAppStore((state) => state.pdfDuplexLayout);
  const exportMode = useAppStore((state) => state.exportMode);
  const exportDpi = useAppStore((state) => state.exportDpi);
  const editingCardFromStore = useAppStore(selectEditingCard);
  const isEditDialogOpen = useAppStore((state) => state.isEditDialogOpen);
  
  // Zustand store actions
  const addOrUpdateTemplateAction = useAppStore((state) => state.addOrUpdateTemplate);
  const setDefaultTemplatesFromFilesAction = useAppStore((state) => state.setDefaultTemplatesFromFiles);
  const setUserTemplatesFromFilesAction = useAppStore((state) => state.setUserTemplatesFromFiles);
  const deleteTemplateAction = useAppStore((state) => state.deleteTemplate);
  const cloneTemplateAction = useAppStore((state) => state.cloneTemplate);
  const setAppearanceStylesFromFilesAction = useAppStore((state) => state.setAppearanceStylesFromFiles);
  const addOrUpdateAppearanceStyleAction = useAppStore((state) => state.addOrUpdateAppearanceStyle);
  const deleteAppearanceStyleAction = useAppStore((state) => state.deleteAppearanceStyle);
  const addGeneratedCardsAction = useAppStore((state) => state.addGeneratedCards);
  const clearGeneratedCardsAction = useAppStore((state) => state.clearGeneratedCards);
  const updateGeneratedCardAction = useAppStore((state) => state.updateGeneratedCard);
  const retargetGeneratedCardsTemplateAction = useAppStore((state) => state.retargetGeneratedCardsTemplate);
  const setStoredCardsFromFileAction = useAppStore((state) => state.setStoredCardsFromFile);
  const setSelectedPaperSizeAction = useAppStore((state) => state.setSelectedPaperSize);
  const setActiveTabAction = useAppStore((state) => state.setActiveTab);
  const setSingleCardGeneratorSelectedTemplateIdAction = useAppStore((state) => state.setSingleCardGeneratorSelectedTemplateId);
  const setPdfOptionsAction = useAppStore((state) => state.setPdfOptions);
  const setExportModeAction = useAppStore((state) => state.setExportMode);
  const setExportDpiAction = useAppStore((state) => state.setExportDpi);
  const openEditDialogAction = useAppStore((state) => state.openEditDialog);
  const closeEditDialogAction = useAppStore((state) => state.closeEditDialog);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [gallerySearch, setGallerySearch] = useState('');
  const [gallerySort, setGallerySort] = useState<'default' | 'name-asc' | 'name-desc' | 'template'>('default');
  const [templatePendingDeleteId, setTemplatePendingDeleteId] = useState<string | null>(null);
  const [isClearCardsDialogOpen, setIsClearCardsDialogOpen] = useState(false);
  const [isZipExporting, setIsZipExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFileBackedTemplates = async () => {
      try {
        const payload = await loadBootstrapTemplates();
        if (cancelled) return;
        setDefaultTemplatesFromFilesAction(Array.isArray(payload.defaults) ? payload.defaults : []);
        setUserTemplatesFromFilesAction(Array.isArray(payload.userTemplates) ? payload.userTemplates : []);
      } catch (error) {
        console.warn('Unable to load file-backed templates:', error);
      } finally {
        if (!cancelled) setIsLoadingTemplates(false);
      }
    };

    loadFileBackedTemplates();
    return () => {
      cancelled = true;
    };
  }, [setDefaultTemplatesFromFilesAction, setUserTemplatesFromFilesAction]);

  useEffect(() => {
    let cancelled = false;

    const loadFileBackedStyles = async () => {
      try {
        const payload = await loadBootstrapStyles() as Partial<AppearanceStyleLibrary>;
        if (cancelled || !Array.isArray(payload.styles)) return;
        setAppearanceStylesFromFilesAction(payload.styles);
      } catch (error) {
        console.warn('Unable to load file-backed styles:', error);
      }
    };

    loadFileBackedStyles();
    return () => {
      cancelled = true;
    };
  }, [setAppearanceStylesFromFilesAction]);

  const handleSaveAppearanceStyle = useCallback((style: AppearanceStylePreset): string => {
    const savedId = addOrUpdateAppearanceStyleAction(style);
    void fetch('/api/styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(style),
    }).catch((error) => {
      console.warn('Unable to save style file:', error);
    });
    toast({ title: "Style Saved", description: `"${style.name}" is available in Appearance Studio.` });
    return savedId;
  }, [addOrUpdateAppearanceStyleAction, toast]);

  const handleDeleteAppearanceStyle = useCallback((styleId: string) => {
    deleteAppearanceStyleAction(styleId);
    void fetch('/api/styles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: styleId }),
    }).catch((error) => {
      console.warn('Unable to delete style file:', error);
    });
  }, [deleteAppearanceStyleAction]);

  const handleSaveTemplate = useCallback((template: TCGCardTemplate): string => {
    const sourceTemplateId = template.id;
    const templateToSave = template.templateSource === 'default'
      ? {
          ...template,
          id: nanoid(),
          templateSource: 'user' as const,
        }
      : template;
    // The addOrUpdateTemplateAction in the store handles reconstruction.
    const savedTemplateId = addOrUpdateTemplateAction(templateToSave, templateToSave.templateSource);
    if (sourceTemplateId && savedTemplateId !== sourceTemplateId) {
      retargetGeneratedCardsTemplateAction(sourceTemplateId, savedTemplateId);
      setSingleCardGeneratorSelectedTemplateIdAction(savedTemplateId);
    }
    toast({
      title: "Template Saved",
      description: template.templateSource === 'default'
        ? `"${templateToSave.name || savedTemplateId}" has been saved as a user template so shipped defaults stay clean.`
        : `"${templateToSave.name || savedTemplateId}" has been saved.`,
    });
    const templateForFile = selectAllTemplates(useAppStore.getState()).find(t => t.id === savedTemplateId);
    if (templateForFile) {
      void fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForFile),
      }).catch((error) => {
        console.warn('Unable to save template file:', error);
      });
    }
    return savedTemplateId;
  }, [addOrUpdateTemplateAction, retargetGeneratedCardsTemplateAction, setSingleCardGeneratorSelectedTemplateIdAction, toast]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplatePendingDeleteId(templateId);
  }, []);

  const handleConfirmDeleteTemplate = useCallback(() => {
    if (!templatePendingDeleteId) return;
    const templateId = templatePendingDeleteId;
    const templateToDelete = templatesFromStore.find(t => t.id === templateId);
    const dependentCardCount = storedCards.filter(card => card.templateId === templateId).length;
    deleteTemplateAction(templateId, templateToDelete?.templateSource);
    void fetch('/api/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: templateId, source: templateToDelete?.templateSource }),
    }).catch((error) => {
      console.warn('Unable to delete template file:', error);
    });
    setTemplatePendingDeleteId(null);
    toast({
      title: "Template Deleted",
      description: `"${templateToDelete?.name || templateId}" and ${dependentCardCount} generated card${dependentCardCount === 1 ? '' : 's'} using it have been removed.`,
    });
  }, [deleteTemplateAction, storedCards, templatePendingDeleteId, toast, templatesFromStore]);

  const handleCloneTemplate = useCallback((templateId: string): string | null => {
    const source = templatesFromStore.find(t => t.id === templateId);
    const newId = cloneTemplateAction(templateId);
    if (newId) toast({ title: "Template Cloned", description: `"Copy of ${source?.name || templateId}" created.` });
    return newId;
  }, [cloneTemplateAction, toast, templatesFromStore]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    addGeneratedCardsAction(cards);
    if (cards.length > 0) toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added.` });
  }, [addGeneratedCardsAction, toast]);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    addGeneratedCardsAction([card]);
  }, [addGeneratedCardsAction]);

  const handleClearGeneratedCards = useCallback(() => {
    clearGeneratedCardsAction();
    setIsClearCardsDialogOpen(false);
    toast({ title: "Cleared", description: "Generated cards have been cleared." });
  }, [clearGeneratedCardsAction, toast]);

  const handleEditCardRequest = useCallback((cardToEdit: DisplayCard) => {
    openEditDialogAction(cardToEdit.uniqueId);
  }, [openEditDialogAction]);

  const handleSaveEditedCard = useCallback((updatedCard: DisplayCard) => {
    updateGeneratedCardAction(updatedCard);
    toast({ title: "Card Updated", description: "Changes saved." });
    // closeEditDialogAction is called by the dialog itself.
  }, [updateGeneratedCardAction, toast]);

  const handleDuplicateCard = useCallback((cardToDuplicate: DisplayCard) => {
    const newCard: DisplayCard = {
      ...JSON.parse(JSON.stringify(cardToDuplicate)), 
      uniqueId: nanoid(),
    };
    addGeneratedCardsAction([newCard]);
    toast({ title: "Card Duplicated", description: "A copy of the card has been added." });
  }, [addGeneratedCardsAction, toast]);

  const handleCloseEditDialog = useCallback(() => {
    closeEditDialogAction();
  }, [closeEditDialogAction]);

  const handleSaveCardSet = useCallback(() => {
    if (storedCards.length === 0) {
      toast({ title: "Nothing to save", description: "Generate some cards first.", variant: "default" });
      return;
    }
    const jsonString = JSON.stringify(storedCards, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tcg-card-set.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Set Saved", description: "Card set downloaded as tcg-card-set.json" });
  }, [storedCards, toast]);

  const isValidStoredDisplayCard = (item: any): item is Partial<StoredDisplayCard> => {
    return item &&
           typeof item.templateId === 'string' && item.templateId.trim() !== "" &&
           typeof item.data === 'object' && item.data !== null &&
           typeof item.uniqueId === 'string' && item.uniqueId.trim() !== "";
  };

  const handleLoadCardSet = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          const loadedItemsRaw: Partial<StoredDisplayCard>[] = JSON.parse(jsonString);

          if (Array.isArray(loadedItemsRaw) && loadedItemsRaw.every(isValidStoredDisplayCard)) {
            const { successCount, skippedCount } = setStoredCardsFromFileAction(loadedItemsRaw as StoredDisplayCard[]);
            let toastMessage = `${successCount} cards processed.`;
            if (skippedCount > 0) toastMessage += ` ${skippedCount} cards skipped due to missing or invalid templates.`;
            toast({ title: "Set Load Complete", description: toastMessage, duration: 7000 });
          } else {
            toast({ title: "Load Error", description: "Invalid file format. Expected an array of valid stored cards.", variant: "destructive" });
          }
        } catch (error) {
          toast({ title: "Load Error", description: `Failed to parse or process JSON: ${(error as Error).message}`, variant: "destructive" });
          console.error("Error loading card set:", error);
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [setStoredCardsFromFileAction, toast]); 

  const handleExportAllAsZip = useCallback(async () => {
    if (generatedDisplayCards.length === 0) return;
    const exportItems: Array<{ card: DisplayCard; cardIndex: number; face: CardFace }> = generatedDisplayCards.flatMap((card, index) => {
      const faces: CardFace[] = card.template.backCanvas ? ['front', 'back'] : ['front'];
      return faces.map((face) => ({ card, cardIndex: index, face }));
    });
    const outputLabel = exportMode === 'physical' ? 'physical print card faces' : 'digital card images';
    const folderName = exportMode === 'physical' ? 'physical-print-card-faces' : 'digital-card-images';
    const fileNamePrefix = exportMode === 'physical' ? 'cardforge-physical-print-card-faces' : 'cardforge-digital-card-images';
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });
    try {
      const exportProfile = getExportProfile(exportMode, exportDpi);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder(folderName)!;
      const renderer = createCardFaceExportRenderer(exportProfile);

      try {
        for (let i = 0; i < exportItems.length; i++) {
          const { card, cardIndex, face } = exportItems[i];
          const safeName = (card.data?.cardName || card.data?.name || `card-${cardIndex + 1}`).toString().replace(/[^a-z0-9_-]/gi, '_').substring(0, 40);
          const blob = await renderer.renderToBlob(card, face);
          folder.file(`${String(cardIndex + 1).padStart(3, '0')}_${safeName}_${face}.png`, blob);
          setZipProgress({ done: i + 1, total: exportItems.length });
        }
      } finally {
        renderer.cleanup();
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileNamePrefix}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'ZIP Exported',
        description: `${exportItems.length} ${outputLabel} saved to ${fileNamePrefix}.zip using ${exportProfile.label} profile.`,
      });
    } catch (err) {
      toast({ title: 'Export Failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
    }
  }, [exportDpi, exportMode, generatedDisplayCards, toast]);

  const handleMobileMenuSelect = useCallback((tabValue: string) => {
    setActiveTabAction(tabValue);
    setIsMobileMenuOpen(false);
  }, [setActiveTabAction]);

  const effectiveActiveTab = TABS_CONFIG.some(tab => tab.value === activeTab) ? activeTab : TABS_CONFIG[0].value;

  // Comment: Initial selection of template for single card generator (and now bulk generator)
  // is handled by Zustand's _rehydrateCallback or other actions modifying the templates list.

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
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

          <TabsList className="hidden md:grid w-full md:grid-cols-2 mb-6 no-print">
            {TABS_CONFIG.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
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
              onOpenTemplateMaker={() => setActiveTabAction('template-maker')}
              onSingleCardAdded={handleSingleCardAdded}
              onBulkCardsGenerated={handleBulkCardsGenerated}
              onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateIdAction}
              onSelectPaperSize={setSelectedPaperSizeAction}
              onSetPdfOptions={setPdfOptionsAction}
              onSetExportMode={setExportModeAction}
              onSetExportDpi={setExportDpiAction}
              onSaveCardSet={handleSaveCardSet}
              onLoadCardSet={handleLoadCardSet}
              onExportAllAsZip={handleExportAllAsZip}
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
                return `"${template?.name || templatePendingDeleteId || 'This template'}" will be permanently removed from this browser. ${dependentCardCount} generated card${dependentCardCount === 1 ? '' : 's'} using it will also be removed.`;
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
            <AlertDialogTitle>Clear all generated cards?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {generatedDisplayCards.length} generated card{generatedDisplayCards.length === 1 ? '' : 's'} from this browser. Templates will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearGeneratedCards} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear Cards
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <footer className="text-center p-4 text-muted-foreground text-sm border-t no-print">
        TCG Card Forge &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    

