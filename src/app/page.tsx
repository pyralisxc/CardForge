
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/card-forge/Header';
import { CardTemplateMaker2 } from '@/components/card-forge/CardTemplateMaker2';
import { BulkGenerator } from '@/components/card-forge/BulkGenerator';
import { SingleCardGenerator } from '@/components/card-forge/SingleCardGenerator';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { EditCardDialog } from '@/components/card-forge/EditCardDialog';
import { PaperSizeSelector } from '@/components/card-forge/PaperSizeSelector';
import { SaveAsPdfButton } from '@/components/card-forge/SaveAsPdfButton';
import { ExportCardImageButton } from '@/components/card-forge/ExportCardImageButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Trash2, FolderDown, FolderUp, MenuIcon, PackageOpen, Scissors, ArrowLeftRight, BringToFront, Search, Download, PenTool } from 'lucide-react';

import { useAppStore, selectGeneratedDisplayCards, selectEditingCard } from '@/store/appStore';
import { TABS_CONFIG } from '@/lib/constants';
import type { AppearanceStyleLibrary, AppearanceStylePreset, TCGCardTemplate, PaperSize, DisplayCard, StoredDisplayCard } from '@/types';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

import { nanoid } from 'nanoid';
import { getExportProfile, type ExportMode } from '@/lib/printValidation';

