
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DisplayCard, CardData, ExtractedPlaceholder, TCGCardTemplate } from '@/types';
import { extractUniquePlaceholderKeys, toTitleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Save, Eye, Upload, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface EditCardDialogProps {
  isOpen: boolean;
  card: DisplayCard | null;
  onSave: (updatedCard: DisplayCard) => void;
  onDuplicate: (cardToDuplicate: DisplayCard) => void;
  onClose: () => void;
}

interface DynamicField {
  key: string;
  label: string; 
  type: 'input' | 'textarea';
  isImageKey: boolean;
  defaultValue?: string;
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose }: EditCardDialogProps) {
  const [editedFrontData, setEditedFrontData] = useState<CardData>({});
  const [editedBackData, setEditedBackData] = useState<CardData | null>(null);
  const [frontDynamicFields, setFrontDynamicFields] = useState<DynamicField[]>([]);
  const [backDynamicFields, setBackDynamicFields] = useState<DynamicField[]>([]);
  
  const frontFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const backFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  const generateFieldsAndData = (template: TCGCardTemplate | undefined | null, existingData: CardData | null | undefined): [DynamicField[], CardData] => {
    if (!template) return [[], {}];
    const allPlaceholderKeys = extractUniquePlaceholderKeys(template);
    const currentCardData = { ...(existingData || {}) };
    const newEditedDataState: CardData = {};

    const fields: DynamicField[] = allPlaceholderKeys.map(placeholder => {
        const isImageSectionKey = template.rows.some(row =>
          row.columns.some(col =>
              col.sectionContentType === 'image' && col.contentPlaceholder === placeholder.key
          )
        );
        const isTextarea = !isImageSectionKey && (
          placeholder.key.toLowerCase().includes('rules') ||
          placeholder.key.toLowerCase().includes('text') ||
          placeholder.key.toLowerCase().includes('effect') ||
          placeholder.key.toLowerCase().includes('abilit') ||
          placeholder.key.toLowerCase().includes('description')
        );

        if (currentCardData[placeholder.key] !== undefined) {
          newEditedDataState[placeholder.key] = currentCardData[placeholder.key];
        } else if (placeholder.defaultValue !== undefined) {
          newEditedDataState[placeholder.key] = placeholder.defaultValue;
        } else if (isImageSectionKey) {
           newEditedDataState[placeholder.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(placeholder.key))}`;
        }
        else {
          newEditedDataState[placeholder.key] = '';
        }

        return {
          key: placeholder.key,
          label: `{{${placeholder.key}}}`,
          type: isTextarea ? 'textarea' : 'input',
          isImageKey: isImageSectionKey,
          defaultValue: placeholder.defaultValue,
        };
    });
    return [fields, newEditedDataState];
  };


  useEffect(() => {
    if (card) {
      const [frontFields, frontData] = generateFieldsAndData(card.frontTemplate, card.frontData);
      setFrontDynamicFields(frontFields);
      setEditedFrontData(frontData);

      if (card.backTemplate) {
        const [backFields, backDataResult] = generateFieldsAndData(card.backTemplate, card.backData);
        setBackDynamicFields(backFields);
        setEditedBackData(backDataResult);
      } else {
        setBackDynamicFields([]);
        setEditedBackData(null);
      }
    } else {
      setEditedFrontData({});
      setEditedBackData(null);
      setFrontDynamicFields([]);
      setBackDynamicFields([]);
    }
  }, [card]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string, side: 'front' | 'back') => {
    const setter = side === 'front' ? setEditedFrontData : setEditedBackData;
    setter(prev => ({ ...(prev as CardData), [fieldKey]: e.target.value }));
  }, []);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>, fieldKey: string, side: 'front' | 'back') => {
    const file = event.target.files?.[0];
    const setter = side === 'front' ? setEditedFrontData : setEditedBackData;
    const fileRefs = side === 'front' ? frontFileInputRefs : backFileInputRefs;

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setter(prev => ({ ...(prev as CardData), [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded for ${fieldKey} (${side}).` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (fileRefs.current[fieldKey]) { 
      fileRefs.current[fieldKey]!.value = ""; 
    }
  }, [toast]);

  const handleSaveChanges = useCallback(() => {
    if (card) {
      const finalFrontData = { ...editedFrontData };
      frontDynamicFields.forEach(field => {
        if (finalFrontData[field.key] === undefined) {
          finalFrontData[field.key] = field.defaultValue !== undefined ? field.defaultValue : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
        }
      });

      let finalBackData: CardData | null = null;
      if (card.backTemplate && editedBackData) {
        finalBackData = { ...editedBackData };
        backDynamicFields.forEach(field => {
           if (finalBackData![field.key] === undefined) {
            finalBackData![field.key] = field.defaultValue !== undefined ? field.defaultValue : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
          }
        });
      }
      onSave({ ...card, frontData: finalFrontData, backData: finalBackData });
    }
  }, [card, editedFrontData, editedBackData, frontDynamicFields, backDynamicFields, onSave]);

  const handleDuplicateThisCard = useCallback(() => {
    if (card) {
       const finalFrontData = { ...editedFrontData };
       frontDynamicFields.forEach(field => {
        if (finalFrontData[field.key] === undefined) {
          finalFrontData[field.key] = field.defaultValue !== undefined ? field.defaultValue : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
        }
      });
      let finalBackData: CardData | null = null;
      if (card.backTemplate && editedBackData) {
        finalBackData = { ...editedBackData };
        backDynamicFields.forEach(field => {
           if (finalBackData![field.key] === undefined) {
            finalBackData![field.key] = field.defaultValue !== undefined ? field.defaultValue : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
          }
        });
      }
      onDuplicate({ ...card, frontData: finalFrontData, backData: finalBackData }); 
    }
  }, [card, editedFrontData, editedBackData, frontDynamicFields, backDynamicFields, onDuplicate]);

  if (!card) return null;

  const cardIdentifier = String(editedFrontData[frontDynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImageKey)?.key || ''] || editedFrontData[frontDynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImageKey)?.key || ''] || `Card ${card.uniqueId.substring(0,5)}`);

  const renderFieldsForSide = (
    fields: DynamicField[], 
    data: CardData | null, 
    side: 'front' | 'back',
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (!data || fields.length === 0) {
      return <p className="text-sm text-muted-foreground">No editable fields for this side, or no data provided.</p>;
    }
    return fields.map(field => (
      <div key={`${side}-${field.key}`} className="mb-3">
        <Label htmlFor={`editCard-${side}-${field.key}`}>
          {field.label} {field.isImageKey ? '(Image URL or Upload)' : ''}
        </Label>
        <div className={field.isImageKey ? "flex items-center gap-2" : ""}>
          {field.type === 'textarea' ? (
            <Textarea
              id={`editCard-${side}-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key, side)}
              placeholder={`Enter value for ${field.key}...`}
              rows={3}
              className="text-sm"
            />
          ) : (
            <Input
              id={`editCard-${side}-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key, side)}
              placeholder={field.isImageKey ? `URL for ${field.key} or Upload` : `Enter value for ${field.key}...`}
              className={`text-sm ${field.isImageKey ? "flex-grow" : ""}`}
            />
          )}
          {field.isImageKey && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRefs.current[field.key]?.click()}
                className="shrink-0"
                aria-label={`Upload image for ${field.label}`}
              >
                <Upload className="mr-2 h-4 w-4" /> Upload
              </Button>
              <input
                type="file"
                accept="image/*"
                ref={el => fileRefs.current[field.key] = el}
                onChange={(e) => handleImageUpload(e, field.key, side)}
                style={{ display: 'none' }}
                id={`editCard-file-${side}-${field.key}`}
              />
            </>
          )}
        </div>
      </div>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit: {cardIdentifier}</DialogTitle>
          <DialogDescription>
            Front Template: {card.frontTemplate.name || card.frontTemplate.id?.substring(0,8)}
            {card.backTemplate && ` | Back Template: ${card.backTemplate.name || card.backTemplate.id?.substring(0,8)}`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6 mb-4">
            <Accordion type="multiple" defaultValue={['edit-front-data']} className="w-full">
                <AccordionItem value="edit-front-data">
                    <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Front Card Data</AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-1">
                        {renderFieldsForSide(frontDynamicFields, editedFrontData, 'front', frontFileInputRefs)}
                    </AccordionContent>
                </AccordionItem>
                {card.backTemplate && (
                    <AccordionItem value="edit-back-data" className="mt-3">
                        <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Back Card Data</AccordionTrigger>
                        <AccordionContent className="pt-3 space-y-1">
                            {renderFieldsForSide(backDynamicFields, editedBackData, 'back', backFileInputRefs)}
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
             {frontDynamicFields.length === 0 && (!card.backTemplate || backDynamicFields.length === 0) && (
                <p className="text-sm text-muted-foreground mt-3">Selected template(s) have no editable placeholder fields.</p>
            )}
        </ScrollArea>

        <div className="mt-auto border-t pt-3">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="raw-data-viewer-edit">
                    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground hover:no-underline py-1.5 [&>.lucide-chevron-down]:hidden">
                        <div className="flex items-center gap-1.5"><Eye className="h-4 w-4" />View Raw Card Data</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <Label className="text-xs">Front Data:</Label>
                        <Textarea
                            readOnly
                            value={JSON.stringify(editedFrontData, null, 2)}
                            className="font-mono text-xs h-28 bg-muted/30 mb-2"
                            aria-label="Raw front card data JSON"
                        />
                        {editedBackData && <>
                          <Label className="text-xs">Back Data:</Label>
                          <Textarea
                              readOnly
                              value={JSON.stringify(editedBackData, null, 2)}
                              className="font-mono text-xs h-28 bg-muted/30"
                              aria-label="Raw back card data JSON"
                          />
                        </>}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
}
