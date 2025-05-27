
"use client";

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/card-forge/Header';
import { TemplateEditor } from '@/components/card-forge/TemplateEditor';
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
import { PackageOpen, Settings, Wand2, Trash2, FilePlus2, LayoutDashboard, SlidersHorizontal, EyeOff, FileImage, FolderDown, FolderUp, Save, Sparkles, Cog, Menu as MenuIcon, Rows } from 'lucide-react';
import { nanoid } from 'nanoid';

import useLocalStorage from '@/hooks/useLocalStorage';
import { DEFAULT_TEMPLATES, PAPER_SIZES } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection, CardRow } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { generateCardText } from '@/ai/flows/generate-card-text';
import { extractUniquePlaceholderKeys } from '@/lib/utils';


export default function CardForgePage() {
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>('cardForgeTCGTemplatesV6', DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null);

  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const { toast } = useToast();
  const [hideEmptySections, setHideEmptySections] = useState<boolean>(true);

  const [editingCard, setEditingCard] = useState<DisplayCard | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingRandomCard, setIsGeneratingRandomCard] = useState(false);
  const [singleCardGeneratorSelectedTemplateId, setSingleCardGeneratorSelectedTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const TABS_CONFIG = [
    { value: "editor", label: "Template Editor", icon: LayoutDashboard },
    { value: "generator", label: "Card Generator", icon: PackageOpen },
    { value: "ai", label: "AI Helper", icon: Wand2 },
  ];


  // Effect for migrating older templates stored in localStorage and ensuring IDs
  useEffect(() => {
    setTemplates(prevTemplates => {
      return prevTemplates.map(t => {
        const newT = {...t}; // Shallow copy template
        newT.id = newT.id || nanoid(); // Ensure template has an ID

        // Ensure rows and columns have IDs
        if (newT.rows && Array.isArray(newT.rows)) {
          newT.rows = newT.rows.map(r => {
            const newR = {...r}; // Shallow copy row
            newR.id = newR.id || nanoid(); // Ensure row has an ID
            if (newR.columns && Array.isArray(newR.columns)) {
              newR.columns = newR.columns.map(c => {
                const newC = {...c}; // Shallow copy column
                newC.id = newC.id || nanoid(); // Ensure column has an ID
                return newC;
              });
            } else {
              newR.columns = []; // Initialize if missing
            }
            return newR;
          });
        } else {
          // Attempt to migrate very old 'sections' based templates
          const defaultTemplateForMigration = DEFAULT_TEMPLATES.find(dt => dt.name.includes("Standard")) || DEFAULT_TEMPLATES[0];
          newT.rows = JSON.parse(JSON.stringify(defaultTemplateForMigration.rows)).map((row: CardRow) => ({
            ...row,
            id: row.id || nanoid(),
            columns: (row.columns || []).map((col: CardSection) => ({...col, id: col.id || nanoid()}))
          }));
           // @ts-expect-error: remove old sections if migrating
          if (newT.sections) delete newT.sections;
        }

        // Ensure other defaults
        newT.aspectRatio = newT.aspectRatio || "63:88";
        newT.frameStyle = newT.frameStyle || 'standard';
        newT.baseBackgroundColor = newT.baseBackgroundColor || '';
        newT.baseTextColor = newT.baseTextColor || '';
        newT.borderColor = newT.borderColor || '';
        return newT;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount


  const handleSaveTemplate = (template: TCGCardTemplate) => {
    const existingIndex = templates.findIndex(t => t.id === template.id);
    if (existingIndex > -1) {
      const updatedTemplates = [...templates];
      updatedTemplates[existingIndex] = template;
      setTemplates(updatedTemplates);
      toast({ title: "Template Updated", description: `"${template.name}" has been updated.` });
    } else {
      setTemplates(prevTemplates => [...prevTemplates, template]);
      toast({ title: "Template Saved", description: `"${template.name}" has been saved.` });
    }
    if (editingTemplate?.id === template.id || existingIndex === -1) {
        setEditingTemplate(template); // Keep the editor in sync if currently editing this or it's new
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) {
      setEditingTemplate(null); // Clear editing state if deleted template was being edited
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
      ...cardToDuplicate,
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

  const handleLoadCardSet = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          const loadedCards = JSON.parse(jsonString) as DisplayCard[];

          if (Array.isArray(loadedCards) && loadedCards.every(isValidDisplayCard)) {
            // Ensure loaded cards and their nested structures have IDs
            const processedCards = loadedCards.map(card => ({
              ...card,
              uniqueId: card.uniqueId || nanoid(),
              template: {
                ...card.template,
                id: card.template.id || nanoid(),
                rows: (card.template.rows || []).map((r: CardRow) => ({
                    ...r,
                    id: r.id || nanoid(),
                    columns: (r.columns || []).map((s: CardSection) => ({ ...s, id: s.id || nanoid() }))
                }))
              }
            }));
            setGeneratedDisplayCards(processedCards);
            toast({ title: "Set Loaded", description: `${processedCards.length} cards loaded successfully.` });
          } else {
            toast({ title: "Load Error", description: "Invalid file format. Expected an array of cards.", variant: "destructive" });
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

  const isValidDisplayCard = (item: any): item is DisplayCard => {
    // Basic check, can be more thorough
    return item && typeof item.template === 'object' && Array.isArray(item.template.rows) && typeof item.data === 'object';
  };

  const handleGenerateRandomCard = async () => {
    let templateForRandom: TCGCardTemplate | undefined;
    if (singleCardGeneratorSelectedTemplateId) {
      templateForRandom = templates.find(t => t.id === singleCardGeneratorSelectedTemplateId);
    }
    if (!templateForRandom && templates.length > 0) {
      templateForRandom = templates[0];
    }

    if (!templateForRandom) {
      toast({ title: "Template Needed", description: "Please create or select a template first to generate a random card.", variant: "destructive" });
      return;
    }

    setIsGeneratingRandomCard(true);
    try {
      const placeholders = extractUniquePlaceholderKeys(templateForRandom);

      if (placeholders.length === 0) {
        toast({ title: "No Placeholders", description: "Selected template has no placeholders for AI to fill.", variant: "default" });
        setIsGeneratingRandomCard(false);
        return;
      }

      const aiResult = await generateCardText({ theme: "a completely random fantasy TCG card idea", textType: 'FullConceptIdea' });

      const cardData: { [key: string]: string } = {};
      placeholders.forEach(pKey => {
        cardData[pKey] = ''; // Initialize all placeholders
        if (pKey.toLowerCase().includes('art') && (pKey.toLowerCase().includes('url') || pKey.toLowerCase().includes('image'))) {
            cardData[pKey] = `https://placehold.co/600x400.png?text=AI+Art`; // Default art
        }
      });

      const aiLines = aiResult.cardText.split('\n');
      let parsedName = "Random Card";
      let parsedRules = "Random effect.";
      let parsedFlavor = "";

      aiLines.forEach(line => {
        if (line.toLowerCase().startsWith("card name:")) parsedName = line.substring("card name:".length).trim();
        else if (line.toLowerCase().startsWith("rules text:")) parsedRules = line.substring("rules text:".length).trim();
        else if (line.toLowerCase().startsWith("flavor text:")) parsedFlavor = line.substring("flavor text:".length).trim();
      });

      placeholders.forEach(pKey => {
        const pKeyLower = pKey.toLowerCase();
        if (pKeyLower.includes('name')) cardData[pKey] = parsedName;
        else if (pKeyLower.includes('rules') || pKeyLower.includes('text') || pKeyLower.includes('effect') && !pKeyLower.includes('flavor')) cardData[pKey] = parsedRules;
        else if (pKeyLower.includes('flavor')) cardData[pKey] = parsedFlavor;
        // Update artwork placeholder with the generated name
        else if (pKeyLower.includes('art') && (pKeyLower.includes('url') || pKeyLower.includes('image'))) cardData[pKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(parsedName.substring(0,20))}`;
        else if (pKeyLower.includes('cost')) cardData[pKey] = `${Math.floor(Math.random() * 5) + 1}`;
        else if (pKeyLower.includes('power') || pKeyLower.includes('attack')) cardData[pKey] = `${Math.floor(Math.random() * 5) + 1}`;
        else if (pKeyLower.includes('toughness') || pKeyLower.includes('health') || pKeyLower.includes('defense')) cardData[pKey] = `${Math.floor(Math.random() * 5) + 1}`;
        else if (pKeyLower.includes('type') && !pKeyLower.includes('sub')) cardData[pKey] = ['Creature', 'Spell', 'Enchantment', 'Artifact'][Math.floor(Math.random() * 4)];
      });

      const randomCard: DisplayCard = {
        template: templateForRandom,
        data: cardData,
        uniqueId: nanoid()
      };
      handleSingleCardAdded(randomCard);
      toast({title: "Random Card Generated", description: `"${parsedName}" added to preview.`})

    } catch (error) {
      console.error("Error generating random card:", error);
      toast({ title: "AI Error", description: "Failed to generate random card.", variant: "destructive" });
    } finally {
      setIsGeneratingRandomCard(false);
    }
  };

  const handleMobileMenuSelect = (tabValue: string) => {
    setActiveTab(tabValue);
    setIsMobileMenuOpen(false);
  };


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
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
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
                <tab.icon className="h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="editor">
            <TemplateEditor
              onSaveTemplate={handleSaveTemplate}
              templates={templates}
              onDeleteTemplate={handleDeleteTemplate}
              initialTemplate={editingTemplate}
            />
          </TabsContent>

          <TabsContent value="generator">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <SingleCardGenerator
                  templates={templates}
                  onSingleCardAdded={handleSingleCardAdded}
                  onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateId}
                />
                <BulkGenerator templates={templates} onCardsGenerated={handleBulkCardsGenerated} />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2"><Cog className="h-5 w-5"/>Manage & Preview</CardTitle>
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
                         <Button
                            variant="outline"
                            onClick={handleGenerateRandomCard}
                            disabled={isGeneratingRandomCard || templates.length === 0}
                            className="w-full flex items-center gap-2"
                        >
                            <Sparkles className="h-4 w-4" /> {isGeneratingRandomCard ? "Generating..." : "Generate Random Card (AI)"}
                        </Button>
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
                    <p className="text-sm">Use the panels on the left to add cards, load a set, or generate random cards.</p>
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
          </TabsContent>

          <TabsContent value="ai">
            <AIDesignAssistant templates={templates} />
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
