"use client";

import type { CardSet, CardData } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { TemplateFieldDefinition } from '@/features/template-editor/lib/templateFields';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2, Layers } from 'lucide-react';
import { GeneratorFieldGroups } from '@/features/card-generator/components/GeneratorFieldGroups';
import { useProjectStore } from '@/features/project/client';
import { withNextStep } from '@/shared/userFacingErrors';
import { ERROR_COPY } from '@/lib/errorCopy';
import { completeCardDataWithTemplateDefaults, initializeCardDataFromTemplate } from '@/features/card-generator/lib/cardDataDefaults';
import { getTemplateSourceLabel } from '@/lib/templateDisplay';
import { buildStructuredRowsDataKey, parseStructuredRowsValue } from '@/domain/rendering';
import { getBrowserStorageHealth, optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client';
import type { DisplayCard } from '@/domain/rendering';

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  backingTemplate?: TCGCardTemplate | null;
  activeCardSet: CardSet;
  onSingleCardAdded: (card: DisplayCard) => void;
  selectedTemplateIdProp: string | null;
}

export function SingleCardGenerator({
  templates,
  backingTemplate,
  activeCardSet,
  onSingleCardAdded,
  selectedTemplateIdProp,
}: SingleCardGeneratorProps) {
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<TemplateFieldDefinition[]>([]);
  const [hasAddedCardInSession, setHasAddedCardInSession] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addCardCooldownRef = useRef<number | null>(null);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useProjectStore((state) => state.setRichTextHighlightColor);

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateIdProp);
  }, [templates, selectedTemplateIdProp]);

  useEffect(() => {
    const [newFields, newGeneratedData] = initializeCardDataFromTemplate(selectedTemplate);
    
    setDynamicFields(newFields);
    setCardData(newGeneratedData);
  }, [selectedTemplate]);

  useEffect(() => {
    return () => {
      if (addCardCooldownRef.current !== null) {
        window.clearTimeout(addCardCooldownRef.current);
      }
    };
  }, []);

  const handleImageUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = event.target.files?.[0];
    const refs = fileInputRefs;
    if (refs.current[fieldKey]) refs.current[fieldKey]!.value = '';

    if (file) {
      const validation = validateLocalAssetFile(file);
      if (!validation.ok) {
        toast({ title: 'Image Not Added', description: validation.message, variant: 'destructive' });
        return;
      }
      let storedFile: File;
      try {
        storedFile = await optimizeLocalAssetFile(file);
        const storageHealth = await getBrowserStorageHealth();
        if (storageHealth.level === 'critical' || (storageHealth.remainingBytes !== null && storageHealth.remainingBytes < storedFile.size * 1.5)) {
          toast({ title: 'Browser Storage Almost Full', description: 'Download a project backup and free storage before adding more card artwork.', variant: 'destructive' });
          return;
        }
      } catch (error) {
        toast({ title: 'Image Not Added', description: error instanceof Error ? error.message : 'Unable to validate the image.', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (eRead) => {
        const dataUri = eRead.target?.result as string;
        setCardData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded as Data URI for ${fieldKey}.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: `Failed to read image file.`, variant: "destructive" });
      };
      reader.readAsDataURL(storedFile);
    }
  }, [toast]);

  const handleAddCard = useCallback(() => {
    if (isAddingCard) {
      return;
    }

    if (!selectedTemplate) {
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('A front template is required before adding a card.', 'Choose a front template in Deck Setup and try again.'),
        variant: "destructive",
      });
      return;
    }

    const missingRequiredFields = dynamicFields
      .filter((field) => field.required)
      .filter((field) => {
        if (field.contentModel !== 'structuredRows' || !field.sourceElementId) {
          return String(cardData[field.key] ?? '').trim().length === 0;
        }
        const rows = parseStructuredRowsValue(cardData[buildStructuredRowsDataKey(field.sourceElementId)]);
        return rows.length === 0 || rows.every((row) => String(row[field.key] ?? '').trim().length === 0);
      })
      .map((field) => field.label || field.key);

    if (missingRequiredFields.length > 0) {
      toast({
        title: ERROR_COPY.requiredFieldsMissing.title,
        description: withNextStep(
          `Missing: ${missingRequiredFields.slice(0, 3).join(', ')}${missingRequiredFields.length > 3 ? ', ...' : ''}.`,
          'Fill in required fields, then create the generated output again.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCard(true);

    const finalCardData = completeCardDataWithTemplateDefaults(dynamicFields, cardData);

    const displayCard: DisplayCard = {
      template: selectedTemplate,
      backingTemplate,
      backingTemplateId: backingTemplate?.id ?? null,
      setId: activeCardSet.id,
      setName: activeCardSet.name,
      data: finalCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);
    setHasAddedCardInSession(true);

    toast({ title: "Output generated", description: 'Your output is now in the generated outputs gallery. Next step: review, edit, export, or add another output.' });
    
    const [, resetData] = initializeCardDataFromTemplate(selectedTemplate);
    setCardData(resetData);

    if (addCardCooldownRef.current !== null) {
      window.clearTimeout(addCardCooldownRef.current);
    }
    addCardCooldownRef.current = window.setTimeout(() => {
      setIsAddingCard(false);
      addCardCooldownRef.current = null;
    }, 300);

  }, [activeCardSet.id, activeCardSet.name, backingTemplate, selectedTemplate, cardData, dynamicFields, isAddingCard, onSingleCardAdded, toast]);

  const renderFields = (
    fields: TemplateFieldDefinition[],
    data: CardData,
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0 && selectedTemplateIdProp) {
      return <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields.</p>;
    }
    if (!selectedTemplateIdProp) {
        return <p className="text-sm text-muted-foreground">Choose a front template in Deck Setup to see its fields.</p>;
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

  const richTextFieldCount = dynamicFields.filter((field) => field.supportsRichText && field.contentModel === 'text' && !field.isStaticBaseText).length;
  const structuredRowGroups = new Set(
    dynamicFields
      .filter((field) => field.contentModel === 'structuredRows' && field.sourceElementId)
      .map((field) => field.sourceElementId)
  );
  const structuredRowColumnCount = dynamicFields.filter((field) => field.contentModel === 'structuredRows').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Output Entry</CardTitle>
        <CardDescription>Fill one output against the same field contract that drives bulk generation and export.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedTemplateIdProp && !hasAddedCardInSession && (
          <div className="rounded-md border p-3 text-xs bg-muted/20" role="status" aria-live="polite">
            <p className="font-medium">Quick Start: Generate a reference output</p>
            {selectedTemplate ? (
              <p className="mt-1 text-muted-foreground">
                Using {selectedTemplate.name || selectedTemplate.id} ({getTemplateSourceLabel(selectedTemplate)}).
              </p>
            ) : null}
            <p className="mt-1 text-muted-foreground">
              Fill required fields, use rich-text tools when available, then create the output. Visual review happens in Generated Outputs so preview, edit, and export all share one source of truth.
            </p>
            {richTextFieldCount > 0 && (
              <p className="mt-2 font-medium text-primary">
                {richTextFieldCount} rich text {richTextFieldCount === 1 ? 'field' : 'fields'} available in this template.
              </p>
            )}
            {structuredRowGroups.size > 0 && (
              <p className="mt-2 font-medium text-primary">
                {structuredRowGroups.size} structured row {structuredRowGroups.size === 1 ? 'group' : 'groups'} with {structuredRowColumnCount} editable {structuredRowColumnCount === 1 ? 'column' : 'columns'}.
              </p>
            )}
          </div>
        )}

        {selectedTemplateIdProp && (
          <Accordion type="single" collapsible defaultValue="card-data-item" className="w-full">
            <AccordionItem value="card-data-item">
              <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Output Data
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3 border-t">
                {renderFields(dynamicFields, cardData, fileInputRefs)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

         {!selectedTemplateIdProp && templates.length > 0 && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">Select a template above to start entering data.</p>
        )}
         {templates.length === 0 && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">No Layout Studio templates available. Please create one in Layout Studio first.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplateIdProp || isAddingCard} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> {isAddingCard ? 'Generating Output...' : 'Create Generated Output'}
        </Button>
      </CardContent>
    </Card>
  );
}
