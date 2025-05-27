
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/card-forge/Header';
import { TemplateEditor } from '@/components/card-forge/TemplateEditor';
import { BulkGenerator } from '@/components/card-forge/BulkGenerator';
import { SingleCardGenerator } from '@/components/card-forge/SingleCardGenerator';
import { AIDesignAssistant } from '@/components/card-forge/AIDesignAssistant';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { PaperSizeSelector } from '@/components/card-forge/PaperSizeSelector';
import { PrintButton } from '@/components/card-forge/PrintButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PackageOpen, Settings, Wand2, Trash2, FilePlus2, LayoutDashboard, SlidersHorizontal, EyeOff } from 'lucide-react'; // Updated icon
import { nanoid } from 'nanoid'; 

import useLocalStorage from '@/hooks/useLocalStorage';
import { DEFAULT_TEMPLATES, PAPER_SIZES } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function CardForgePage() {
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>('cardForgeTCGTemplatesV3', DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null);
  
  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const { toast } = useToast();
  const [hideEmptySections, setHideEmptySections] = useState<boolean>(true);


  useEffect(() => {
    // Migration logic for older templates
    setTemplates(prevTemplates => {
      return prevTemplates.map(t => {
        const newT = {...t}; 
        let changed = false;

        if (!newT.id) { 
          newT.id = nanoid();
          changed = true;
        }
        
        // Ensure sections exist and have IDs
        if (!newT.sections || !Array.isArray(newT.sections) || newT.sections.length === 0) {
          const defaultTemplateForMigration = DEFAULT_TEMPLATES.find(dt => dt.name.includes("Standard")) || DEFAULT_TEMPLATES[0];
          newT.sections = JSON.parse(JSON.stringify(defaultTemplateForMigration.sections)).map((s: any) => ({...s, id: s.id || nanoid()})); 
          newT.templateType = newT.templateType || defaultTemplateForMigration.templateType;
          newT.aspectRatio = newT.aspectRatio || defaultTemplateForMigration.aspectRatio;
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
        setActiveTab("generator"); 
        toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added to preview.` });
    }
  };

  const handleSingleCardAdded = (card: DisplayCard) => {
    setGeneratedDisplayCards(prev => [...prev, card]);
    setActiveTab("generator");
  };

  const handleClearGeneratedCards = () => {
    setGeneratedDisplayCards([]);
    toast({ title: "Cleared", description: "Generated cards have been cleared." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 no-print">
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
                        <CardTitle className="text-xl flex items-center gap-2"><SlidersHorizontal className="h-5 w-5"/>Print & Preview Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSize} />
                        <div className="flex items-center space-x-2 pt-2">
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
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
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
                  <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] border rounded-md bg-card/30 text-muted-foreground p-8">
                    <PackageOpen className="h-16 w-16 mb-4" />
                    <p className="text-lg">No cards generated yet.</p>
                    <p className="text-sm">Use the panels on the left to add single or bulk cards.</p>
                  </div>
                ) : (
                  <ScrollArea id="printable-cards-area" className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card/30 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 printable-grid">
                      {generatedDisplayCards.map((cardItem, index) => (
                        <CardPreview
                          key={cardItem.uniqueId}
                          template={cardItem.template}
                          data={cardItem.data}
                          isPrintMode={false} 
                          className="mx-auto"
                          showSizeInfo={index === 0}
                          hideEmptySections={hideEmptySections}
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
      <footer className="text-center p-4 text-muted-foreground text-sm border-t no-print">
        TCG Card Forge &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
