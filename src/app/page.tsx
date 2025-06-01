
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
import { PAPER_SIZES, createDefaultSection, TABS_CONFIG, DEFAULT_TEMPLATES, TCG_ASPECT_RATIO } from '@/lib/constants';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardSection, CardRow, StoredDisplayCard, CardData } from '@/types';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_TEMPLATES_KEY = 'cardForgeTCGTemplatesV10-reconstructed';
const LOCAL_STORAGE_CARD_SET_KEY = 'cardForgeTCGSavedSetV2-templateIDs';
const MAX_DATA_URI_LENGTH_FOR_PERSISTENCE = 100 * 1024; // 100KB threshold for stripping from localStorage


export default function CardForgePage() {
  const [mounted, setMounted] = useState(false);
  const memoizedGetFreshDefaultTemplate = useCallback(getFreshDefaultTemplate, []);
  const { toast } = useToast();

  const reconstructMinimalTemplate = useCallback((t_loaded: Partial<TCGCardTemplate>): TCGCardTemplate => {
    const validatedId = (t_loaded.id && t_loaded.id.trim() !== "") ? t_loaded.id : nanoid();
    
    const base: Partial<TCGCardTemplate> = { 
        id: validatedId,
        name: t_loaded.name || `Template ${validatedId.substring(0, 8)}`,
        aspectRatio: t_loaded.aspectRatio || TCG_ASPECT_RATIO,
        frameStyle: t_loaded.frameStyle || 'standard',
        rows: [],
    };

    if (t_loaded.cardBackgroundImageUrl) {
      if (t_loaded.cardBackgroundImageUrl.startsWith('data:') && t_loaded.cardBackgroundImageUrl.length > MAX_DATA_URI_LENGTH_FOR_PERSISTENCE) {
        base.cardBackgroundImageUrl = `placeholder:Card background image too large for storage`;
      } else {
        base.cardBackgroundImageUrl = t_loaded.cardBackgroundImageUrl;
      }
    }
    if (t_loaded.baseBackgroundColor) base.baseBackgroundColor = t_loaded.baseBackgroundColor;
    if (t_loaded.baseTextColor) base.baseTextColor = t_loaded.baseTextColor;
    if (t_loaded.defaultSectionBorderColor) base.defaultSectionBorderColor = t_loaded.defaultSectionBorderColor;
    if (t_loaded.cardBorderColor) base.cardBorderColor = t_loaded.cardBorderColor;
    if (t_loaded.cardBorderWidth) base.cardBorderWidth = t_loaded.cardBorderWidth; else base.cardBorderWidth = '4px';
    if (t_loaded.cardBorderStyle) base.cardBorderStyle = t_loaded.cardBorderStyle; else base.cardBorderStyle = 'solid';
    if (t_loaded.cardBorderRadius) base.cardBorderRadius = t_loaded.cardBorderRadius; else base.cardBorderRadius = '0.5rem';
    
    const newT = base as TCGCardTemplate;

    const sourceRows = t_loaded.rows && t_loaded.rows.length > 0 ? t_loaded.rows : memoizedGetFreshDefaultTemplate(null, newT.name).rows;

    newT.rows = sourceRows.map((r_source: Partial<CardRow>) => {
        const rowId = (r_source.id && r_source.id.trim() !== "") ? r_source.id : nanoid();
        const newR: CardRow = {
            id: rowId,
            columns: [],
            alignItems: r_source.alignItems || 'flex-start',
        };
        if (r_source.customHeight) newR.customHeight = r_source.customHeight;

        const sourceColumns = r_source.columns && r_source.columns.length > 0 ? r_source.columns : [createDefaultSection(nanoid())];

        newR.columns = sourceColumns.map((c_source: Partial<CardSection>) => {
            const sectionId = (c_source.id && c_source.id.trim() !== "") ? c_source.id : nanoid();
            const newC: CardSection = {
                id: sectionId,
                sectionContentType: c_source.sectionContentType || 'placeholder',
                contentPlaceholder: c_source.contentPlaceholder || '',
                flexGrow: c_source.flexGrow === undefined ? 0 : c_source.flexGrow,
            };
            
            if (c_source.backgroundImageUrl) {
              if (c_source.backgroundImageUrl.startsWith('data:') && c_source.backgroundImageUrl.length > MAX_DATA_URI_LENGTH_FOR_PERSISTENCE) {
                newC.backgroundImageUrl = `placeholder:Section background image too large for storage`;
              } else {
                newC.backgroundImageUrl = c_source.backgroundImageUrl;
              }
            }
            if (c_source.imageWidthPx) newC.imageWidthPx = c_source.imageWidthPx; else if(newC.sectionContentType === 'image') newC.imageWidthPx = '100';
            if (c_source.imageHeightPx) newC.imageHeightPx = c_source.imageHeightPx; else if(newC.sectionContentType === 'image') newC.imageHeightPx = '100';
            if (c_source.textColor) newC.textColor = c_source.textColor;
            if (c_source.backgroundColor) newC.backgroundColor = c_source.backgroundColor;
            if (c_source.fontFamily) newC.fontFamily = c_source.fontFamily; else newC.fontFamily = 'font-sans';
            if (c_source.fontSize) newC.fontSize = c_source.fontSize; else newC.fontSize = 'text-sm';
            if (c_source.fontWeight) newC.fontWeight = c_source.fontWeight; else newC.fontWeight = 'font-normal';
            if (c_source.textAlign) newC.textAlign = c_source.textAlign; else newC.textAlign = 'left';
            if (c_source.fontStyle) newC.fontStyle = c_source.fontStyle; else newC.fontStyle = 'normal';
            if (c_source.padding) newC.padding = c_source.padding; else newC.padding = 'p-1';
            if (c_source.borderColor) newC.borderColor = c_source.borderColor;
            if (c_source.borderWidth && c_source.borderWidth !== '_none_') newC.borderWidth = c_source.borderWidth; else newC.borderWidth = '_none_';
            if (c_source.borderRadius && c_source.borderRadius !== 'rounded-none') newC.borderRadius = c_source.borderRadius; else newC.borderRadius = 'rounded-none';
            if (c_source.minHeight && c_source.minHeight !== '_auto_') newC.minHeight = c_source.minHeight; else newC.minHeight = '_auto_';
            if (c_source.customHeight) newC.customHeight = c_source.customHeight;
            if (c_source.customWidth) newC.customWidth = c_source.customWidth;
            return newC;
        });
        return newR;
    });
    
    if (newT.rows.length === 0) {
        newT.rows = memoizedGetFreshDefaultTemplate(null, newT.name).rows.map(r => ({...r, id:nanoid(), columns: r.columns.map(c => ({...c, id:nanoid()}))}));
    }
    return newT;
  }, [memoizedGetFreshDefaultTemplate]);


  const [templates, setTemplates] = useLocalStorage<TCGCardTemplate[]>(LOCAL_STORAGE_TEMPLATES_KEY, []);
  const [editingTemplate, setEditingTemplate] = useState<TCGCardTemplate | null>(null);

  const [generatedDisplayCards, setGeneratedDisplayCards] = useState<DisplayCard[]>([]);
  const [storedCards, setStoredCards] = useLocalStorage<StoredDisplayCard[]>(LOCAL_STORAGE_CARD_SET_KEY, []);
  const [cardViewSides, setCardViewSides] = useState<Record<string, 'front' | 'back'>>({});

  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(PAPER_SIZES[0]);
  const [activeTab, setActiveTab] = useState<string>(TABS_CONFIG[0].value);
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
    
    const processedTemplates = initialTemplatesToLoad.map(reconstructMinimalTemplate);
    if (JSON.stringify(templates) !== JSON.stringify(processedTemplates)) {
        setTemplates(processedTemplates);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, reconstructMinimalTemplate]);


  useEffect(() => {
    if (!mounted) return;

    const rehydratedCards: DisplayCard[] = [];
    let missingTemplatesInfo = { front: 0, back: 0, totalSkipped: 0 };

    for (const stored of storedCards) {
      const frontTemplateIdToFind = stored.frontTemplateId;
      if (!frontTemplateIdToFind || frontTemplateIdToFind.trim() === "") {
          missingTemplatesInfo.front++;
          missingTemplatesInfo.totalSkipped++;
          continue;
      }
      const frontTemplateFound = templates.find(t => t.id === frontTemplateIdToFind);
      if (!frontTemplateFound) {
        missingTemplatesInfo.front++;
        missingTemplatesInfo.totalSkipped++;
        continue;
      }
      const frontTemplate = reconstructMinimalTemplate(frontTemplateFound);
      if (!frontTemplate) { 
        missingTemplatesInfo.front++;
        missingTemplatesInfo.totalSkipped++;
        continue;
      }

      let backTemplate: TCGCardTemplate | null = null;
      if (stored.backTemplateId && stored.backTemplateId.trim() !== "") {
        const backTemplateFound = templates.find(t => t.id === stored.backTemplateId);
        if (backTemplateFound) {
          backTemplate = reconstructMinimalTemplate(backTemplateFound);
          if (!backTemplate) missingTemplatesInfo.back++;
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

    if (missingTemplatesInfo.totalSkipped > 0 && rehydratedCards.length < storedCards.length) { 
        let message = `Some cards could not be fully loaded: ${missingTemplatesInfo.totalSkipped} card(s) skipped due to missing front templates.`;
        if(missingTemplatesInfo.back > 0) message += ` Additionally, ${missingTemplatesInfo.back} card(s) are missing their back templates.`;
        toast({ title: "Card Load Notice", description: message, variant: "default", duration: 7000 });
    }
  }, [storedCards, templates, mounted, reconstructMinimalTemplate, toast, generatedDisplayCards]); 

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
  }, [generatedDisplayCards, mounted, setStoredCards, storedCards]);

  const handleSaveTemplate = useCallback((template: TCGCardTemplate) => {
    const templateForStorage = { ...template }; // Start with a copy of the template from the editor
    let cardBgStripped = false;
    let sectionBgStrippedCount = 0;

    // Sanitize card background image for storage
    if (templateForStorage.cardBackgroundImageUrl && 
        templateForStorage.cardBackgroundImageUrl.startsWith('data:') && 
        templateForStorage.cardBackgroundImageUrl.length > MAX_DATA_URI_LENGTH_FOR_PERSISTENCE) {
      templateForStorage.cardBackgroundImageUrl = `placeholder:Card background image was too large to save.`;
      cardBgStripped = true;
    }

    // Sanitize section background images for storage
    templateForStorage.rows = templateForStorage.rows.map(row => ({
      ...row,
      columns: row.columns.map(section => {
        if (section.backgroundImageUrl && 
            section.backgroundImageUrl.startsWith('data:') && 
            section.backgroundImageUrl.length > MAX_DATA_URI_LENGTH_FOR_PERSISTENCE) {
          sectionBgStrippedCount++;
          return { ...section, backgroundImageUrl: `placeholder:Section background image was too large to save.` };
        }
        return section;
      })
    }));
    
    if (cardBgStripped) {
        toast({ title: "Image Size Notice", description: `The main card background image for template "${template.name}" was too large for persistent storage and was not saved. It will remain in the editor for this session only unless re-selected or a URL is used.`, variant: "default", duration: 8000 });
    }
    if (sectionBgStrippedCount > 0) {
        toast({ title: "Image Size Notice", description: `${sectionBgStrippedCount} section background image(s) in template "${template.name}" were too large for persistent storage and were not saved. They will remain in the editor for this session only unless re-selected or a URL is used.`, variant: "default", duration: 8000 });
    }


    setTemplates(prevTemplates => {
      const existingIndex = prevTemplates.findIndex(t => t.id === templateForStorage.id);
      const newTemplates = existingIndex > -1 
        ? prevTemplates.map((t, i) => i === existingIndex ? templateForStorage : t) 
        : [...prevTemplates, templateForStorage];
      return newTemplates;
    });
    toast({ title: "Template Saved", description: `"${templateForStorage.name || templateForStorage.id}" has been saved.` });
    
    // Update editingTemplate to reflect the version that might have stripped images (for consistency if re-selected)
    // but ensure the editor itself keeps the live, potentially large image for the current session.
    // The editor's currentTemplate state is separate and should retain the user's latest input.
    // So, we only update 'editingTemplate' if it's the one being saved.
    if (!editingTemplate || editingTemplate.id === template.id || !templates.find(t => t.id === template.id)) {
        // If we want the 'editingTemplate' state to reflect the stripped version for future edits,
        // we'd set it to templateForStorage. But usually, the editor keeps the live version.
        // For now, let's assume the editor's internal state is the source of truth for the current session.
        // The main `templates` list will have the stripped version for persistence.
        // Let's ensure setEditingTemplate is called with the *original* template from editor to keep live image
        const originalTemplateFromEditor = template; 
        setEditingTemplate(originalTemplateFromEditor);
    }

  }, [setTemplates, toast, templates, editingTemplate]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    if (editingTemplate?.id === templateId) setEditingTemplate(null);
    if (singleCardGeneratorSelectedTemplateId === templateId) setSingleCardGeneratorSelectedTemplateId(null);
    toast({ title: "Template Deleted", description: `"${templateToDelete?.name || templateId}" has been removed.` });
  }, [editingTemplate, singleCardGeneratorSelectedTemplateId, toast, templates, setTemplates]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    setGeneratedDisplayCards(prev => [...prev, ...cards]); 
    setCardViewSides(prevSides => {
        const newSides = {...prevSides};
        cards.forEach(c => { newSides[c.uniqueId] = 'front'; });
        return newSides;
    });
    if (cards.length > 0) toast({ title: "Bulk Generation Complete", description: `${cards.length} cards added.` });
  }, [toast]);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    setGeneratedDisplayCards(prev => [...prev, card]);
    setCardViewSides(prevSides => ({...prevSides, [card.uniqueId]: 'front'}));
  }, []);

  const handleClearGeneratedCards = useCallback(() => {
    setGeneratedDisplayCards([]);
    setCardViewSides({});
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
    setCardViewSides(prevSides => ({...prevSides, [newCard.uniqueId]: 'front'}));
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


  const isValidStoredDisplayCard = (item: any): item is Partial<StoredDisplayCard> => {
    return item &&
           typeof item.frontTemplateId === 'string' && item.frontTemplateId.trim() !== "" &&
           typeof item.frontData === 'object' && item.frontData !== null &&
           typeof item.uniqueId === 'string' && item.uniqueId.trim() !== "" &&
           (item.backTemplateId === undefined || item.backTemplateId === null || (typeof item.backTemplateId === 'string')) && 
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
            const newCardViewSides: Record<string, 'front' | 'back'> = {};
            let missingFrontCount = 0;
            let missingBackCount = 0;

            loadedItems.forEach(storedCard => {
              const frontTemplateIdToLoad = storedCard.frontTemplateId;
              if (!frontTemplateIdToLoad || frontTemplateIdToLoad.trim() === "") {
                  missingFrontCount++;
                  return;
              }
              const frontTemplateFound = templates.find(t => t.id === frontTemplateIdToLoad);
              if (!frontTemplateFound) {
                missingFrontCount++;
                return; 
              }
              const reconstructedFrontTemplate = reconstructMinimalTemplate(frontTemplateFound);
              if (!reconstructedFrontTemplate) { 
                missingFrontCount++;
                return;
              }

              let backTemplate: TCGCardTemplate | null = null;
              if (storedCard.backTemplateId && storedCard.backTemplateId.trim() !== "") {
                const foundBack = templates.find(t => t.id === storedCard.backTemplateId);
                if (foundBack) {
                  backTemplate = reconstructMinimalTemplate(foundBack);
                }
                if (!backTemplate && foundBack) { 
                    missingBackCount++;
                } else if (!foundBack) { 
                    missingBackCount++;
                }
              }
              
              const cardUniqueId = storedCard.uniqueId || nanoid();
              runtimeCards.push({ 
                uniqueId: cardUniqueId, 
                frontTemplate: reconstructedFrontTemplate,
                frontData: storedCard.frontData || {},
                backTemplate: backTemplate,
                backData: (backTemplate && storedCard.backData) ? storedCard.backData : null,
              });
              newCardViewSides[cardUniqueId] = 'front';
            });
            
            setGeneratedDisplayCards(runtimeCards);
            setCardViewSides(newCardViewSides);
            
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
  }, [templates, toast, reconstructMinimalTemplate]);

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

  const handleToggleCardSide = useCallback((uniqueId: string) => {
    setCardViewSides(prev => ({
      ...prev,
      [uniqueId]: prev[uniqueId] === 'back' ? 'front' : 'back',
    }));
  }, []);


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
                            forceRenderSide={cardViewSides[cardItem.uniqueId] || 'front'}
                            onToggleSide={handleToggleCardSide}
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
