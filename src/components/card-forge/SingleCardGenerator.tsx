
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
import { cn } from '@/lib/utils';
import { extractTemplateFieldDefinitions, type TemplateFieldDefinition } from '@/lib/templateFields';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2, Layers } from 'lucide-react';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { GeneratorFieldGroups } from '@/components/card-forge/GeneratorFieldGroups';
import { useAppStore } from '@/store/appStore';
import { withNextStep } from '@/lib/userFacingErrors';
import { ERROR_COPY } from '@/lib/errorCopy';
import { completeCardDataWithTemplateDefaults, initializeCardDataFromTemplate } from '@/lib/cardDataDefaults';

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange: (templateId: string | null) => void; // Calls Zustand action
  selectedTemplateIdProp: string | null; // From Zustand store
}

export function SingleCardGenerator({
  templates,
  onSingleCardAdded,
  onTemplateSelectionChange,
  selectedTemplateIdProp,
}: SingleCardGeneratorProps) {
  // Local state for the form fields and data for the single card being generated.
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<TemplateFieldDefinition[]>([]);
  const [hasAddedCardInSession, setHasAddedCardInSession] = useState(false);
  
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useAppStore((state) => state.setRichTextHighlightColor);

  // selectedTemplate is derived from selectedTemplateIdProp (from Zustand) and templates prop.
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateIdProp);
  }, [templates, selectedTemplateIdProp]);


  // Safe useEffect: Reacts to selectedTemplateIdProp (from Zustand via prop) or templates list changes
  // to regenerate dynamic fields and reset local cardData (form state) with defaults from the new template.
  useEffect(() => {
    // The selectedTemplate is now derived via useMemo based on selectedTemplateIdProp
    // Regenerate fields and reset cardData with defaults from the new template.
    // Passing {} as currentData ensures fresh defaults are applied.
    const [newFields, newGeneratedData] = initializeCardDataFromTemplate(selectedTemplate);
    
    setDynamicFields(newFields);
    setCardData(newGeneratedData); // This resets the form to the new template's structure/defaults.
  }, [selectedTemplate]); // Depend on the derived selectedTemplate

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = event.target.files?.[0];
    const refs = fileInputRefs; 

    if (file) {
      const reader = new FileReader();
      reader.onload = (eRead) => {
        const dataUri = eRead.target?.result as string;
        setCardData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded as Data URI for ${fieldKey}.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: `Failed to read image file.`, variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (refs.current[fieldKey]) {
      refs.current[fieldKey]!.value = "";
    }
  }, [toast]);

  const handleAddCard = useCallback(() => {
    if (!selectedTemplate) { // Use the memoized selectedTemplate
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('A template is required before adding a card.', 'Choose a template in the Select Template field and try again.'),
        variant: "destructive",
      });
      return;
    }

    const missingRequiredFields = dynamicFields
      .filter((field) => field.required)
      .filter((field) => String(cardData[field.key] ?? '').trim().length === 0)
      .map((field) => field.label || field.key);

    if (missingRequiredFields.length > 0) {
      toast({
        title: ERROR_COPY.requiredFieldsMissing.title,
        description: withNextStep(
          `Missing: ${missingRequiredFields.slice(0, 3).join(', ')}${missingRequiredFields.length > 3 ? ', ...' : ''}.`,
          'Fill in required fields, then click Add Card to Preview List again.'
        ),
        variant: 'destructive',
      });
      return;
    }

    const finalCardData = completeCardDataWithTemplateDefaults(dynamicFields, cardData);

    const displayCard: DisplayCard = {
      template: selectedTemplate, // Use the memoized selectedTemplate
      data: finalCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);
    setHasAddedCardInSession(true);

    toast({ title: "Card added", description: 'Your card is now in the preview list. Next step: export or add another card.' });
    
    // Reset form fields to defaults for the currently selected template after adding a card
    const [, resetData] = initializeCardDataFromTemplate(selectedTemplate); // Use memoized selectedTemplate
    setCardData(resetData);

  }, [selectedTemplate, cardData, dynamicFields, onSingleCardAdded, toast]); // Use memoized selectedTemplate

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    onTemplateSelectionChange(id); // Calls Zustand action via prop
    setHasAddedCardInSession(false);
    // cardData will be reset by the useEffect hook reacting to selectedTemplate change
  }, [onTemplateSelectionChange]);

  const renderFields = (
    fields: TemplateFieldDefinition[],
    data: CardData,
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0 && selectedTemplateIdProp) {
      return <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields.</p>;
    }
    if (!selectedTemplateIdProp) {
        return <p className="text-sm text-muted-foreground">Select a template to see its fields.</p>;
    }
    return (
      <GeneratorFieldGroups
        fields={fields}
        data={data}
        onFieldChange={(fieldKey, value) => setCardData(prev => ({ ...prev, [fieldKey]: value }))}
        highlightColor={richTextHighlightColor}
        onHighlightColorChange={setRichTextHighlightColorAction}
        fileInputRefs={fileRefs}
        onImageUpload={handleImageUpload}
        emptyMessage="This template has no recognized placeholder fields."
      />
    );
  };

  // Build a live DisplayCard for the mini-preview
  const liveDisplayCard = useMemo<DisplayCard | null>(() => {
    if (!selectedTemplate) return null;
    return { template: selectedTemplate, data: cardData, uniqueId: 'live-preview' };
  }, [selectedTemplate, cardData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Fill one card against the same field contract that drives bulk generation and export.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template*</Label>
          <Select
            value={selectedTemplateIdProp ?? undefined}
            onValueChange={handleTemplateSelectChange}
            disabled={templates.length === 0}
          >
            <SelectTrigger id="singleTemplateSelect" aria-describedby="single-template-help">
              <SelectValue placeholder="Choose template (Required)" />
            </SelectTrigger>
            <SelectContent>
              {templates.length > 0 ? (
                templates.map(t => <SelectItem key={`single-${t.id || 'new-template-option'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5) || 'Untitled'}`}</SelectItem>)
              ) : (
                <SelectItem value="no-templates-single" disabled>No templates available.</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p id="single-template-help" className="text-xs text-muted-foreground mt-1">
            Choose a template before entering card data.
          </p>
        </div>

        {/* Live mini-preview */}
        {liveDisplayCard && (
          <div className="flex justify-center py-1">
            <div className="rounded-md overflow-hidden shadow-md" style={{ width: 160 }}>
              <CardPreview card={liveDisplayCard} targetWidthPx={160} />
            </div>
          </div>
        )}

        {selectedTemplateIdProp && !hasAddedCardInSession && (
          <div className="rounded-md border p-3 text-xs bg-muted/20" role="status" aria-live="polite">
            <p className="font-medium">Quick Start: First Card</p>
            <p className="mt-1 text-muted-foreground">1. Fill required fields first. 2. Use the mini preview to confirm layout. 3. Click Add Card to Preview List.</p>
          </div>
        )}

        {selectedTemplateIdProp && (
          <Accordion type="single" collapsible defaultValue="card-data-item" className="w-full">
            <AccordionItem value="card-data-item">
              <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Card Data
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3 border-t">
                {renderFields(dynamicFields, cardData, fileInputRefs)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

         {!selectedTemplateIdProp && templates.length > 0 && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">Select a template above to start entering card data.</p>
        )}
         {templates.length === 0 && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">No Maker 2.0 templates available. Please create one in "Card Template Maker 2.0" first.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplateIdProp} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
