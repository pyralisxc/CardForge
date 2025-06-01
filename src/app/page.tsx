
"use client";

import type { ChangeEvent, ElementType } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/card-forge/Header';
import { TemplateEditor } from '@/components/card-forge/TemplateEditor';
import { BulkGenerator } from '@/components/card-forge/BulkGenerator';
import { SingleCardGenerator } from '@/components/card-forge/SingleCardGenerator';
import { AIDesignAssistant } from '@/components/card-forge/AIDesignAssistant';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { EditCardDialog } from '@/components/card-forge/EditCardDialog';
import { PaperSizeSelector } from '@/components/card-forge/PaperSizeSelector';
import { SaveAsPdfButton } from '@/components/card-forge/SaveAsPdfButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Trash2, FolderDown, FolderUp, MenuIcon, EyeOff, PackageOpen, Cog, Scissors, ArrowLeftRight, BringToFront } from 'lucide-react';

import { useAppStore, selectGeneratedDisplayCards, selectEditingCard, reconstructMinimalTemplate, getFreshDefaultTemplate } from '@/store/appStore';
import { TABS_CONFIG } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, StoredDisplayCard } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';

export default function CardForgePage() {
  const { toast } = useToast();

  // Zustand store selectors
  const templates = useAppStore((state) => state.templates);
  const storedCards = useAppStore((state) => state.storedCards); // Using storedCards
  const generatedDisplayCards = useAppStore(selectGeneratedDisplayCards); // Selector for runtime cards
  
  const selectedPaperSize = useAppStore((state) => state.selectedPaperSize);
  const activeTab = useAppStore((state) => state.activeTab);
  const hideEmptySections = useAppStore((state) => state.hideEmptySections);
  const singleCardGeneratorSelectedTemplateId = useAppStore((state) => state.singleCardGeneratorSelectedTemplateId);
  const pdfMarginMm = useAppStore((state) => state.pdfMarginMm);
  const pdfCardSpacingMm = useAppStore((state) => state.pdfCardSpacingMm);
  const pdfIncludeCutLines = useAppStore((state) => state.pdfIncludeCutLines);
  const editingCardFromStore = useAppStore(selectEditingCard); // Using selector for editingCard
  const isEditDialogOpen = useAppStore((state) => state.isEditDialogOpen);
  
  // Zustand store actions
  const addOrUpdateTemplate = useAppStore((state) => state.addOrUpdateTemplate);
  const deleteTemplateAction = useAppStore((state) => state.deleteTemplate);
  const addGeneratedCardsAction = useAppStore((state) => state.addGeneratedCards);
  const clearGeneratedCardsAction = useAppStore((state) => state.clearGeneratedCards);
  const updateGeneratedCardAction = useAppStore((state) => state.updateGeneratedCard);
  const setStoredCardsFromFileAction = useAppStore((state) => state.setStoredCardsFromFile);
  const setSelectedPaperSizeAction = useAppStore((state) => state.setSelectedPaperSize);
  const setActiveTabAction = useAppStore((state) => state.setActiveTab);
  const setHideEmptySectionsAction = useAppStore((state) => state.setHideEmptySections);
  const setSingleCardGeneratorSelectedTemplateIdAction = useAppStore((state) => state.setSingleCardGeneratorSelectedTemplateId);
  const setPdfOptionsAction = useAppStore((state) => state.setPdfOptions);
  const openEditDialogAction = useAppStore((state) => state.openEditDialog);
  const closeEditDialogAction = useAppStore((state) => state.closeEditDialog);
  const rehydrateCallback = useAppStore((state) => state._rehydrateCallback);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // This useEffect hook replaces the previous manual localStorage loading.
  // Zustand's `persist` middleware handles loading.
  // The `_rehydrateCallback` in the store can handle any post-rehydration logic.
  // It is called by onRehydrateStorage in the persist middleware.
  // No specific useEffect needed here for initial load if persist middleware is correctly configured.

  // memoizedGetFreshDefaultTemplate is a stable reference to the function from the store.
  const memoizedGetFreshDefaultTemplate = useCallback(getFreshDefaultTemplate, []);
  // memoizedReconstructMinimalTemplate is a stable reference to the function from the store.
  const memoizedReconstructMinimalTemplate = useCallback(reconstructMinimalTemplate, []);


  const handleSaveTemplate = useCallback((template: TCGCardTemplate) => {
    const savedTemplateId = addOrUpdateTemplate(template); // Action returns the ID
    toast({ title: "Template Saved", description: `"${template.name || savedTemplateId}" has been saved.` });
    // TemplateEditor's selectedTemplateToEditId might need to be updated if it was a new template
    // This is now handled by TemplateEditor itself if it tracks its own selected ID for editing.
  }, [addOrUpdateTemplate, toast]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    deleteTemplateAction(templateId);
    toast({ title: "Template Deleted", description: `"${templateToDelete?.name || templateId}" has been removed.` });
  }, [deleteTemplateAction, toast, templates]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    addGeneratedCardsAction(cards);
    if (cards.length > 0) toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added.` });
  }, [addGeneratedCardsAction, toast]);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    addGeneratedCardsAction([card]); // addGeneratedCardsAction expects an array
  }, [addGeneratedCardsAction]);

  const handleClearGeneratedCards = useCallback(() => {
    clearGeneratedCardsAction();
    toast({ title: "Cleared", description: "Generated cards have been cleared." });
  }, [clearGeneratedCardsAction, toast]);

  const handleEditCardRequest = useCallback((cardToEdit: DisplayCard) => {
    openEditDialogAction(cardToEdit.uniqueId);
  }, [openEditDialogAction]);

  const handleSaveEditedCard = useCallback((updatedCard: DisplayCard) => {
    updateGeneratedCardAction(updatedCard);
    toast({ title: "Card Updated", description: "Changes saved." });
    // closeEditDialogAction is called by the dialog itself upon save.
  }, [updateGeneratedCardAction, toast]);

  const handleDuplicateCard = useCallback((cardToDuplicate: DisplayCard) => {
    const newCard: DisplayCard = {
      ...JSON.parse(JSON.stringify(cardToDuplicate)), 
      uniqueId: nanoid(),
    };
    addGeneratedCardsAction([newCard]);
    toast({ title: "Card Duplicated", description: "A copy of the card has been added." });
    // No need to close dialog here, EditCardDialog might handle it or stay open for further edits on the new copy.
    // Assuming EditCardDialog closes itself if duplication also implies saving/closing.
    // If not, and user expects dialog to close: closeEditDialogAction();
  }, [addGeneratedCardsAction, toast]);

  const handleCloseEditDialog = useCallback(() => {
    closeEditDialogAction();
  }, [closeEditDialogAction]);

  const handleSaveCardSet = useCallback(() => {
    if (storedCards.length === 0) { // Check storedCards from store
      toast({ title: "Nothing to save", description: "Generate some cards first.", variant: "default" });
      return;
    }
    // storedCards from the store are already in the correct StoredDisplayCard format
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

  const handleMobileMenuSelect = useCallback((tabValue: string) => {
    setActiveTabAction(tabValue);
    setIsMobileMenuOpen(false);
  }, [setActiveTabAction]);

  // useEffect to ensure singleCardGeneratorSelectedTemplateId has a valid default after templates load/change.
  // This logic is now handled by _rehydrateCallback in the Zustand store.
  // No useEffect needed here for this specific purpose.

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTabAction} className="w-full">
          <div className="md:hidden mb-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <MenuIcon className="h-5 w-5" />
                  Menu ({TABS_CONFIG.find(t => t.value === activeTab)?.label})
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
                      variant={activeTab === tab.value ? "secondary" : "ghost"}
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

          <TabsList className="hidden md:grid w-full md:grid-cols-3 mb-6 no-print">
            {TABS_CONFIG.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="editor">
            {/* Zustand handles initial loading state internally with persist middleware */}
            <TemplateEditor
              onSaveTemplate={handleSaveTemplate}
              templates={templates} // from Zustand
              onDeleteTemplate={handleDeleteTemplate}
              reconstructMinimalTemplate={memoizedReconstructMinimalTemplate}
              memoizedGetFreshDefaultTemplate={memoizedGetFreshDefaultTemplate}
            />
          </TabsContent>

          <TabsContent value="generator">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                 <SingleCardGenerator
                    templates={templates} // from Zustand
                    onSingleCardAdded={handleSingleCardAdded}
                    onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateIdAction}
                    selectedTemplateIdProp={singleCardGeneratorSelectedTemplateId} // from Zustand
                 />
                <BulkGenerator
                  templates={templates} // from Zustand
                  onCardsGenerated={handleBulkCardsGenerated}
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2"> Manage & Export</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSizeAction} />
                        <div className="space-y-3 pt-2 border-t">
                          <Label className="text-md font-medium">PDF Options</Label>
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <Label htmlFor="pdfMargin" className="text-xs flex items-center gap-1"><BringToFront className="h-3 w-3"/>Margins (mm)</Label>
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
                                  <Label htmlFor="pdfCardSpacing" className="text-xs flex items-center gap-1"><ArrowLeftRight className="h-3 w-3"/>Card Spacing (mm)</Label>
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

                        <div className="flex items-center space-x-2 pt-2 border-t">
                            <Switch
                                id="hide-empty-sections"
                                checked={hideEmptySections}
                                onCheckedChange={setHideEmptySectionsAction}
                                aria-label="Toggle visibility of empty sections in card previews"
                            />
                            <Label htmlFor="hide-empty-sections" className="flex items-center gap-1 cursor-pointer">
                                <EyeOff className="h-4 w-4" /> Hide empty sections
                            </Label>
                        </div>
                        <div className="flex flex-col gap-2 pt-2 border-t">
                           <div className="grid grid-cols-2 gap-2">
                             <Button variant="outline" onClick={handleSaveCardSet} disabled={generatedDisplayCards.length === 0} className="flex items-center gap-2">
                                <FolderDown className="h-4 w-4" /> Save Set
                             </Button>
                             <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                                <FolderUp className="h-4 w-4" /> Load Set
                             </Button>
                             <input type="file" ref={fileInputRef} onChange={handleLoadCardSet} accept=".json" style={{ display: 'none' }} />
                           </div>
                            <SaveAsPdfButton
                              generatedDisplayCards={generatedDisplayCards}
                              selectedPaperSize={selectedPaperSize}
                              pdfMarginMm={pdfMarginMm}
                              pdfCardSpacingMm={pdfCardSpacingMm}
                              pdfIncludeCutLines={pdfIncludeCutLines}
                              disabled={generatedDisplayCards.length === 0}
                            />
                            {generatedDisplayCards.length > 0 && (
                                <Button variant="destructive" onClick={handleClearGeneratedCards} className="flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" /> Clear All ({generatedDisplayCards.length})
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

              </div>
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Generated Cards Preview ({generatedDisplayCards.length})</h2>
                {generatedDisplayCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] border rounded-md bg-card/30 text-muted-foreground p-8 text-center shadow-inner">
                     <PackageOpen className="h-16 w-16 mb-4 text-primary/70" />
                    <p className="text-lg font-medium">No cards generated yet.</p>
                    <p className="text-sm">Use the panels on the left to add cards or load a set.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card/30 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                      {generatedDisplayCards.map((cardItem, index) => (
                        <CardPreview
                          key={cardItem.uniqueId}
                          card={cardItem}
                          isPrintMode={false}
                          className="mx-auto"
                          showSizeInfo={index === 0}
                          hideEmptySections={hideEmptySections}
                          onEdit={handleEditCardRequest}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai">
              <AIDesignAssistant />
          </TabsContent>
        </Tabs>
      </main>
      {isEditDialogOpen && editingCardFromStore && ( // Use Zustand state for dialog and card
        <EditCardDialog
            isOpen={isEditDialogOpen}
            card={editingCardFromStore}
            onSave={handleSaveEditedCard}
            onDuplicate={handleDuplicateCard}
            onClose={handleCloseEditDialog}
        />
      )}
      <footer className="text-center p-4 text-muted-foreground text-sm border-t no-print">
        TCG Card Forge &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    