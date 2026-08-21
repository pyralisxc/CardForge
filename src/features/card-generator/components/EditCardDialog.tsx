"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { CardData } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { TemplateFieldDefinition } from '@/domain/templates';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollableDialogBody, ScrollableDialogContent } from '@/components/ui/scrollable-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Save, Layers } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useProjectStore } from '@/features/project/client';
import { GeneratorFieldGroups } from '@/features/card-generator/components/GeneratorFieldGroups';
import {
  completeCardDataWithTemplateDefaults,
  getMissingRequiredFieldLabels,
  initializeCardDataFromTemplate,
} from '@/features/card-generator/lib/cardDataDefaults';
import { getBrowserStorageHealth, optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client';
import type { DisplayCard } from '@/domain/rendering';

interface EditCardDialogProps {
  isOpen: boolean;
  card: DisplayCard | null;
  onSave: (updatedCard: DisplayCard) => void;
  onDuplicate: (cardToDuplicate: DisplayCard) => void;
  onClose: () => void;
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose }: EditCardDialogProps) {
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<TemplateFieldDefinition[]>([]);
  const [editedBackingData, setEditedBackingData] = useState<CardData>({});
  const [backingFields, setBackingFields] = useState<TemplateFieldDefinition[]>([]);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const backingFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useProjectStore((state) => state.setRichTextHighlightColor);

  const generateFieldsAndData = useCallback((template: TCGCardTemplate | undefined | null, existingData: CardData | null | undefined): [TemplateFieldDefinition[], CardData] => {
    return initializeCardDataFromTemplate(template, existingData);
  }, []);

  useEffect(() => {
    if (card) {
      const [fields, data] = generateFieldsAndData(card.template, card.data);
      const [nextBackingFields, nextBackingData] = generateFieldsAndData(card.backingTemplate, card.backingData);
      setDynamicFields(fields);
      setEditedData(data);
      setBackingFields(nextBackingFields);
      setEditedBackingData(nextBackingData);
    } else {
      setEditedData({});
      setDynamicFields([]);
      setEditedBackingData({});
      setBackingFields([]);
    }
  }, [card, generateFieldsAndData]);

  const handleImageUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>,
    fieldKey: string,
    face: 'front' | 'back',
  ) => {
    const file = event.target.files?.[0];
    const fileRefsLocal = face === 'back' ? backingFileInputRefs : fileInputRefs;
    if (fileRefsLocal.current[fieldKey]) fileRefsLocal.current[fieldKey]!.value = '';

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
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        const setFaceData = face === 'back' ? setEditedBackingData : setEditedData;
        setFaceData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded for the ${face} ${fieldKey} field.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file.", variant: "destructive" });
      };
      reader.readAsDataURL(storedFile);
    }
  }, [toast]);

  const validateRequiredFields = useCallback((): boolean => {
    const missingFields = [
      ...getMissingRequiredFieldLabels(dynamicFields, editedData).map((label) => `Front: ${label}`),
      ...(card?.backingTemplate
        ? getMissingRequiredFieldLabels(backingFields, editedBackingData).map((label) => `Back: ${label}`)
        : []),
    ];
    if (missingFields.length === 0) return true;
    toast({
      title: 'Required fields are missing',
      description: `Fill in ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ', ...' : ''} before saving.`,
      variant: 'destructive',
    });
    return false;
  }, [backingFields, card?.backingTemplate, dynamicFields, editedBackingData, editedData, toast]);

  const getEditedCard = useCallback((): DisplayCard | null => {
    if (!card) return null;
    const finalData = completeCardDataWithTemplateDefaults(dynamicFields, editedData);
    const finalBackingData = card.backingTemplate
      ? completeCardDataWithTemplateDefaults(backingFields, editedBackingData)
      : undefined;
    return { ...card, data: finalData, backingData: finalBackingData };
  }, [backingFields, card, dynamicFields, editedBackingData, editedData]);

  const handleSaveChanges = useCallback(() => {
    if (validateRequiredFields()) {
      const updatedCard = getEditedCard();
      if (!updatedCard) return;
      onSave(updatedCard);
    }
  }, [getEditedCard, onSave, validateRequiredFields]);

  const handleDuplicateThisCard = useCallback(() => {
    if (validateRequiredFields()) {
      const updatedCard = getEditedCard();
      if (!updatedCard) return;
      onDuplicate(updatedCard);
      onClose();
    }
  }, [getEditedCard, onClose, onDuplicate, validateRequiredFields]);

  if (!card) return null;

  const cardIdentifier = String(editedData[dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImage)?.key || ''] || editedData[dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImage)?.key || ''] || `Card ${card.uniqueId.substring(0,5)}`);

  const renderFields = (
    fields: TemplateFieldDefinition[],
    data: CardData,
    fileRefsLocal: React.MutableRefObject<Record<string, HTMLInputElement | null>>,
    onFieldChange: (fieldKey: string, value: string) => void,
    face: 'front' | 'back',
    emptyMessage: string,
  ) => (
    <GeneratorFieldGroups
      fields={fields}
      data={data}
      onFieldChange={onFieldChange}
      highlightColor={richTextHighlightColor}
      onHighlightColorChange={setRichTextHighlightColorAction}
      fileInputRefs={fileRefsLocal}
      onImageUpload={(event, fieldKey) => handleImageUpload(event, fieldKey, face)}
      emptyMessage={emptyMessage}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => !openState && onClose()}>
      <ScrollableDialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit: {cardIdentifier}</DialogTitle>
          <DialogDescription>
            Front: {card.template.name || card.template.id?.substring(0,8)}
            {card.backingTemplate ? ` · Back: ${card.backingTemplate.name || card.backingTemplate.id?.substring(0, 8)}` : ' · No back selected'}
          </DialogDescription>
        </DialogHeader>
        <ScrollableDialogBody className="-mr-6 mb-4 pr-6">
          <Accordion type="multiple" defaultValue={['edit-front-data', 'edit-back-data']} className="w-full">
            <AccordionItem value="edit-front-data">
              <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Front Details</AccordionTrigger>
              <AccordionContent className="space-y-1 pt-3">
                {renderFields(
                  dynamicFields,
                  editedData,
                  fileInputRefs,
                  (fieldKey, value) => setEditedData(prev => ({ ...prev, [fieldKey]: value })),
                  'front',
                  'This front design has no editable fields.',
                )}
              </AccordionContent>
            </AccordionItem>
            {card.backingTemplate ? (
              <AccordionItem value="edit-back-data">
                <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Back Details</AccordionTrigger>
                <AccordionContent className="space-y-1 pt-3">
                  {renderFields(
                    backingFields,
                    editedBackingData,
                    backingFileInputRefs,
                    (fieldKey, value) => setEditedBackingData(prev => ({ ...prev, [fieldKey]: value })),
                    'back',
                    'This back is a fixed design with no per-card fields. It will still appear in previews and exports.',
                  )}
                </AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        </ScrollableDialogBody>

        <DialogFooter className="mt-4 shrink-0 border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="secondary" onClick={handleDuplicateThisCard}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate & Close
          </Button>
          <Button type="button" onClick={handleSaveChanges}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