export default function CardForgePage() {
  const { toast } = useToast();

  // Zustand store selectors
  const templatesFromStore = useAppStore((state) => state.templates);
  const freeformTemplatesForGenerator = templatesFromStore;
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
  const exportMode = useAppStore((state) => state.exportMode);
  const exportDpi = useAppStore((state) => state.exportDpi);
  const editingCardFromStore = useAppStore(selectEditingCard);
  const isEditDialogOpen = useAppStore((state) => state.isEditDialogOpen);
  
  // Zustand store actions
  const addOrUpdateTemplateAction = useAppStore((state) => state.addOrUpdateTemplate);
  const mergeTemplatesFromFilesAction = useAppStore((state) => state.mergeTemplatesFromFiles);
  const deleteTemplateAction = useAppStore((state) => state.deleteTemplate);
  const cloneTemplateAction = useAppStore((state) => state.cloneTemplate);
  const setAppearanceStylesFromFilesAction = useAppStore((state) => state.setAppearanceStylesFromFiles);
  const addOrUpdateAppearanceStyleAction = useAppStore((state) => state.addOrUpdateAppearanceStyle);
  const deleteAppearanceStyleAction = useAppStore((state) => state.deleteAppearanceStyle);
  const addGeneratedCardsAction = useAppStore((state) => state.addGeneratedCards);
  const clearGeneratedCardsAction = useAppStore((state) => state.clearGeneratedCards);
  const updateGeneratedCardAction = useAppStore((state) => state.updateGeneratedCard);
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
        const response = await fetch('/api/templates', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { templates?: Partial<TCGCardTemplate>[] };
        if (cancelled || !Array.isArray(payload.templates) || payload.templates.length === 0) return;
        mergeTemplatesFromFilesAction(payload.templates);
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
  }, [mergeTemplatesFromFilesAction]);

  useEffect(() => {
    let cancelled = false;

    const loadFileBackedStyles = async () => {
      try {
        const response = await fetch('/api/styles', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as Partial<AppearanceStyleLibrary>;
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
    // The addOrUpdateTemplateAction in the store handles reconstruction.
    const savedTemplateId = addOrUpdateTemplateAction(template);
    toast({ title: "Template Saved", description: `"${template.name || savedTemplateId}" has been saved.` });
    const templateForFile = useAppStore.getState().templates.find(t => t.id === savedTemplateId);
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
  }, [addOrUpdateTemplateAction, toast]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplatePendingDeleteId(templateId);
  }, []);

  const handleConfirmDeleteTemplate = useCallback(() => {
    if (!templatePendingDeleteId) return;
    const templateId = templatePendingDeleteId;
    const templateToDelete = templatesFromStore.find(t => t.id === templateId);
    const dependentCardCount = storedCards.filter(card => card.templateId === templateId).length;
    deleteTemplateAction(templateId);
    void fetch('/api/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: templateId }),
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
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: generatedDisplayCards.length });
    try {
      const exportProfile = getExportProfile(exportMode, exportDpi);
      const JSZip = (await import('jszip')).default;
      const { renderCardToCanvasWithProfile } = await import('@/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder('cards')!;

      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const card = generatedDisplayCards[i];
        const canvas = await renderCardToCanvasWithProfile(card, exportProfile);

        const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
        const safeName = (card.data?.cardName || card.data?.name || `card-${i + 1}`).toString().replace(/[^a-z0-9_-]/gi, '_').substring(0, 40);
        folder.file(`${String(i + 1).padStart(3, '0')}_${safeName}.png`, blob);
        setZipProgress({ done: i + 1, total: generatedDisplayCards.length });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'card-set.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'ZIP Exported',
        description: `${generatedDisplayCards.length} cards saved to card-set.zip using ${exportProfile.label} profile.`,
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

          <TabsContent value="template-maker-2">
            <CardTemplateMaker2
              onSaveTemplate={handleSaveTemplate}
              templates={templatesFromStore}
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
            {isLoadingTemplates ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Loading templates" />
                <p className="text-muted-foreground text-sm">Loading templates…</p>
              </div>
            ) : freeformTemplatesForGenerator.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] border rounded-xl bg-card/30 text-center p-12 space-y-5 shadow-inner">
                <PenTool className="h-16 w-16 text-primary/60" />
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">No Templates Yet</h2>
                  <p className="text-muted-foreground max-w-sm">Create a template in the Card Maker first, then come back here to fill in data and generate your cards.</p>
                </div>
                <Button size="lg" onClick={() => setActiveTabAction('template-maker-2')} className="gap-2">
                  <PenTool className="h-5 w-5" /> Open Card Maker
                </Button>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                 <SingleCardGenerator
                    templates={freeformTemplatesForGenerator}
                    onSingleCardAdded={handleSingleCardAdded}
                    onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateIdAction}
                    selectedTemplateIdProp={generatorSelectedTemplateId}
                 />
                <BulkGenerator
                  templates={freeformTemplatesForGenerator}
                  onCardsGenerated={handleBulkCardsGenerated}
                  selectedTemplateIdProp={generatorSelectedTemplateId}
                  onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateIdAction}
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2"> Manage & Export</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSizeAction} />
                        <div className="space-y-3 pt-2 border-t">
                          <div className="space-y-1">
                            <Label htmlFor="exportMode" className="text-md font-medium">Export Profile</Label>
                            <Select
                              value={exportMode}
                              onValueChange={(value) => setExportModeAction(value as ExportMode)}
                            >
                              <SelectTrigger id="exportMode" className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="physical">Physical Print (300 DPI, strict checks)</SelectItem>
                                <SelectItem value="virtual">Virtual Export (faster, warning-first)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Physical mode is recommended for print companies. Virtual mode is optimized for digital sharing.
                            </p>
                            <div className="space-y-1">
                              <Label htmlFor="exportDpi" className="text-xs">Export DPI</Label>
                              <Select
                                value={String(exportDpi)}
                                onValueChange={(value) => setExportDpiAction(parseInt(value, 10))}
                              >
                                <SelectTrigger id="exportDpi" className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="150">150 DPI</SelectItem>
                                  <SelectItem value="300">300 DPI (industry standard)</SelectItem>
                                  <SelectItem value="600">600 DPI</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Label className="text-md font-medium">PDF Options</Label>
                          <TooltipProvider>
                    <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label htmlFor="pdfMargin" className="text-xs flex items-center gap-1 cursor-help"><BringToFront className="h-3 w-3"/>Margins (mm)</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>Space from paper edge to first card. Typical: 5–10 mm.</TooltipContent>
                                  </Tooltip>
                                  <Input
                                      id="pdfMargin"
                                      type="number"
                                      value={pdfMarginMm}
                                      onChange={(e) => setPdfOptionsAction({ margin: parseInt(e.target.value, 10) || 0 })}
                                      className="h-8 text-xs"
                                      min="0"
                                  />
                              </div>
                              <div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label htmlFor="pdfCardSpacing" className="text-xs flex items-center gap-1 cursor-help"><ArrowLeftRight className="h-3 w-3"/>Card Spacing (mm)</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>Gap between each card. 0 = no gap, 2–4 mm is typical for cutting.</TooltipContent>
                                  </Tooltip>
                                  <Input
                                      id="pdfCardSpacing"
                                      type="number"
                                      value={pdfCardSpacingMm}
                                      onChange={(e) => setPdfOptionsAction({ spacing: parseInt(e.target.value, 10) || 0 })}
                                      className="h-8 text-xs"
                                      min="0"
                                  />
                              </div>
                          </div>
                    </TooltipProvider>
                          <div className="flex items-center space-x-2 pt-1">
                              <Switch
                                  id="pdfIncludeCutLines"
                                  checked={pdfIncludeCutLines}
                                  onCheckedChange={(checked) => setPdfOptionsAction({ cutLines: checked })}
                                  aria-label="Toggle cut lines in PDF"
                              />
                              <Label htmlFor="pdfIncludeCutLines" className="flex items-center gap-1 cursor-pointer text-xs"><Scissors className="h-3 w-3"/>Include Cut Lines</Label>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t">
                           <div className="grid grid-cols-2 gap-2">
                             <Button variant="outline" onClick={handleSaveCardSet} disabled={generatedDisplayCards.length === 0} className="flex items-center gap-2">
                                <FolderDown className="h-4 w-4" /> Save Set
                             </Button>
                             <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                                <FolderUp className="h-4 w-4" /> Load Set
                             </Button>
                             <input type="file" ref={fileInputRef} onChange={handleLoadCardSet} accept=".json" aria-hidden="true" style={{ display: 'none' }} />
                           </div>
                            <SaveAsPdfButton
                              generatedDisplayCards={generatedDisplayCards}
                              selectedPaperSize={selectedPaperSize}
                              pdfMarginMm={pdfMarginMm}
                              pdfCardSpacingMm={pdfCardSpacingMm}
                              pdfIncludeCutLines={pdfIncludeCutLines}
                              exportMode={exportMode}
                              exportDpi={exportDpi}
                              disabled={generatedDisplayCards.length === 0}
                              templateName={generatedDisplayCards[0]?.template?.name}
                            />
                            <Button variant="outline" onClick={handleExportAllAsZip} disabled={generatedDisplayCards.length === 0 || isZipExporting} className="flex items-center gap-2">
                              <Download className="h-4 w-4" /> {isZipExporting ? `Exporting… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}` : `Export PNG ZIP (${generatedDisplayCards.length})`}
                            </Button>
                            {zipProgress && (
                              <Progress value={(zipProgress.done / zipProgress.total) * 100} className="h-1.5 mt-1" />
                            )}
                            {generatedDisplayCards.length > 0 && (
                                <Button variant="destructive" onClick={() => setIsClearCardsDialogOpen(true)} className="flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" /> Clear All ({generatedDisplayCards.length})
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

              </div>
              <div className="lg:col-span-2">
                <div className="sticky top-0 z-10 bg-background pb-2 flex items-center justify-between mb-2 gap-3 flex-wrap">
                  <h2 className="text-2xl font-semibold text-foreground shrink-0">
                    Generated Cards ({generatedDisplayCards.length})
                    {generatorSelectedTemplateId && freeformTemplatesForGenerator.find(t => t.id === generatorSelectedTemplateId) && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        — {freeformTemplatesForGenerator.find(t => t.id === generatorSelectedTemplateId)?.name}
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search cards..."
                        value={gallerySearch}
                        onChange={(e) => setGallerySearch(e.target.value)}
                        className="pl-8 h-8 text-sm w-40"
                      />
                    </div>
                    <Select value={gallerySort} onValueChange={value => setGallerySort(value as typeof gallerySort)}>
                      <SelectTrigger className="h-8 text-sm w-36" aria-label="Sort gallery">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Order added</SelectItem>
                        <SelectItem value="name-asc">Name A→Z</SelectItem>
                        <SelectItem value="name-desc">Name Z→A</SelectItem>
                        <SelectItem value="template">By Template</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {generatedDisplayCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] border rounded-md bg-card/30 text-muted-foreground p-8 text-center shadow-inner">
                     <PackageOpen className="h-16 w-16 mb-4 text-primary/70" />
                    <p className="text-lg font-medium">No cards generated yet.</p>
                    <p className="text-sm">Use the panels on the left to add cards or load a set.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card/30 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                      {generatedDisplayCards
                        .filter(card => {
                          if (!gallerySearch.trim()) return true;
                          const q = gallerySearch.toLowerCase();
                          return (
                            card.template.name?.toLowerCase().includes(q) ||
                            Object.values(card.data).some(v => String(v).toLowerCase().includes(q))
                          );
                        })
                        .sort((a, b) => {
                          if (gallerySort === 'name-asc') return String(a.data.cardName || a.data.name || '').localeCompare(String(b.data.cardName || b.data.name || ''));
                          if (gallerySort === 'name-desc') return String(b.data.cardName || b.data.name || '').localeCompare(String(a.data.cardName || a.data.name || ''));
                          if (gallerySort === 'template') return (a.template.name || '').localeCompare(b.template.name || '');
                          return 0;
                        })
                        .map((cardItem, index) => (
                        <div key={cardItem.uniqueId} className="relative group/card">
                          <CardPreview
                            card={cardItem}
                            isPrintMode={false}
                            className="mx-auto"
                            showSizeInfo={index === 0}
                            onEdit={handleEditCardRequest}
                          />
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                            <ExportCardImageButton card={cardItem} exportMode={exportMode} exportDpi={exportDpi} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
            )}
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

    
