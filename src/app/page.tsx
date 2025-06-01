
"use client";

import type { ChangeEvent, ElementType } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/card-forge/Header';
import { TemplateEditor, getFreshDefaultTemplate } from '@/components/card-forge/TemplateEditor';
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
import { nanoid } from 'nanoid';

import useLocalStorage from '@/hooks/useLocalStorage';
import { PAPER_SIZES, createDefaultRow, createDefaultSection, TABS_CONFIG, DEFAULT_TEMPLATES } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection, CardRow, StoredDisplayCard, CardData } from '@/types';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_TEMPLATES_KEY = 'cardForgeTCGTemplatesV10-reconstructed';
const LOCAL_STORAGE_CARD_SET_KEY = 'cardForgeTCGSavedSetV2-templateIDs';


export default function CardForgePage() {
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>(LOCAL_STORAGE_TEMPLATES_KEY, []);
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null);

  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [storedCards, setStoredCards] = useLocalStorage<StoredDisplayCard[]>(LOCAL_STORAGE_CARD_SET_KEY, []);


  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>(TABS_CONFIG[0].value);
  const { toast } = useToast();
  const [hideEmptySections, setHideEmptySections] = useState<boolean>(true);

  const [editingCard, setEditingCard] = useState<DisplayCard | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [singleCardGeneratorSelectedTemplateId, setSingleCardGeneratorSelectedTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [pdfMarginMm, setPdfMarginMm] = useState<number>(5);
  const [pdfCardSpacingMm, setPdfCardSpacingMm] = useState<number>(0);
  const [pdfIncludeCutLines, setPdfIncludeCutLines] = useState<boolean>(false);


  useEffect(() => { setMounted(true); }, []);

  // Effect to rehydrate DisplayCards from StoredDisplayCards when templates or storedCards change
  useEffect(() => {
    if (!mounted) return;

    const rehydratedCards: DisplayCard[] = [];
    let missingTemplatesInfo = { front: 0, back: 0, totalSkipped: 0 };

    for (const stored of storedCards) {
      const frontTemplateFound = templates.find(t => t.id === stored.frontTemplateId);
      if (!frontTemplateFound) {
        missingTemplatesInfo.front++;
        missingTemplatesInfo.totalSkipped++;
        continue;
      }
      const frontTemplate = fullyReconstructTemplate(frontTemplateFound); // Reconstruct to ensure structure
      if (!frontTemplate) { // Should not happen if found and reconstruct is robust
        missingTemplatesInfo.front++;
        missingTemplatesInfo.totalSkipped++;
        continue;
      }

      let backTemplate: TCGCardTemplate | null = null;
      if (stored.backTemplateId) {
        const backTemplateFound = templates.find(t => t.id === stored.backTemplateId);
        if (backTemplateFound) {
          backTemplate = fullyReconstructTemplate(backTemplateFound); // Reconstruct
          if (!backTemplate) missingTemplatesInfo.back++; // Reconstruct failed
        } else {
          missingTemplatesInfo.back++;
        }
      }
      
      rehydratedCards.push({
        uniqueId: stored.uniqueId,
        frontTemplate: frontTemplate,
        frontData: stored.frontData,
        backTemplate: backTemplate,
        backData: stored.backData,
      });
    }
    
    if (JSON.stringify(generatedDisplayCards) !== JSON.stringify(rehydratedCards)) {
      setGeneratedDisplayCards(rehydratedCards);
    }

    if (missingTemplatesInfo.totalSkipped > 0) {
        let message = `Some cards could not be fully loaded: ${missingTemplatesInfo.totalSkipped} card(s) skipped due to missing front templates.`;
        if(missingTemplatesInfo.back > 0) message += ` Additionally, ${missingTemplatesInfo.back} card(s) are missing their back templates.`;
        toast({ title: "Card Load Notice", description: message, variant: "default", duration: 7000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedCards, templates, mounted]); // Removed toast, setGeneratedDisplayCards, generatedDisplayCards to simplify deps and rely on the stringify check

  // Effect to update StoredDisplayCards when DisplayCards change (e.g., after generation or editing)
  useEffect(() => {
    if (!mounted) return;
    const storableCards: StoredDisplayCard[] = generatedDisplayCards.map(card => ({
      uniqueId: card.uniqueId,
      frontTemplateId: card.frontTemplate.id!, 
      frontData: card.frontData,
      backTemplateId: card.backTemplate?.id || null,
      backData: card.backData,
    }));
    if (JSON.stringify(storedCards) !== JSON.stringify(storableCards)) {
      setStoredCards(storableCards);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedDisplayCards, mounted]); // Removed setStoredCards, storedCards to simplify deps

  // Effect to load initial templates from localStorage or use defaults
  useEffect(() => {
    if (!mounted) return;

    const storedTemplatesRaw = window.localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    let initialTemplatesToLoad: Partial<TCGCardTemplate>[] = [];

    if (storedTemplatesRaw) {
        try {
            const parsed = JSON.parse(storedTemplatesRaw);
            if (Array.isArray(parsed)) initialTemplatesToLoad = parsed;
        } catch (e) { console.warn("Failed to parse templates from localStorage.", e); }
    }

    if (initialTemplatesToLoad.length === 0 && DEFAULT_TEMPLATES.length > 0) {
      initialTemplatesToLoad = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    }
    
    const processSingleTemplate = (t_loaded: Partial<TCGCardTemplate>): TCGCardTemplate => {
        const validatedId = (t_loaded.id && t_loaded.id.trim() !== "") ? t_loaded.id : nanoid();
        // Use getFreshDefaultTemplate to ensure all fields are present, then layer loaded data
        const baseTemplate = getFreshDefaultTemplate(validatedId, t_loaded.name);
        
        let newT: TCGCardTemplate = { ...baseTemplate, ...t_loaded };
        newT.id = validatedId; 
        newT.name = newT.name || baseTemplate.name;

        newT.rows = (t_loaded.rows || []).map((r_loaded: Partial<CardRow>) => {
            const rowId = (r_loaded.id && r_loaded.id.trim() !== "") ? r_loaded.id : nanoid();
            const baseRow = createDefaultRow(rowId);
            const newR: CardRow = { ...baseRow, ...r_loaded, id: rowId };
            newR.columns = (r_loaded.columns || []).map((c_loaded: Partial<CardSection>) => {
                const sectionId = (c_loaded.id && c_loaded.id.trim() !== "") ? c_loaded.id : nanoid();
                const baseCol = createDefaultSection(sectionId);
                return { ...baseCol, ...c_loaded, id: sectionId };
            });
            if (newR.columns.length === 0) newR.columns = [createDefaultSection(nanoid())]; // Ensure at least one column
            return newR;
        });
        if (newT.rows.length === 0) newT.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])]; // Ensure at least one row
        return newT;
    };

    const processedTemplates = initialTemplatesToLoad.map(processSingleTemplate);
    if (JSON.stringify(templates) !== JSON.stringify(processedTemplates)) {
        setTemplates(processedTemplates);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]); //This effect should only run once on mount to initialize templates. setTemplates/templates are handled by useLocalStorage internally.


  const handleSaveTemplate = useCallback((template: TCGCardTemplate) => {
    setTemplates(prevTemplates => {
      const existingIndex = prevTemplates.findIndex(t => t.id === template.id);
      const newTemplates = existingIndex > -1 
        ? prevTemplates.map((t, i) => i === existingIndex ? template : t) 
        : [...prevTemplates, template];
      return newTemplates; // Let useLocalStorage handle the actual update if different
    });
    toast({ title: "Template Saved", description: `"${template.name || template.id}" has been saved.` });
    if (!editingTemplate || editingTemplate.id === template.id || !templates.find(t => t.id === template.id)) {
        setEditingTemplate(template);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, editingTemplate, toast]); // setTemplates is stable

  const handleDeleteTemplate = useCallback((templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) setEditingTemplate(null);
    if (singleCardGeneratorSelectedTemplateId === templateId) setSingleCardGeneratorSelectedTemplateId(null);
    toast({ title: "Template Deleted", description: `"${templateToDelete?.name || templateId}" has been removed.` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTemplate, singleCardGeneratorSelectedTemplateId, toast, templates]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    setGeneratedDisplayCards(prev => [...prev, ...cards]); 
    if (cards.length > 0) toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added.` });
  }, [toast]);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    setGeneratedDisplayCards(prev => [...prev, card]); 
  }, []);

  const handleClearGeneratedCards = useCallback(() => {
    setGeneratedDisplayCards([]); 
    toast({ title: "Cleared", description: "Generated cards have been cleared." });
  }, [toast]);

  const handleEditCardRequest = useCallback((cardToEdit: DisplayCard) => {
    setEditingCard(cardToEdit);
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveEditedCard = useCallback((updatedCard: DisplayCard) => {
    setGeneratedDisplayCards(prev => 
      prev.map(card => card.uniqueId === updatedCard.uniqueId ? updatedCard : card)
    );
    setIsEditDialogOpen(false);
    setEditingCard(null);
    toast({ title: "Card Updated", description: "Changes saved." });
  }, [toast]);

  const handleDuplicateCard = useCallback((cardToDuplicate: DisplayCard) => {
    const newCard: DisplayCard = { 
      ...JSON.parse(JSON.stringify(cardToDuplicate)), 
      uniqueId: nanoid(),
    };
    setGeneratedDisplayCards(prev => [...prev, newCard]);
    toast({ title: "Card Duplicated", description: "A copy of the card has been added." });
    setIsEditDialogOpen(false); 
    setEditingCard(null);
  }, [toast]);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingCard(null);
  }, []);

  const handleSaveCardSet = useCallback(() => {
    if (generatedDisplayCards.length === 0) {
      toast({ title: "Nothing to save", description: "Generate some cards first.", variant: "default" });
      return;
    }
    const cardsToStore: StoredDisplayCard[] = generatedDisplayCards.map(card => ({
      uniqueId: card.uniqueId,
      frontTemplateId: card.frontTemplate.id!, 
      frontData: card.frontData,
      backTemplateId: card.backTemplate?.id || null,
      backData: card.backData,
    }));

    const jsonString = JSON.stringify(cardsToStore, null, 2);
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
  }, [generatedDisplayCards, toast]);


  const fullyReconstructTemplate = useCallback((templateData: Partial<TCGCardTemplate> | null | undefined): TCGCardTemplate | null => {
    if (!templateData) return null;
    const idToUse = (templateData.id && templateData.id.trim() !== "") ? templateData.id : nanoid();

    const baseTemplate = getFreshDefaultTemplate(idToUse, templateData.name);
    let newT: TCGCardTemplate = { ...baseTemplate, ...templateData };
    newT.id = idToUse; 
    newT.name = newT.name || baseTemplate.name;
    newT.rows = (templateData.rows || []).map((r_loaded: Partial<CardRow>) => {
        const rowId = (r_loaded.id && r_loaded.id.trim() !== "") ? r_loaded.id : nanoid();
        const baseRow = createDefaultRow(rowId);
        const newR: CardRow = { ...baseRow, ...r_loaded, id: rowId };
        newR.columns = (r_loaded.columns || []).map((c_loaded: Partial<CardSection>) => {
            const sectionId = (c_loaded.id && c_loaded.id.trim() !== "") ? c_loaded.id : nanoid();
            const baseCol = createDefaultSection(sectionId);
            return { ...baseCol, ...c_loaded, id: sectionId };
        });
        if (newR.columns.length === 0) newR.columns = [createDefaultSection(nanoid())];
        return newR;
    });
    if (newT.rows.length === 0) newT.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];
    return newT;
  }, []);

  const isValidStoredDisplayCard = (item: any): item is Partial<StoredDisplayCard> => {
    return item &&
           typeof item.frontTemplateId === 'string' && item.frontTemplateId.trim() !== "" &&
           typeof item.frontData === 'object' && item.frontData !== null &&
           typeof item.uniqueId === 'string' && item.uniqueId.trim() !== "" &&
           (item.backTemplateId === undefined || item.backTemplateId === null || (typeof item.backTemplateId === 'string' && item.backTemplateId.trim() !== "")) &&
           (item.backData === undefined || item.backData === null || typeof item.backData === 'object');
  };

  const handleLoadCardSet = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          const loadedItems: Partial<StoredDisplayCard>[] = JSON.parse(jsonString);

          if (Array.isArray(loadedItems) && loadedItems.every(isValidStoredDisplayCard)) {
            const runtimeCards: DisplayCard[] = [];
            let missingFrontCount = 0;
            let missingBackCount = 0;

            loadedItems.forEach(storedCard => {
              const frontTemplateFound = templates.find(t => t.id === storedCard.frontTemplateId);
              if (!frontTemplateFound) {
                missingFrontCount++;
                return; 
              }
              const reconstructedFrontTemplate = fullyReconstructTemplate(frontTemplateFound);
              if (!reconstructedFrontTemplate) { 
                missingFrontCount++;
                return;
              }

              let backTemplate: TCGCardTemplate | null = null;
              if (storedCard.backTemplateId) {
                const foundBack = templates.find(t => t.id === storedCard.backTemplateId);
                if (foundBack) {
                  backTemplate = fullyReconstructTemplate(foundBack);
                }
                if (!backTemplate && foundBack) { 
                    missingBackCount++;
                } else if (!foundBack) { 
                    missingBackCount++;
                }
              }
              
              runtimeCards.push({ 
                uniqueId: storedCard.uniqueId || nanoid(), 
                frontTemplate: reconstructedFrontTemplate,
                frontData: storedCard.frontData || {},
                backTemplate: backTemplate,
                backData: (backTemplate && storedCard.backData) ? storedCard.backData : null,
              });
            });
            
            // This will trigger the useEffect to update storedCards if necessary
            setGeneratedDisplayCards(runtimeCards); 
            
            let toastMessage = `${runtimeCards.length} cards processed.`;
            if (missingFrontCount > 0) toastMessage += ` ${missingFrontCount} cards skipped due to missing front templates.`;
            if (missingBackCount > 0) toastMessage += ` ${missingBackCount} cards loaded without their back templates.`;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, toast, fullyReconstructTemplate]); // setGeneratedDisplayCards is stable

  const handleMobileMenuSelect = useCallback((tabValue: string) => {
    setActiveTab(tabValue);
    setIsMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (mounted && !singleCardGeneratorSelectedTemplateId && templates.length > 0) {
      const firstValidTemplate = templates.find(t => t.id && t.id.trim() !== "");
      if (firstValidTemplate) {
        setSingleCardGeneratorSelectedTemplateId(firstValidTemplate.id);
      }
    }
  }, [templates, mounted, singleCardGeneratorSelectedTemplateId]);


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            {!mounted ? <p>Loading templates...</p> : (
              <TemplateEditor
                onSaveTemplate={handleSaveTemplate}
                templates={templates}
                onDeleteTemplate={handleDeleteTemplate}
                initialTemplate={editingTemplate}
              />
            )}
          </TabsContent>

          <TabsContent value="generator">
            {!mounted ? <p>Loading...</p> : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                   <SingleCardGenerator
                      templates={templates}
                      onSingleCardAdded={handleSingleCardAdded}
                      onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateId}
                      selectedTemplateIdProp={singleCardGeneratorSelectedTemplateId}
                   />
                  <BulkGenerator
                    templates={templates}
                    onCardsGenerated={handleBulkCardsGenerated}
                  />

                  <Card>
                      <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2"> Manage & Export</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSize} />
                          <div className="space-y-3 pt-2 border-t">
                            <Label className="text-md font-medium">PDF Options</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="pdfMargin" className="text-xs flex items-center gap-1"><BringToFront className="h-3 w-3"/>Margins (mm)</Label>
                                    <Input
                                        id="pdfMargin"
                                        type="number"
                                        value={pdfMarginMm}
                                        onChange={(e) => setPdfMarginMm(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                                        onChange={(e) => setPdfCardSpacingMm(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        className="h-8 text-xs"
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                                <Switch
                                    id="pdfIncludeCutLines"
                                    checked={pdfIncludeCutLines}
                                    onCheckedChange={setPdfIncludeCutLines}
                                    aria-label="Toggle cut lines in PDF"
                                />
                                <Label htmlFor="pdfIncludeCutLines" className="flex items-center gap-1 cursor-pointer text-xs"><Scissors className="h-3 w-3"/>Include Cut Lines</Label>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 pt-2 border-t">
                              <Switch
                                  id="hide-empty-sections"
                                  checked={hideEmptySections}
                                  onCheckedChange={setHideEmptySections}
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
                            forceRenderSide="front" 
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            )}
          </TabsContent>


          <TabsContent value="ai">
             {!mounted ? <p>Loading AI Helper...</p> : (
                <AIDesignAssistant />
             )}
          </TabsContent>
        </Tabs>
      </main>
      {editingCard && (
        <EditCardDialog
            isOpen={isEditDialogOpen}
            card={editingCard}
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

