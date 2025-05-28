
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
import { AbilityContextManager } from '@/components/card-forge/AbilityContextManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PackageOpen, LayoutDashboard, Wand2, Trash2, FolderDown, FolderUp, Cog, Menu as MenuIcon, EyeOff, ScrollText, FilePlus2, Save, Sparkles } from 'lucide-react';
import { nanoid } from 'nanoid';

import useLocalStorage from '@/hooks/useLocalStorage';
import { DEFAULT_TEMPLATES, PAPER_SIZES, createDefaultSection, createDefaultRow } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection, CardRow, AbilityContextSet, CardSectionType } from '@/types';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_ABILITY_CONTEXT_SETS: AbilityContextSet[] = [
  {
    id: nanoid(),
    name: "MTG - Core Mechanics & Keywords",
    description: "Key Magic: The Gathering concepts: Mana colors (W-White, U-Blue, B-Black, R-Red, G-Green), C-Colorless mana. Tapping permanents for effects. Casting Spells. Turn Structure: Untap, Upkeep, Draw, Main Phase (pre-combat), Combat Phase, Main Phase (post-combat), End Step. The Stack (Last-In, First-Out for spells/abilities). Common Keywords: Flying (can only be blocked by creatures with flying or reach), Haste (can attack/tap the turn it enters), Vigilance (attacks without tapping), First Strike (deals combat damage before creatures without it), Double Strike (deals first strike and regular combat damage), Deathtouch (any amount of damage is lethal), Lifelink (damage dealt also gains you that much life), Trample (excess combat damage dealt to a creature is dealt to defending player/planeswalker), Indestructible (cannot be destroyed by damage or 'destroy' effects), Reach (can block creatures with flying). Players typically start with 20 life. Cards are drawn from a library into a hand."
  },
  {
    id: nanoid(),
    name: "MTG - Creature Combat Focus",
    description: "Magic: The Gathering creature combat: Creatures have Power (damage dealt) and Toughness (damage taken to be destroyed). Combat Phase Steps: Beginning of Combat, Declare Attackers, Declare Blockers, Combat Damage (first strike, then regular), End of Combat. Attacking creatures tap unless they have Vigilance. Blockers must be assigned to attacking creatures. Damage is assigned and dealt. If a creature's toughness is reduced to 0 or less, or it takes damage equal to or greater than its toughness from a source with deathtouch, it's destroyed and put into the graveyard. Common combat abilities: Flying, Trample, First Strike, Double Strike, Deathtouch, Reach."
  },
  {
    id: nanoid(),
    name: "MTG - Spell & Ability Interaction",
    description: "Magic: The Gathering spell and ability types: Instants (can be cast any time you have priority), Sorceries (cast only during your main phase when the stack is empty), Enchantments (permanents with static or triggered abilities), Artifacts (permanents, often with activated abilities or static effects), Creatures (summoned as spells, then become permanents), Planeswalkers (powerful permanents with loyalty abilities). Lands are not spells. Spells and abilities use The Stack, resolving one by one, last-in, first-out. Players can respond to items on the stack. Common interactions: Countering spells, Destroying permanents, Drawing cards, Discarding cards, Dealing direct damage, Gaining life, Searching libraries (tutoring)."
  }
];

const LOCAL_STORAGE_TEMPLATES_KEY = 'cardForgeTCGTemplatesV6';

