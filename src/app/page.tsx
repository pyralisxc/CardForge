
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/card-forge/Header';
import { TemplateEditor, getFreshDefaultTemplate } from '@/components/card-forge/TemplateEditor';
import { BulkGenerator } from '@/components/card-forge/BulkGenerator';
import { SingleCardGenerator } from '@/components/card-forge/SingleCardGenerator';
import { AIDesignAssistant } from '@/components/card-forge/AIDesignAssistant';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { EditCardDialog } from '@/components/card-forge/EditCardDialog';
import { PaperSizeSelector } from '@/components/card-forge/PaperSizeSelector';
import { PrintButton } from '@/components/card-forge/PrintButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Trash2, FolderDown, FolderUp, MenuIcon, EyeOff, PackageOpen } from 'lucide-react';
import { nanoid } from 'nanoid';

import useLocalStorage from '@/hooks/useLocalStorage';
import { PAPER_SIZES, TABS_CONFIG, createDefaultRow, createDefaultSection, DEFAULT_TEMPLATES } from '@/lib/constants'; // Added DEFAULT_TEMPLATES import
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection, CardRow } from '@/types';
import { useToast } from '@/hooks/use-toast';

// This key ensures that if we make breaking changes to the template structure,
// users will get the new defaults instead of trying to load incompatible old data.
const LOCAL_STORAGE_TEMPLATES_KEY = 'cardForgeTCGTemplatesV8-no-defaults'; // Updated to ensure no defaults are loaded initially

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


  useEffect(() => { setMounted(true); }, []);


  // Process templates from localStorage to ensure they conform to the latest structure
  useEffect(() => {
    if (!mounted) return;

    setTemplates(prevTemplates => {
      if (!Array.isArray(prevTemplates)) {
        console.warn("Templates from localStorage was not an array. Initializing to empty array.");
        return [];
      }
      // Since DEFAULT_TEMPLATES is now empty, this condition will only be true if localStorage is empty and we had defaults before.
      // For 'cardForgeTCGTemplatesV8-no-defaults', this essentially just ensures prevTemplates is an array.
      if (prevTemplates.length === 0 && DEFAULT_TEMPLATES.length > 0) { 
        return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
      }

      return prevTemplates.map(t_loaded => {
        let newT: TCGCardTemplate = { ...getFreshDefaultTemplate(t_loaded.id, t_loaded.name), ...t_loaded };
        newT.id = newT.id || nanoid(); 
        newT.name = newT.name || "Untitled Loaded Template"; 

        newT.rows = (newT.rows || []).map((r_loaded: CardRow) => {
          const rowId = r_loaded.id || nanoid();
          const baseRow = createDefaultRow(rowId); 
          const newR: CardRow = { ...baseRow, ...r_loaded, id: rowId }; 

          newR.columns = (newR.columns || []).map((c_loaded: CardSection) => {
            const sectionId = c_loaded.id || nanoid();
            const baseCol = createDefaultSection(sectionId); 
            
            let finalContentPlaceholder = c_loaded.contentPlaceholder;
            if (typeof finalContentPlaceholder === 'string' && finalContentPlaceholder.startsWith(`{{${sectionId}}}`)) {
                finalContentPlaceholder = baseCol.contentPlaceholder; 
            }
            
            return { 
              ...baseCol, 
              ...c_loaded, 
              id: sectionId,
              contentPlaceholder: finalContentPlaceholder === undefined ? baseCol.contentPlaceholder : finalContentPlaceholder
            };
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
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]); 


  const handleSaveTemplate = (template: TCGCardTemplate) => {
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
    toast({ title: "Template Saved", description: `"${template.name}" has been saved/updated.` });

    if (!editingTemplate || editingTemplate.id === template.id || !templates.find(t => t.id === template.id)) {
        setEditingTemplate(template);
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) {
      setEditingTemplate(null);
    }
    if (singleCardGeneratorSelectedTemplateId === templateId) {
        setSingleCardGeneratorSelectedTemplateId(null);
    }
    toast({ title: "Template Deleted", description: "The template has been removed." });
  };

  const handleBulkCardsGenerated = (cards: DisplayCard[]) => {
    setGeneratedDisplayCards(prev => [...prev, ...cards]);
    if (cards.length > 0) {
        toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added to preview.` });
    }
  };

  const handleSingleCardAdded = (card: DisplayCard) => {
    setGeneratedDisplayCards(prev => [...prev, card]);
  };

  const handleClearGeneratedCards = () => {
    setGeneratedDisplayCards([]);
    toast({ title: "Cleared", description: "Generated cards have been cleared." });
  };

  const handleEditCardRequest = (cardToEdit: DisplayCard) => {
    setEditingCard(cardToEdit);
    setIsEditDialogOpen(true);
  };

  const handleSaveEditedCard = (updatedCard: DisplayCard) => {
    setGeneratedDisplayCards(prev =>
      prev.map(card => card.uniqueId === updatedCard.uniqueId ? updatedCard : card)
    );
    setIsEditDialogOpen(false);
    setEditingCard(null);
    toast({ title: "Card Updated", description: "Changes saved." });
  };

  const handleDuplicateCard = (cardToDuplicate: DisplayCard) => {
    const newCard: DisplayCard = {
      ...JSON.parse(JSON.stringify(cardToDuplicate)), 
      uniqueId: nanoid(), 
    };
    setGeneratedDisplayCards(prev => [...prev, newCard]);
    toast({ title: "Card Duplicated", description: "A copy of the card has been added." });
    setIsEditDialogOpen(false);
    setEditingCard(null);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingCard(null);
  };

  const handleSaveCardSet = () => {
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
  };

  const isValidDisplayCard = (item: any): item is DisplayCard => {
    return item &&
           typeof item.template === 'object' && item.template !== null &&
           typeof item.template.name === 'string' &&
           Array.isArray(item.template.rows) &&
           typeof item.data === 'object' && item.data !== null &&
           typeof item.uniqueId === 'string';
  };

  const handleLoadCardSet = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          const loadedItems = JSON.parse(jsonString);

          if (Array.isArray(loadedItems) && loadedItems.every(isValidDisplayCard)) {
            const processedCards = loadedItems.map(card => {
              const baseTemplate = getFreshDefaultTemplate(card.template.id || nanoid(), card.template.name || 'Untitled Loaded Template');
              let hydratedTemplate: TCGCardTemplate = { ...baseTemplate, ...card.template };
              hydratedTemplate.id = hydratedTemplate.id || baseTemplate.id;
              hydratedTemplate.name = hydratedTemplate.name || baseTemplate.name;

              hydratedTemplate.rows = (card.template.rows || []).map((r_loaded: any) => {
                const baseRow = createDefaultRow(r_loaded.id || nanoid(), [], r_loaded.alignItems, r_loaded.customHeight);
                const newR: CardRow = { ...baseRow, ...r_loaded, id: baseRow.id };
                newR.columns = (r_loaded.columns || []).map((c_loaded: any) => {
                  const baseCol = createDefaultSection(c_loaded.id || nanoid());
                  return { ...baseCol, ...c_loaded, id: baseCol.id };
                });
                return newR;
              });
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
  };

  const handleMobileMenuSelect = (tabValue: string) => {
    setActiveTab(tabValue);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (mounted && !singleCardGeneratorSelectedTemplateId && templates.length > 0) {
      setSingleCardGeneratorSelectedTemplateId(templates[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, mounted]);


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
                   />
                  <BulkGenerator
                    templates={templates}
                    onCardsGenerated={handleBulkCardsGenerated}
                  />

                  <Card>
                      <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2"> Manage & Preview</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSize} />
                          <div className="flex items-center space-x-2 pt-1">
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
                          <div className="flex flex-col gap-2 pt-2">
                             <div className="grid grid-cols-2 gap-2">
                               <Button variant="outline" onClick={handleSaveCardSet} disabled={generatedDisplayCards.length === 0} className="flex items-center gap-2">
                                  <FolderDown className="h-4 w-4" /> Save Set
                               </Button>
                               <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                                  <FolderUp className="h-4 w-4" /> Load Set
                               </Button>
                               <input type="file" ref={fileInputRef} onChange={handleLoadCardSet} accept=".json" style={{ display: 'none' }} />
                             </div>
                              <PrintButton disabled={generatedDisplayCards.length === 0} />
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
                    <ScrollArea id="printable-cards-area" className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card/30 shadow-inner">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 printable-grid">
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

