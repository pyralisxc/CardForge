
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
import { PackageOpen, Settings, Wand2, Trash2, FilePlus2, LayoutTemplate } from 'lucide-react'; // Added LayoutTemplate
import { nanoid } from 'nanoid'; // Import nanoid

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

  // Ensure templates have unique IDs and valid sections, especially when loading from older localStorage
  useEffect(() => {
    setTemplates(prevTemplates => {
      return prevTemplates.map(t => {
        const newT = {...t}; // Work on a copy
        let changed = false;

        if (!newT.id) { // Ensure template has an ID
          newT.id = nanoid();
          changed = true;
        }

        if (!newT.sections || !Array.isArray(newT.sections) || newT.sections.length === 0) {
          // If sections are missing or invalid, try to apply a default
          const defaultTemplateForMigration = DEFAULT_TEMPLATES.find(dt => dt.name.includes("Standard")) || DEFAULT_TEMPLATES[0];
          newT.sections = JSON.parse(JSON.stringify(defaultTemplateForMigration.sections)); // Deep copy default sections
          newT.templateType = newT.templateType || defaultTemplateForMigration.templateType;
          newT.aspectRatio = newT.aspectRatio || defaultTemplateForMigration.aspectRatio;
          changed = true;
        } else {
          // Ensure sections have IDs
          const originalSectionsJSON = JSON.stringify(newT.sections);
          newT.sections = newT.sections.map(s => {
            if (!s.id) {
              changed = true;
              return {...s, id: nanoid() };
            }
            return s;
          });
          if (JSON.stringify(newT.sections) !== originalSectionsJSON) {
            // This check is implicitly covered if any s.id was missing and 'changed' became true.
            // But explicitly, if section objects themselves changed (e.g. new ID assigned).
            changed = true; 
          }
        }
        // If changes were made (e.g. IDs added), return the new object. Otherwise, return original to avoid unnecessary re-renders.
        // Note: This effect runs after useLocalStorage has loaded data. If data from localStorage was modified,
        // useLocalStorage will handle saving it back. This effect primarily ensures data integrity.
        return newT; // Always return newT because object identity might change even if 'changed' is false due to spread {...t}
      });
    });
  // DEFAULT_TEMPLATES can be a dependency if it could change, but it's a constant.
  // setTemplates is stable.
  // This effect should run when the templates from useLocalStorage are first processed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount after initial templates are loaded by useLocalStorage


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

  const selectTemplateForEditing = (template: TCGCardTemplate) => {
    setEditingTemplate(template);
    setActiveTab("editor"); 
  };


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 no-print">
            <TabsTrigger value="editor" className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" /> Template Editor
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
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</h3>
                <SingleCardGenerator templates={templates} onSingleCardAdded={handleSingleCardAdded} />
                
                <Separator className="my-6" />
                
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2"><PackageOpen className="h-5 w-5" />Bulk Card Generation</h3>
                <BulkGenerator templates={templates} onCardsGenerated={handleBulkCardsGenerated} />
                
                <Separator className="my-6" />

                <h3 className="text-xl font-semibold text-foreground">Print Options</h3>
                <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={setSelectedPaperSize} />
                <div className="flex flex-col sm:flex-row gap-2">
                    <PrintButton disabled={generatedDisplayCards.length === 0} />
                    {generatedDisplayCards.length > 0 && (
                        <Button variant="destructive" onClick={handleClearGeneratedCards} className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> Clear All ({generatedDisplayCards.length})
                        </Button>
                    )}
                </div>
              </div>
              <div className="md:col-span-2">
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Generated Cards Preview ({generatedDisplayCards.length})</h2>
                {generatedDisplayCards.length === 0 ? (
                  <p className="text-muted-foreground">No cards generated yet. Use the panels on the left to add cards.</p>
                ) : (
                  <ScrollArea id="printable-cards-area" className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 printable-grid">
                      {generatedDisplayCards.map((cardItem) => (
                        <CardPreview
                          key={cardItem.uniqueId}
                          template={cardItem.template}
                          data={cardItem.data}
                          isPrintMode={false} 
                          className="mx-auto"
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
