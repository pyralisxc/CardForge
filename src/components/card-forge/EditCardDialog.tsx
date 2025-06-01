
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DisplayCard, CardData, TCGCardTemplate } from '@/types'; // ExtractedPlaceholder removed
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
// No direct import of useAppStore here, uses props for card and actions

interface EditCardDialogProps {
  isOpen: boolean;
  card: DisplayCard | null; // From Zustand store via props
  onSave: (updatedCard: DisplayCard) => void; // Calls Zustand action via props
  onDuplicate: (cardToDuplicate: DisplayCard) => void; // Calls Zustand action via props
  onClose: () => void; // Calls Zustand action via props
}

interface DynamicField {
  key: string;
  label: string; 
  type: 'input' | 'textarea';
  isImageKey: boolean;
  defaultValue?: string;
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose }: EditCardDialogProps) {
  // Local state for the data being edited within the dialog.
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  // Helper function to generate fields and initialize editedData based on the card's template and existing data.
  // This is pure logic, suitable for useCallback or direct use in useEffect.
  const generateFieldsAndData = useCallback((template: TCGCardTemplate | undefined | null, existingData: CardData | null | undefined): [DynamicField[], CardData] => {
    if (!template) return [[], {}];
    const allPlaceholderKeys = extractUniquePlaceholderKeys(template);
    const currentCardData = { ...(existingData || {}) }; // Start with existing card data
    const newEditedDataState: CardData = {}; // Will hold the initialized data for the form

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

        // Prioritize existing data, then placeholder default, then image placeholder, then empty string
        if (currentCardData[placeholder.key] !== undefined) {
          newEditedDataState[placeholder.key] = currentCardData[placeholder.key];
        } else if (placeholder.defaultValue !== undefined) {
          newEditedDataState[placeholder.key] = placeholder.defaultValue;
        } else if (isImageSectionKey) {
           newEditedDataState[placeholder.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(placeholder.key))}`;
        }
        else { // Fallback for non-image, non-defaulted fields
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
  }, []); // Empty dependency array as it uses pure utility functions

  // useEffect to initialize or update local `editedData` and `dynamicFields` when the `card` prop changes.
  // This is a safe and common use of useEffect: reacting to a prop change to set local state for an editing form.
  useEffect(() => {
    // Zustand reactivity handles updates to the `card` prop.
    if (card) {
      const [fields, data] = generateFieldsAndData(card.template, card.data);
      setDynamicFields(fields);
      setEditedData(data); // Initialize local editing state
    } else {
      // If no card is provided (e.g., dialog closed or error), reset local state.
      setEditedData({});
      setDynamicFields([]);
    }
    // Dependency: `card` prop from global store, and `generateFieldsAndData` (memoized).
  }, [card, generateFieldsAndData]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setEditedData(prev => ({ ...prev, [fieldKey]: e.target.value })); // Update local state
  }, []);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = event.target.files?.[0];
    const fileRefsLocal = fileInputRefs;

    if (file) {
      // File reading is an async side effect, correctly handled here.
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setEditedData(prev => ({ ...prev, [fieldKey]: dataUri })); // Update local state
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
    if (card) { // Ensure card prop is still valid
      const finalData = { ...editedData };
      // Ensure all dynamic fields defined by the template have a value in the final data
      dynamicFields.forEach(field => {
        if (finalData[field.key] === undefined) { // If a field was somehow missed in editedData
          finalData[field.key] = field.defaultValue !== undefined 
            ? field.defaultValue 
            : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
        }
      });
      onSave({ ...card, data: finalData }); // Calls Zustand action via prop
      // Dialog closing is handled by onSave in the parent or by the onOpenChange of Dialog itself.
    }
  }, [card, editedData, dynamicFields, onSave]);

  const handleDuplicateThisCard = useCallback(() => {
    if (card) { // Ensure card prop is still valid
       const finalData = { ...editedData };
       dynamicFields.forEach(field => {
        if (finalData[field.key] === undefined) {
          finalData[field.key] = field.defaultValue !== undefined 
            ? field.defaultValue 
            : (field.isImageKey ? `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`: '');
        }
      });
      onDuplicate({ ...card, data: finalData }); // Calls Zustand action via prop
      // Dialog closing depends on desired UX. Here, assuming it might stay open or be handled by onDuplicate.
    }
  }, [card, editedData, dynamicFields, onDuplicate]);

  if (!card) return null; // Don't render if no card is provided (or if isOpen is false, Dialog handles that)

  const cardIdentifier = String(editedData[dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImageKey)?.key || ''] || editedData[dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImageKey)?.key || ''] || `Card ${card.uniqueId.substring(0,5)}`);

  const renderFields = (
    fields: DynamicField[], 
    data: CardData, // data is the local editedData state
    fileRefsLocal: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0) {
      return <p className="text-sm text-muted-foreground">No editable fields for this card's template.</p>;
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
              value={(data[field.key] as string) || ''} // Use local editedData
              onChange={(e) => handleInputChange(e, field.key)}
              placeholder={`Enter value for ${field.key}...`}
              rows={3}
              className="text-sm"
            />
          ) : (
            <Input
              id={`editCard-${field.key}`}
              value={(data[field.key] as string) || ''} // Use local editedData
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
    <Dialog open={isOpen} onOpenChange={(openState) => !openState && onClose()}> {/* onClose prop handles Zustand state */}
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit: {cardIdentifier}</DialogTitle>
          <DialogDescription>
            Template: {card.template.name || card.template.id?.substring(0,8)}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6 mb-4"> {/* Scroll area for content */}
            <Accordion type="single" collapsible defaultValue="edit-card-data" className="w-full">
                <AccordionItem value="edit-card-data">
                    <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Card Data</AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-1">
                        {renderFields(dynamicFields, editedData, fileInputRefs)}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
             {dynamicFields.length === 0 && card && ( // Show if card is loaded but no fields
                <p className="text-sm text-muted-foreground mt-3">Selected template has no editable placeholder fields.</p>
            )}
        </ScrollArea>

        <div className="mt-auto border-t pt-3"> {/* Raw data viewer section */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="raw-data-viewer-edit">
                    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground hover:no-underline py-1.5 [&>.lucide-chevron-down]:hidden">
                        <div className="flex items-center gap-1.5"><Eye className="h-4 w-4" />View Raw Card Data</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <Label className="text-xs">Card Data (Currently Editing):</Label>
                        <Textarea
                            readOnly
                            value={JSON.stringify(editedData, null, 2)} // Show local editedData
                            className="font-mono text-xs h-28 bg-muted/30 mb-2"
                            aria-label="Raw card data JSON"
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t"> {/* Actions footer */}
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
