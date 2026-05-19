
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { DisplayCard, CardData, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Save, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/appStore';
import { GeneratorFieldGroups } from '@/components/card-forge/GeneratorFieldGroups';
import { completeCardDataWithTemplateDefaults, initializeCardDataFromTemplate } from '@/lib/cardDataDefaults';

interface EditCardDialogProps {
  isOpen: boolean;
  card: DisplayCard | null; // From Zustand store via props
  onSave: (updatedCard: DisplayCard) => void; // Calls Zustand action via props
  onDuplicate: (cardToDuplicate: DisplayCard) => void; // Calls Zustand action via props
  onClose: () => void; // Calls Zustand action via props
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose }: EditCardDialogProps) {
  // Local state for the data being edited within the dialog.
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<TemplateFieldDefinition[]>([]);
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useAppStore((state) => state.setRichTextHighlightColor);

  const generateFieldsAndData = useCallback((template: TCGCardTemplate | undefined | null, existingData: CardData | null | undefined): [TemplateFieldDefinition[], CardData] => {
    return initializeCardDataFromTemplate(template, existingData);
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
      const finalData = completeCardDataWithTemplateDefaults(dynamicFields, editedData);
      onSave({ ...card, data: finalData }); // Calls Zustand action via prop
      // Dialog closing is handled by onSave in the parent or by the onOpenChange of Dialog itself.
    }
  }, [card, editedData, dynamicFields, onSave]);

  const handleDuplicateThisCard = useCallback(() => {
    if (card) { // Ensure card prop is still valid
      const finalData = completeCardDataWithTemplateDefaults(dynamicFields, editedData);
      onDuplicate({ ...card, data: finalData }); // Calls Zustand action via prop
      onClose();
    }
  }, [card, editedData, dynamicFields, onClose, onDuplicate]);

  if (!card) return null; // Don't render if no card is provided (or if isOpen is false, Dialog handles that)

  const cardIdentifier = String(editedData[dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImage)?.key || ''] || editedData[dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImage)?.key || ''] || `Card ${card.uniqueId.substring(0,5)}`);

  const renderFields = (
    fields: TemplateFieldDefinition[], 
    data: CardData, // data is the local editedData state
    fileRefsLocal: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0) {
      return <p className="text-sm text-muted-foreground">No editable fields for this card's template.</p>;
    }
    return (
      <GeneratorFieldGroups
        fields={fields}
        data={data}
        onFieldChange={(fieldKey, value) => setEditedData(prev => ({ ...prev, [fieldKey]: value }))}
        highlightColor={richTextHighlightColor}
        onHighlightColorChange={setRichTextHighlightColorAction}
        fileInputRefs={fileRefsLocal}
        onImageUpload={handleImageUpload}
        emptyMessage="No editable fields for this card's template."
      />
    );
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
