
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
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
      const [fields, data] = generateFieldsAndData(card.template, card.data);
      setDynamicFields(fields);
      setEditedData(data);
    } else {
      setEditedData({});
      setDynamicFields([]);
    }
  }, [card]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setEditedData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  }, []);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = event.target.files?.[0];
    const fileRefsLocal = fileInputRefs;

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setEditedData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded for ${fieldKey}.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (fileRefsLocal.current[fieldKey]) { 
      fileRefsLocal.current[fieldKey]!.value = ""; 
    }
  }, [toast]);

  const handleSaveChanges = useCallback(() => {
    if (card) {
      const finalData = { ...editedData };
      dynamicFields.forEach(field => {
        if (finalData[field.key] === undefined) {
          finalData[field.key] = field.defaultValue !== undefined ? field.defaultValue : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
        }
      });
      onSave({ ...card, data: finalData });
    }
  }, [card, editedData, dynamicFields, onSave]);

  const handleDuplicateThisCard = useCallback(() => {
    if (card) {
       const finalData = { ...editedData };
       dynamicFields.forEach(field => {
        if (finalData[field.key] === undefined) {
          finalData[field.key] = field.defaultValue !== undefined ? field.defaultValue : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
        }
      });
      onDuplicate({ ...card, data: finalData }); 
    }
  }, [card, editedData, dynamicFields, onDuplicate]);

  if (!card) return null;

  const cardIdentifier = String(editedData[dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImageKey)?.key || ''] || editedData[dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImageKey)?.key || ''] || `Card ${card.uniqueId.substring(0,5)}`);

  const renderFields = (
    fields: DynamicField[], 
    data: CardData | null, 
    fileRefsLocal: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (!data || fields.length === 0) {
      return <p className="text-sm text-muted-foreground">No editable fields for this card, or no data provided.</p>;
    }
    return fields.map(field => (
      <div key={field.key} className="mb-3">
        <Label htmlFor={`editCard-${field.key}`}>
          {field.label} {field.isImageKey ? '(Image URL or Upload)' : ''}
        </Label>
        <div className={field.isImageKey ? "flex items-center gap-2" : ""}>
          {field.type === 'textarea' ? (
            <Textarea
              id={`editCard-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key)}
              placeholder={`Enter value for ${field.key}...`}
              rows={3}
              className="text-sm"
            />
          ) : (
            <Input
              id={`editCard-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key)}
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
                onClick={() => fileRefsLocal.current[field.key]?.click()}
                className="shrink-0"
                aria-label={`Upload image for ${field.label}`}
              >
                <Upload className="mr-2 h-4 w-4" /> Upload
              </Button>
              <input
                type="file"
                accept="image/*"
                ref={el => fileRefsLocal.current[field.key] = el}
                onChange={(e) => handleImageUpload(e, field.key)}
                style={{ display: 'none' }}
                id={`editCard-file-${field.key}`}
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
            Template: {card.template.name || card.template.id?.substring(0,8)}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6 mb-4">
            <Accordion type="single" collapsible defaultValue="edit-card-data" className="w-full">
                <AccordionItem value="edit-card-data">
                    <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Card Data</AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-1">
                        {renderFields(dynamicFields, editedData, fileInputRefs)}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
             {dynamicFields.length === 0 && (
                <p className="text-sm text-muted-foreground mt-3">Selected template has no editable placeholder fields.</p>
            )}
        </ScrollArea>

        <div className="mt-auto border-t pt-3">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="raw-data-viewer-edit">
                    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground hover:no-underline py-1.5 [&>.lucide-chevron-down]:hidden">
                        <div className="flex items-center gap-1.5"><Eye className="h-4 w-4" />View Raw Card Data</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <Label className="text-xs">Card Data:</Label>
                        <Textarea
                            readOnly
                            value={JSON.stringify(editedData, null, 2)}
                            className="font-mono text-xs h-28 bg-muted/30 mb-2"
                            aria-label="Raw card data JSON"
                        />
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
