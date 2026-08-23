"use client";

import type { CardSet, CardData } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { TemplateFieldDefinition } from '@/domain/templates';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/components/ui/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2, Layers } from 'lucide-react';
import { GeneratorFieldGroups } from '@/features/card-generator/components/GeneratorFieldGroups';
import { useProjectStore } from '@/features/project/client';
import { withNextStep } from '@/shared/userFacingErrors';
import { ERROR_COPY } from '@/features/card-generator/lib/errorCopy';
import {
  completeCardDataWithTemplateDefaults,
  getMissingRequiredFieldLabels,
  initializeCardDataFromTemplate,
} from '@/features/card-generator/lib/cardDataDefaults';
import { getTemplateSourceLabel } from '@/domain/templates';
import { optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client';
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
  const [backingData, setBackingData] = useState<CardData>({});
  const [backingFields, setBackingFields] = useState<TemplateFieldDefinition[]>([]);
  const [hasAddedCardInSession, setHasAddedCardInSession] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const backingFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
    const [newFields, newGeneratedData] = initializeCardDataFromTemplate(backingTemplate);
    setBackingFields(newFields);
    setBackingData(newGeneratedData);
  }, [backingTemplate]);

  useEffect(() => {
    return () => {
      if (addCardCooldownRef.current !== null) {
        window.clearTimeout(addCardCooldownRef.current);
      }
    };
  }, []);

  const handleImageUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>,
    fieldKey: string,
    face: 'front' | 'back',
  ) => {
    const file = event.target.files?.[0];
    const refs = face === 'back' ? backingFileInputRefs : fileInputRefs;
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
      } catch (error) {
        toast({ title: 'Image Not Added', description: error instanceof Error ? error.message : 'Unable to validate the image.', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (eRead) => {
        const dataUri = eRead.target?.result as string;
        const setFaceData = face === 'back' ? setBackingData : setCardData;
        setFaceData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded for the ${face} ${fieldKey} field.` });
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
        description: withNextStep('Choose a Template before adding a card.', 'Choose a Template above, then try again.'),
        variant: "destructive",
      });
      return;
    }

    const missingRequiredFields = [
      ...getMissingRequiredFieldLabels(dynamicFields, cardData).map((label) => `Front: ${label}`),
      ...(backingTemplate
        ? getMissingRequiredFieldLabels(backingFields, backingData).map((label) => `Back: ${label}`)
        : []),
    ];

    if (missingRequiredFields.length > 0) {
      toast({
        title: ERROR_COPY.requiredFieldsMissing.title,
        description: withNextStep(
          `Missing: ${missingRequiredFields.slice(0, 3).join(', ')}${missingRequiredFields.length > 3 ? ', ...' : ''}.`,
          'Fill in the required card details, then add the card to your set.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCard(true);

    const finalCardData = completeCardDataWithTemplateDefaults(dynamicFields, cardData);
    const finalBackingData = backingTemplate
      ? completeCardDataWithTemplateDefaults(backingFields, backingData)
      : undefined;

    const displayCard: DisplayCard = {
      template: selectedTemplate,
      backingTemplate,
      backingTemplateId: backingTemplate?.id ?? null,
      backingData: finalBackingData,
      setId: activeCardSet.id,
      setName: activeCardSet.name,
      data: finalCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);
    setHasAddedCardInSession(true);

    toast({ title: 'Card added', description: 'Your card is now in this set. Review, edit, download, or add another card.' });
    
    const [, resetData] = initializeCardDataFromTemplate(selectedTemplate);
    setCardData(resetData);
    const [, resetBackingData] = initializeCardDataFromTemplate(backingTemplate);
    setBackingData(resetBackingData);

    if (addCardCooldownRef.current !== null) {
      window.clearTimeout(addCardCooldownRef.current);
    }
    addCardCooldownRef.current = window.setTimeout(() => {
      setIsAddingCard(false);
      addCardCooldownRef.current = null;
    }, 300);

  }, [activeCardSet.id, activeCardSet.name, backingData, backingFields, backingTemplate, selectedTemplate, cardData, dynamicFields, isAddingCard, onSingleCardAdded, toast]);

  const renderFields = (
    fields: TemplateFieldDefinition[],
    data: CardData,
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>,
    onFieldChange: (fieldKey: string, value: string) => void,
    face: 'front' | 'back',
    emptyMessage: string,
  ) => {
    return (
      <GeneratorFieldGroups
        fields={fields}
        data={data}
        onFieldChange={onFieldChange}
        highlightColor={richTextHighlightColor}
        onHighlightColorChange={setRichTextHighlightColorAction}
        fileInputRefs={fileRefs}
        onImageUpload={(event, fieldKey) => handleImageUpload(event, fieldKey, face)}
        emptyMessage={emptyMessage}
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
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Make One Card</CardTitle>
        <CardDescription>Customize the front and back of one card. You can change either face later.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {selectedTemplateIdProp && !hasAddedCardInSession && (
          <div className="rounded-md border p-3 text-xs bg-muted/20" role="status" aria-live="polite">
            <p className="font-medium">Your first card is ready</p>
            {selectedTemplate ? (
              <p className="mt-1 text-muted-foreground">
                Using {selectedTemplate.name || selectedTemplate.id} ({getTemplateSourceLabel(selectedTemplate)}).
              </p>
            ) : null}
            <p className="mt-1 text-muted-foreground">
              Start with the example and replace it with your own details. Then add the card to your set and review it here before downloading.
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
          <Accordion type="multiple" defaultValue={['front-card-data']} className="w-full">
            <AccordionItem value="front-card-data">
              <AccordionTrigger className="text-base">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Front details
                  <span className="text-xs font-normal text-muted-foreground">{dynamicFields.length} editable</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3 border-t">
                {renderFields(
                  dynamicFields,
                  cardData,
                  fileInputRefs,
                  (fieldKey, value) => setCardData(prev => ({ ...prev, [fieldKey]: value })),
                  'front',
                  'This front design has no editable fields yet.',
                )}
              </AccordionContent>
            </AccordionItem>
            {backingTemplate ? (
              <AccordionItem value="back-card-data">
                <AccordionTrigger className="text-base">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Back details
                    <span className="text-xs font-normal text-muted-foreground">{backingFields.length} editable</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Using {backingTemplate.name || backingTemplate.id}. These values belong only to this card back.
                  </p>
                  {renderFields(
                    backingFields,
                    backingData,
                    backingFileInputRefs,
                    (fieldKey, value) => setBackingData(prev => ({ ...prev, [fieldKey]: value })),
                    'back',
                    'This back is a fixed design with no per-card fields. It will still appear in previews and exports.',
                  )}
                </AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        )}

         {!selectedTemplateIdProp && templates.length > 0 && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">Choose a Template above to start entering details.</p>
        )}
         {templates.length === 0 && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">No front Templates are available yet. Open Templates to create one first.</p>
        )}

        <Button
          onClick={handleAddCard}
          disabled={!selectedTemplateIdProp || isAddingCard}
          className="w-full"
          data-testid="create-generated-output"
        >
          <PlusSquare className="mr-2 h-4 w-4" /> {isAddingCard ? 'Adding card…' : 'Add Card to Set'}
        </Button>
      </CardContent>
    </Card>
  );
}
