
"use client";

import { useState } from 'react';
import { Header } from '@/components/card-forge/Header';
import { TemplateEditor } from '@/components/card-forge/TemplateEditor';
import { BulkGenerator } from '@/components/card-forge/BulkGenerator';
import { AIDesignAssistant } from '@/components/card-forge/AIDesignAssistant'; // Kept for now, might be useful for text ideas
import { CardPreview } from '@/components/card-forge/CardPreview';
import { PaperSizeSelector } from '@/components/card-forge/PaperSizeSelector';
import { PrintButton } from '@/components/card-forge/PrintButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PackageOpen, Settings, Wand2, Trash2 } from 'lucide-react';

import useLocalStorage from '@/hooks/useLocalStorage';
import { DEFAULT_TEMPLATES, PAPER_SIZES } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard } from '@/types'; // Changed
import { useToast } from '@/hooks/use-toast';

export default function CardForgePage() {
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>('cardForgeTCGTemplates', DEFAULT_TEMPLATES); // Changed key and type
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null); // Changed type
  
  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const { toast } = useToast();

  const handleSaveTemplate = (template: TCGCardTemplate) => { // Changed type
    const existingIndex = templates.findIndex(t => t.id === template.id);
    if (existingIndex > -1) {
      const updatedTemplates = [...templates];
      updatedTemplates[existingIndex] = template;
      setTemplates(updatedTemplates);
      toast({ title: "TCG Template Updated", description: `"${template.name}" has been updated.` });
    } else {
      setTemplates(prevTemplates => [...prevTemplates, template]);
      toast({ title: "TCG Template Saved", description: `"${template.name}" has been saved.` });
    }
    setEditingTemplate(template); 
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) {
      setEditingTemplate(null);
    }
    toast({ title: "TCG Template Deleted", description: "The TCG template has been removed." });
  };
  
  // This function is no longer used in TemplateEditor, selecting template is handled internally by TemplateEditor
  // const handleSelectTemplateToEdit = (template: TCGCardTemplate) => { // Changed type
  //   setEditingTemplate(template);
  //   // setActiveTab("editor"); 
  // };

  const handleCardsGenerated = (cards: DisplayCard[]) => {
    setGeneratedDisplayCards(cards);
    if (cards.length > 0) {
        setActiveTab("generator"); 
    }
  };

  const handleClearGeneratedCards = () => {
    setGeneratedDisplayCards([]);
    toast({ title: "Cleared", description: "Generated TCG cards have been cleared." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 no-print">
            <TabsTrigger value="editor" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> TCG Template Editor
            </TabsTrigger>
            <TabsTrigger value="generator" className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4" /> TCG Card Generator
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> AI Text Helper
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor">
            <TemplateEditor
              onSaveTemplate={handleSaveTemplate}
              templates={templates}
              onDeleteTemplate={handleDeleteTemplate}
              initialTemplate={editingTemplate} // Pass currently editing template
            />
          </TabsContent>

          <TabsContent value="generator">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-6">
                <BulkGenerator templates={templates} onCardsGenerated={handleCardsGenerated} />
                <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSize} />
                <div className="flex flex-col sm:flex-row gap-2">
                    <PrintButton disabled={generatedDisplayCards.length === 0} />
                    {generatedDisplayCards.length > 0 && (
                        <Button variant="destructive" onClick={handleClearGeneratedCards} className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> Clear Generated Cards
                        </Button>
                    )}
                </div>
              </div>
              <div className="md:col-span-2">
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Generated TCG Cards Preview</h2>
                {generatedDisplayCards.length === 0 ? (
                  <p className="text-muted-foreground">No TCG cards generated yet. Use the panel on the left.</p>
                ) : (
                  <ScrollArea id="printable-cards-area" className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 printable-grid">
                      {generatedDisplayCards.map((cardItem) => (
                        <CardPreview
                          key={cardItem.uniqueId}
                          template={cardItem.template}
                          data={cardItem.data}
                          isPrintMode={false} 
                          className="mx-auto" // Center cards in grid cells
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
      <footer className="text-center p-4 text-muted-foreground text-sm border-t no-print">
        TCG Card Forge &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
