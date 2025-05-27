
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
import { PackageOpen, Settings, Wand2, Trash2, FilePlus2, LayoutDashboard, SlidersHorizontal, EyeOff, FileImage, FolderDown, FolderUp, Save, Sparkles, Cog } from 'lucide-react';
import { nanoid } from 'nanoid'; 

import useLocalStorage from '@/hooks/useLocalStorage';
import { DEFAULT_TEMPLATES, PAPER_SIZES } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { generateCardText } from '@/ai/flows/generate-card-text';
import { extractUniquePlaceholderKeys } from '@/lib/utils';


export default function CardForgePage() {
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>('cardForgeTCGTemplatesV5', DEFAULT_TEMPLATES); // Incremented version for potential migration needs
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


  useEffect(() => {
    setTemplates(prevTemplates => {
      return prevTemplates.map(t => {
        const newT = {...t}; 
        let changed = false;

        if (!newT.id) { 
          newT.id = nanoid();
          changed = true;
        }
        
        if (!newT.sections || !Array.isArray(newT.sections) || newT.sections.length === 0) {
          const defaultTemplateForMigration = DEFAULT_TEMPLATES.find(dt => dt.name.includes("Standard")) || DEFAULT_TEMPLATES[0];
          newT.sections = JSON.parse(JSON.stringify(defaultTemplateForMigration.sections)).map((s: CardSection) => ({...s, id: s.id || nanoid()})); 
          newT.templateType = newT.templateType || defaultTemplateForMigration.templateType;
          changed = true;
        } else {
          newT.sections = newT.sections.map(s => {
            if (!s.id) {
              changed = true;
              return {...s, id: nanoid() };
            }
            return s;
          });
        }
        if (!newT.aspectRatio) { 
            newT.aspectRatio = "63:88";
            changed = true;
        }
        if (!newT.frameStyle) {
          newT.frameStyle = 'standard';
          changed = true;
        }
        // Ensure base colors exist, falling back to empty strings if not, so CardPreview doesn't break
        newT.baseBackgroundColor = newT.baseBackgroundColor || '';
        newT.baseTextColor = newT.baseTextColor || '';
        newT.borderColor = newT.borderColor || '';
        newT.frameColor = newT.frameColor || '';


        return newT; 
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


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
    if (editingTemplate?.id === template.id || existingIndex > -1) {
        setEditingTemplate(template); 
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) {
      setEditingTemplate(null); 
    }
    toast({ title: "Template Deleted", description: "The template has been removed." });
  };
  
  const handleBulkCardsGenerated = (cards: DisplayCard[]) => {
    setGeneratedDisplayCards(prev => [...prev, ...cards]);
    if (cards.length > 0) {
        // setActiveTab("generator"); // Keep current tab, user might be on single card gen
        toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added to preview.` });
    }
  };

  const handleSingleCardAdded = (card: DisplayCard) => {
    setGeneratedDisplayCards(prev => [...prev, card]);
    // setActiveTab("generator"); // Keep current tab
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
          const loadedCards = JSON.parse(jsonString);
          if (Array.isArray(loadedCards) && loadedCards.every(isValidDisplayCard)) {
            const processedCards = loadedCards.map(card => ({
              ...card,
              template: {
                ...card.template,
                sections: card.template.sections.map((s: CardSection) => ({ ...s, id: s.id || nanoid() }))
              },
              uniqueId: card.uniqueId || nanoid() 
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
    return item && typeof item.template === 'object' && typeof item.data === 'object' && (typeof item.uniqueId === 'string' || typeof item.uniqueId === 'undefined') && Array.isArray(item.template.sections);
  };

  const handleGenerateRandomCard = async () => {
    let selectedTemplateForRandom: TCGCardTemplate | undefined;
    const singleTemplateSelect = document.getElementById('singleTemplateSelect') as HTMLSelectElement | null;
    
    if (singleTemplateSelect?.value) {
      selectedTemplateForRandom = templates.find(t => t.id === singleTemplateSelect.value);
    }
    if (!selectedTemplateForRandom && templates.length > 0) {
      selectedTemplateForRandom = templates[0];
    }

    if (!selectedTemplateForRandom) {
      toast({ title: "Template Needed", description: "Please create or select a template first to generate a random card.", variant: "destructive" });
      return;
    }

    setIsGeneratingRandomCard(true);
    try {
      const placeholders = new Set<string>();
      selectedTemplateForRandom.sections.forEach(section => {
        extractUniquePlaceholderKeys(section.contentPlaceholder).forEach(key => placeholders.add(key));
      });

      if (placeholders.size === 0) {
        toast({ title: "No Placeholders", description: "Selected template has no placeholders for AI to fill.", variant: "default" });
        setIsGeneratingRandomCard(false);
        return;
      }
      
      const aiResult = await generateCardText({ theme: "a completely random fantasy TCG card idea", textType: 'FullConceptIdea' });
      
      const cardData: { [key: string]: string } = {};
      const aiLines = aiResult.cardText.split('\n');
      let parsedName = "Random Card";
      let parsedRules = "Random effect.";
      let parsedFlavor = "";

      aiLines.forEach(line => {
        if (line.toLowerCase().startsWith("card name:")) parsedName = line.substring("card name:".length).trim();
        else if (line.toLowerCase().startsWith("rules text:")) parsedRules = line.substring("rules text:".length).trim();
        else if (line.toLowerCase().startsWith("flavor text:")) parsedFlavor = line.substring("flavor text:".length).trim();
      });
      
      Array.from(placeholders).forEach(pKey => {
        if (pKey.toLowerCase().includes('name')) cardData[pKey] = parsedName;
        else if (pKey.toLowerCase().includes('rules') || pKey.toLowerCase().includes('text') || pKey.toLowerCase().includes('effect')) cardData[pKey] = parsedRules;
        else if (pKey.toLowerCase().includes('flavor')) cardData[pKey] = parsedFlavor;
        else if (pKey.toLowerCase().includes('art') && (pKey.toLowerCase().includes('url') || pKey.toLowerCase().includes('image'))) cardData[pKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(parsedName.substring(0,20))}`;
        else if (pKey.toLowerCase().includes('cost')) cardData[pKey] = `${Math.floor(Math.random() * 5) + 1}`;
        else if (pKey.toLowerCase().includes('power')) cardData[pKey] = `${Math.floor(Math.random() * 5) + 1}`;
        else if (pKey.toLowerCase().includes('toughness')) cardData[pKey] = `${Math.floor(Math.random() * 5) + 1}`;
        else if (pKey.toLowerCase().includes('type') && !pKey.toLowerCase().includes('sub')) cardData[pKey] = ['Creature', 'Spell', 'Enchantment'][Math.floor(Math.random() * 3)];
        else cardData[pKey] = "AI Value"; // Generic fallback
      });

      const randomCard: DisplayCard = {
        template: selectedTemplateForRandom,
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mb-6 no-print">
            <TabsTrigger value="editor" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" /> Template Editor
            </TabsTrigger>
            <TabsTrigger value="generator" className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4" /> Card Generator
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> AI Helper
            </TabsTrigger>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-6">
                <SingleCardGenerator templates={templates} onSingleCardAdded={handleSingleCardAdded} />
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
              <div className="md:col-span-2">
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
    