export default function CardForgePage() {
  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>(LOCAL_STORAGE_TEMPLATES_KEY, DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null);

  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const { toast } = useToast();
  const [hideEmptySections, setHideEmptySections] = useState<boolean>(true);

  const [editingCard, setEditingCard] = useState<DisplayCard | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [singleCardGeneratorSelectedTemplateId, setSingleCardGeneratorSelectedTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [abilityContextSets, setAbilityContextSets] = useLocalStorage<AbilityContextSet[]>(
    'cardForgeAbilityContextsV1', 
    [] // Start with empty, useEffect will seed defaults if necessary
  );


  const TABS_CONFIG = [
    { value: "editor", label: "Template Editor", icon: LayoutDashboard },
    { value: "generator", label: "Card Generator", icon: PackageOpen },
    { value: "contexts", label: "Context Sets", icon: ScrollText },
    { value: "ai", label: "AI Helper", icon: Wand2 },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedContextsRaw = window.localStorage.getItem('cardForgeAbilityContextsV1');
      let storedContextsParsed: AbilityContextSet[] = [];
      if (storedContextsRaw) {
        try {
          storedContextsParsed = JSON.parse(storedContextsRaw);
        } catch (e) {
          console.error("Error parsing ability context sets from localStorage", e);
        }
      }

      if (storedContextsParsed.length === 0 && DEFAULT_ABILITY_CONTEXT_SETS.length > 0) {
        setAbilityContextSets(DEFAULT_ABILITY_CONTEXT_SETS);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount for ability contexts


  // Effect to migrate and validate templates from localStorage
  useEffect(() => {
    setTemplates(prevTemplates => {
      if (!prevTemplates || prevTemplates.length === 0) {
        return DEFAULT_TEMPLATES.map(t => JSON.parse(JSON.stringify(t))); // Deep clone defaults
      }
      return prevTemplates.map(t_loaded => {
        // Ensure template itself has an ID
        const newT: TCGCardTemplate = { ...t_loaded, id: t_loaded.id || nanoid() };

        // If rows are missing or not an array, attempt to find a matching preset by name
        if (!Array.isArray(newT.rows) || newT.rows.length === 0) {
          const preset = DEFAULT_TEMPLATES.find(dt => dt.name === newT.name);
          if (preset && preset.rows) {
            console.warn(`Template "${newT.name}" (ID: ${newT.id}) was missing rows. Initializing with preset structure.`);
            newT.rows = JSON.parse(JSON.stringify(preset.rows)); // Deep clone preset rows
            // Copy other key properties from preset if missing
            newT.aspectRatio = newT.aspectRatio || preset.aspectRatio;
            newT.frameStyle = newT.frameStyle || preset.frameStyle;
            newT.baseBackgroundColor = newT.baseBackgroundColor || preset.baseBackgroundColor;
            newT.baseTextColor = newT.baseTextColor || preset.baseTextColor;
            newT.defaultSectionBorderColor = newT.defaultSectionBorderColor || preset.defaultSectionBorderColor;
            newT.cardBorderColor = newT.cardBorderColor || preset.cardBorderColor;
            newT.cardBorderWidth = newT.cardBorderWidth || preset.cardBorderWidth;
            newT.cardBorderStyle = newT.cardBorderStyle || preset.cardBorderStyle;
            newT.cardBorderRadius = newT.cardBorderRadius || preset.cardBorderRadius;

          } else {
            console.warn(`Template "${newT.name}" (ID: ${newT.id}) was missing rows and no matching preset. Creating a default row.`);
            newT.rows = [createDefaultRow(nanoid(), [createDefaultSection('CustomText', nanoid())])];
          }
        }

        // Ensure all rows and columns within rows have IDs and valid structure
        newT.rows = newT.rows.map((r_loaded: any) => {
          const rowId = r_loaded.id || nanoid();
          // Start with a fresh default row structure to ensure all current properties exist
          const baseRow = createDefaultRow(rowId, [], r_loaded.alignItems, r_loaded.customHeight);
          const newR: CardRow = {
            ...baseRow, // Base defaults for a row
            ...r_loaded, // Loaded row properties override
            id: rowId, // Ensure ID
            columns: (r_loaded.columns || []).map((c_loaded: any) => {
              const sectionId = c_loaded.id || nanoid();
              const sectionType = (c_loaded.type as CardSectionType | undefined) || 'CustomText';
              
              // Start with a fresh default section structure for this type and ID
              const baseSection = createDefaultSection(sectionType, sectionId);
              const newC: CardSection = {
                ...baseSection, // Base defaults for this section type
                ...c_loaded,    // Loaded section properties override
                id: sectionId,  // Ensure ID
                type: sectionType, // Ensure type
              };

              // Simplified contentPlaceholder correction: if malformed, reset to current type's default placeholder
              const placeholderLooksLikeOldId = typeof newC.contentPlaceholder === 'string' && newC.contentPlaceholder.startsWith(`{{${sectionId}`);
              const placeholderIsEffectivelyMissing = newC.contentPlaceholder === undefined || newC.contentPlaceholder === null || (typeof newC.contentPlaceholder === 'string' && newC.contentPlaceholder.trim() === '');
              
              if (placeholderIsEffectivelyMissing || placeholderLooksLikeOldId) {
                console.warn(`ContentPlaceholder for section ID ${sectionId} in template "${newT.name}" seemed malformed or missing. Resetting to type default.`);
                newC.contentPlaceholder = baseSection.contentPlaceholder; // Reset to current default for this type
              }
              return newC;
            })
          };
          return newR;
        });
        return newT;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount


  const handleSaveTemplate = (template: TCGCardTemplate) => {
    const existingIndex = templates.findIndex(t => t.id === template.id);
    let updatedTemplates;
    if (existingIndex > -1) {
      updatedTemplates = [...templates];
      updatedTemplates[existingIndex] = template;
    } else {
      updatedTemplates = [...templates, template];
    }
    setTemplates(updatedTemplates);
    toast({ title: "Template Saved", description: `"${template.name}" has been saved/updated.` });
    
    // If we just saved the template that was being edited, or added a new one, keep it as the active editing template.
    if (editingTemplate?.id === template.id || existingIndex === -1) {
        setEditingTemplate(template); // Update editingTemplate to ensure editor reflects the saved version
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
    setIsEditDialogOpen(false); // Close dialog after duplicating from it
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
            const processedCards = loadedCards.map(card => {
              // Deep clone and ensure IDs for safety, similar to template migration
              const newTemplate = { ...card.template, id: card.template.id || nanoid() };
              newTemplate.rows = (newTemplate.rows || []).map(r => {
                const newRow = { ...r, id: r.id || nanoid() };
                newRow.columns = (newRow.columns || []).map(c => ({ ...c, id: c.id || nanoid(), type: c.type || 'CustomText' }));
                return newRow;
              });
              return { ...card, uniqueId: card.uniqueId || nanoid(), template: newTemplate };
            });
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
    return item && typeof item.template === 'object' && typeof item.template.name === 'string' && Array.isArray(item.template.rows) && typeof item.data === 'object';
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

          <TabsList className="hidden md:grid w-full md:grid-cols-4 mb-6 no-print">
            {TABS_CONFIG.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
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
                    abilityContextSets={abilityContextSets}
                    onTemplateSelectionChange={setSingleCardGeneratorSelectedTemplateId}
                 />
                <BulkGenerator 
                  templates={templates} 
                  onCardsGenerated={handleBulkCardsGenerated}
                  abilityContextSets={abilityContextSets} 
                />

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

          <TabsContent value="contexts">
            <AbilityContextManager 
              contextSets={abilityContextSets}
              onContextSetsChange={setAbilityContextSets}
            />
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
