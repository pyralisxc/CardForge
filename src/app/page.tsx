
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
import { Trash2, FolderDown, FolderUp, MenuIcon, EyeOff, PackageOpen, Wand2, Cog, Scissors, ArrowLeftRight, BringToFront } from 'lucide-react';
import { nanoid } from 'nanoid';

import useLocalStorage from '@/hooks/useLocalStorage';
import { PAPER_SIZES, createDefaultRow, createDefaultSection, TABS_CONFIG, DEFAULT_TEMPLATES } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection, CardRow } from '@/types';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_TEMPLATES_KEY = 'cardForgeTCGTemplatesV9-genericSections-autoName';

export default function CardForgePage() {
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>(LOCAL_STORAGE_TEMPLATES_KEY, []);
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null);

  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>(TABS_CONFIG[0].value);
  const { toast } = useToast();
  const [hideEmptySections, setHideEmptySections] = useState<boolean>(true);

  const [editingCard, setEditingCard] = useState<DisplayCard | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [singleCardGeneratorSelectedTemplateId, setSingleCardGeneratorSelectedTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PDF Print Options State
  const [pdfMarginMm, setPdfMarginMm] = useState<number>(5); // Default margin changed to 5mm
  const [pdfCardSpacingMm, setPdfCardSpacingMm] = useState<number>(0);
  const [pdfIncludeCutLines, setPdfIncludeCutLines] = useState<boolean>(false);


  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const storedTemplatesRaw = window.localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    let initialTemplatesToLoad: Partial<TCGCardTemplate>[] = [];

    if (storedTemplatesRaw) {
        try {
            const parsed = JSON.parse(storedTemplatesRaw);
            if (Array.isArray(parsed)) {
                initialTemplatesToLoad = parsed;
            }
        } catch (e) {
            console.warn("Failed to parse templates from localStorage. Starting fresh.", e);
             initialTemplatesToLoad = [];
        }
    }

    if (initialTemplatesToLoad.length === 0 && DEFAULT_TEMPLATES.length === 0) {
        if (templates.length > 0) {
            setTemplates([]);
        }
        return;
    }

    if (initialTemplatesToLoad.length === 0 && DEFAULT_TEMPLATES.length > 0) {
      initialTemplatesToLoad = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    }


    const processedTemplates = initialTemplatesToLoad.map((t_loaded: Partial<TCGCardTemplate>) => {
        const baseTemplate = getFreshDefaultTemplate(t_loaded.id, t_loaded.name);
        let newT: TCGCardTemplate = { ...baseTemplate, ...t_loaded };
        newT.id = newT.id || baseTemplate.id || nanoid();
        newT.name = newT.name || baseTemplate.name;

        newT.rows = (t_loaded.rows || []).map((r_loaded: Partial<CardRow>) => {
            const rowId = r_loaded.id || nanoid();
            const baseRow = createDefaultRow(rowId);
            const newR: CardRow = { ...baseRow, ...r_loaded, id: rowId };

            newR.columns = (r_loaded.columns || []).map((c_loaded: Partial<CardSection>) => {
                const sectionId = c_loaded.id || nanoid();
                const baseCol = createDefaultSection(sectionId);
                let newC: CardSection = { ...baseCol, ...c_loaded, id: sectionId };

                newC.sectionContentType = newC.sectionContentType || baseCol.sectionContentType;
                newC.contentPlaceholder = newC.contentPlaceholder || baseCol.contentPlaceholder;
                newC.backgroundImageUrl = newC.backgroundImageUrl === undefined ? baseCol.backgroundImageUrl : newC.backgroundImageUrl;
                newC.imageWidthPx = newC.imageWidthPx === undefined ? baseCol.imageWidthPx : newC.imageWidthPx;
                newC.imageHeightPx = newC.imageHeightPx === undefined ? baseCol.imageHeightPx : newC.imageHeightPx;
                newC.borderRadius = newC.borderRadius === undefined ? baseCol.borderRadius : newC.borderRadius;
                return newC;
            });
             if (newR.columns.length === 0) {
              newR.columns = [createDefaultSection(nanoid())];
            }
            return newR;
        });
         if (newT.rows.length === 0) {
            newT.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];
        }
        return newT;
    });

    if (JSON.stringify(templates) !== JSON.stringify(processedTemplates)) {
        setTemplates(processedTemplates);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleSaveTemplate = useCallback((template: TCGCardTemplate) => {
    setTemplates(prevTemplates => {
      const existingIndex = prevTemplates.findIndex(t => t.id === template.id);
      let updatedTemplates;
      if (existingIndex > -1) {
        updatedTemplates = [...prevTemplates];
        updatedTemplates[existingIndex] = template;
      } else {
        updatedTemplates = [...prevTemplates, template];
      }
      return updatedTemplates;
    });
    toast({ title: "Template Saved", description: `"${template.name || template.id}" has been saved.` });

    if (!editingTemplate || editingTemplate.id === template.id || !templates.find(t => t.id === template.id)) {
        setEditingTemplate(template);
    }
  }, [templates, editingTemplate, toast, setTemplates]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) {
      setEditingTemplate(null);
    }
    if (singleCardGeneratorSelectedTemplateId === templateId) {
        setSingleCardGeneratorSelectedTemplateId(null);
    }
    toast({ title: "Template Deleted", description: `"${templateToDelete?.name || templateId}" has been removed.` });
  }, [editingTemplate, singleCardGeneratorSelectedTemplateId, toast, setTemplates, templates]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    setGeneratedDisplayCards(prev => [...prev, ...cards]);
    if (cards.length > 0) {
        toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added to preview.` });
    }
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
    const jsonString = JSON.stringify(generatedDisplayCards, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'card-set.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Set Saved", description: "Card set downloaded as card-set.json" });
  }, [generatedDisplayCards, toast]);

  const isValidDisplayCard = (item: any): item is DisplayCard => {
    return item &&
           typeof item.template === 'object' && item.template !== null &&
           Array.isArray(item.template.rows) &&
           typeof item.data === 'object' && item.data !== null &&
           typeof item.uniqueId === 'string';
  };

  const handleLoadCardSet = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          const loadedItems = JSON.parse(jsonString);

          if (Array.isArray(loadedItems) && loadedItems.every(isValidDisplayCard)) {
            const processedCards = loadedItems.map(card => {
              const baseTemplate = getFreshDefaultTemplate(card.template.id || nanoid(), card.template.name);
              let hydratedTemplate: TCGCardTemplate = { ...baseTemplate, ...card.template };
              hydratedTemplate.id = hydratedTemplate.id || baseTemplate.id || nanoid();
              hydratedTemplate.name = hydratedTemplate.name || baseTemplate.name;

              hydratedTemplate.rows = (card.template.rows || []).map((r_loaded: Partial<CardRow>) => {
                const rowId = r_loaded.id || nanoid();
                const baseRow = createDefaultRow(rowId);
                const newR: CardRow = { ...baseRow, ...r_loaded, id: rowId };
                newR.columns = (r_loaded.columns || []).map((c_loaded: Partial<CardSection>) => {
                  const sectionId = c_loaded.id || nanoid();
                  const baseCol = createDefaultSection(sectionId);
                  let newC: CardSection = { ...baseCol, ...c_loaded, id: sectionId };
                  newC.sectionContentType = newC.sectionContentType || baseCol.sectionContentType;
                  newC.backgroundImageUrl = newC.backgroundImageUrl === undefined ? baseCol.backgroundImageUrl : newC.backgroundImageUrl;
                  newC.imageWidthPx = newC.imageWidthPx === undefined ? baseCol.imageWidthPx : newC.imageWidthPx;
                  newC.imageHeightPx = newC.imageHeightPx === undefined ? baseCol.imageHeightPx : newC.imageHeightPx;
                  newC.borderRadius = newC.borderRadius === undefined ? baseCol.borderRadius : newC.borderRadius;
                  return newC;
                });
                 if (newR.columns.length === 0) newR.columns = [createDefaultSection(nanoid())];
                return newR;
              });
              if(hydratedTemplate.rows.length === 0) {
                hydratedTemplate.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];
              }

              return { ...card, uniqueId: card.uniqueId || nanoid(), template: hydratedTemplate };
            });
            setGeneratedDisplayCards(processedCards);
            toast({ title: "Set Loaded", description: `${processedCards.length} cards loaded successfully.` });
          } else {
            toast({ title: "Load Error", description: "Invalid file format. Expected an array of valid cards.", variant: "destructive" });
          }
        } catch (error) {
          toast({ title: "Load Error", description: "Failed to parse JSON file. Make sure it's a valid card set.", variant: "destructive" });
          console.error("Error loading card set:", error);
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [toast]);

  const handleMobileMenuSelect = useCallback((tabValue: string) => {
    setActiveTab(tabValue);
    setIsMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (mounted && !singleCardGeneratorSelectedTemplateId && templates.length > 0) {
      setSingleCardGeneratorSelectedTemplateId(templates[0].id);
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
                <AIDesignAssistant templates={templates} />
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

