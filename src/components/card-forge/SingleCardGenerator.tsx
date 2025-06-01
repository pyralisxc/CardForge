
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types'; // ExtractedPlaceholder removed
import { extractUniquePlaceholderKeys, toTitleCase } from '@/lib/utils';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2, Upload, Layers } from 'lucide-react';
// No direct import of useAppStore here, uses props for templates and actions

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
  isImageKey: boolean;
  defaultValue?: string;
}

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[]; // From Zustand store via props
  onSingleCardAdded: (card: DisplayCard) => void; // Calls Zustand action via props
  onTemplateSelectionChange?: (templateId: string | null) => void; // Calls Zustand action via props
  selectedTemplateIdProp?: string | null; // From Zustand store via props
}

export function SingleCardGenerator({
  templates,
  onSingleCardAdded,
  onTemplateSelectionChange,
  selectedTemplateIdProp,
}: SingleCardGeneratorProps) {
  // Local state for the form fields and data for the single card being generated.
  // selectedTemplateId is synced with selectedTemplateIdProp from the global store.
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // useEffect to synchronize local selectedTemplateId with the prop from Zustand.
  // This is a common pattern when a component's internal state needs to reflect a global state
  // but also allow for local control or initialization.
  useEffect(() => {
    // Zustand reactivity handles updates to selectedTemplateIdProp.
    // This effect ensures local state matches global if prop changes.
    const targetId = selectedTemplateIdProp !== undefined 
        ? (selectedTemplateIdProp || (templates.length > 0 ? templates[0].id : null))
        : (templates.length > 0 ? templates[0].id : null);
    
    if (selectedTemplateId !== targetId) {
        setSelectedTemplateId(targetId);
        // When template changes, reset local cardData, fields will regenerate in next effect
        setCardData({}); 
    }
    // Dependency: selectedTemplateIdProp from global store, and templates list.
  }, [selectedTemplateIdProp, templates]);


  const generateDynamicFields = useCallback((template: TCGCardTemplate | undefined, currentData: CardData): [DynamicField[], CardData] => {
    if (!template) return [[], {}];

    const extractedPlaceholders = extractUniquePlaceholderKeys(template);
    const newCardDataState: CardData = {}; // Build new data state based on placeholders and current/defaults
    
    const fields: DynamicField[] = extractedPlaceholders.map(placeholder => {
      const isImageSectionKey = template.rows.some(row =>
          (row.columns || []).some(col =>
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

      let initialValue: string | number | undefined = currentData[placeholder.key]; // Prefer existing data if any
      if (initialValue === undefined && placeholder.defaultValue !== undefined) {
        initialValue = placeholder.defaultValue;
      }
      if (isImageSectionKey && (initialValue === undefined || String(initialValue).trim() === '' || String(initialValue).trim() === `{{${placeholder.key}}}`)) {
         initialValue = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(placeholder.key))}`;
      }
      if (initialValue === undefined) { // Fallback to empty string if no other value
        initialValue = '';
      }
      newCardDataState[placeholder.key] = initialValue;

      return {
        key: placeholder.key,
        label: `{{${placeholder.key}}}`,
        type: isTextarea ? 'textarea' : 'input',
        isImageKey: isImageSectionKey,
        defaultValue: placeholder.defaultValue,
      };
    });
    return [fields, newCardDataState];
  }, []); // Empty dependency array as extractUniquePlaceholderKeys and toTitleCase are pure utils

  // useEffect to regenerate dynamic fields and cardData structure when the selected template changes.
  // This is a safe use of useEffect: it reacts to `selectedTemplateId` (local state, synced with global)
  // and `templates` (prop from global) to update local UI state (`dynamicFields`, `cardData`).
  useEffect(() => {
    // Zustand reactivity handles templates prop changes.
    // This effect runs when local `selectedTemplateId` changes or `templates` list changes.
    const template = templates.find(t => t.id === selectedTemplateId);
    // Pass existing cardData to preserve user input if they switch templates and switch back,
    // or if fields are common.
    const [newFields, newGeneratedData] = generateDynamicFields(template, cardData); 
    
    setDynamicFields(newFields);
    // Only update cardData if the structure or default-derived values have changed.
    // Avoids clearing user input unnecessarily if field keys are stable.
    if (JSON.stringify(cardData) !== JSON.stringify(newGeneratedData)) {
        setCardData(newGeneratedData);
    }
    // Dependencies: `selectedTemplateId` (local), `templates` (global prop), `generateDynamicFields` (memoized),
    // and `cardData` itself to ensure defaults are correctly applied over existing data.
  }, [selectedTemplateId, templates, generateDynamicFields, cardData]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setCardData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  }, []);

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
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      toast({ title: "Template Required", description: "Please select a TCG template for the card.", variant: "destructive" });
      return;
    }

    const finalCardData: CardData = { ...cardData };
    dynamicFields.forEach(field => { // Ensure all fields defined by the template have a value
        const currentValue = finalCardData[field.key];
        if (currentValue === undefined || String(currentValue).trim() === '' || String(currentValue).trim() === `{{${field.key}}}`) {
          if (field.defaultValue !== undefined) finalCardData[field.key] = field.defaultValue;
          else if (field.isImageKey) finalCardData[field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
          else finalCardData[field.key] = ''; // Default to empty string for non-image, non-defaulted fields
        }
    });

    const displayCard: DisplayCard = {
      template: template, // The full template object
      data: finalCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard); // Calls Zustand action via prop

    toast({ title: "Success", description: `Card added to preview list.` });
    // Optionally reset form fields here if desired after adding
    // const [_, resetData] = generateDynamicFields(template, {}); // Get fresh defaults
    // setCardData(resetData);
  }, [selectedTemplateId, templates, cardData, dynamicFields, onSingleCardAdded, toast, generateDynamicFields]);

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    // This updates local state, which then syncs with global via onTemplateSelectionChange prop.
    // Or, onTemplateSelectionChange directly updates global, which flows back via selectedTemplateIdProp.
    // The latter is cleaner.
    if (onTemplateSelectionChange) {
      onTemplateSelectionChange(id); // Calls Zustand action via prop
    } else {
      setSelectedTemplateId(id); // Fallback if no prop, but prop method is preferred
    }
    setCardData({}); // Reset local data when template changes
  }, [onTemplateSelectionChange]);


  const renderFields = (
    fields: DynamicField[],
    data: CardData,
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0 && selectedTemplateId) {
      return <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields.</p>;
    }
    if (!selectedTemplateId) {
        return <p className="text-sm text-muted-foreground">Select a template to see its fields.</p>;
    }
    return fields.map(field => (
      <div key={field.key} className="space-y-1">
        <Label htmlFor={`singleCard-${field.key}`}>
          {field.label} {field.isImageKey ? '(Image URL or Upload)' : ''}
        </Label>
        <div className={field.isImageKey ? "flex items-center gap-2" : ""}>
          {field.type === 'textarea' ? (
            <Textarea
              id={`singleCard-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key)}
              placeholder={`Enter value for ${field.key}...`}
              rows={3}
            />
          ) : (
            <Input
              id={`singleCard-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key)}
              placeholder={field.isImageKey ? `URL or Data URI for ${field.key}` : `Enter value for ${field.key}...`}
              className={field.isImageKey ? "flex-grow" : ""}
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
                onChange={(e) => handleImageUpload(e, field.key)}
                style={{ display: 'none' }}
                id={`singleCard-file-${field.key}`}
              />
            </>
          )}
        </div>
      </div>
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Select a template and fill in data for its placeholders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template*</Label>
          <Select
            value={selectedTemplateId ?? undefined} // Use local selectedTemplateId for Select control
            onValueChange={handleTemplateSelectChange}
            disabled={templates.length === 0}
          >
            <SelectTrigger id="singleTemplateSelect">
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
        </div>

        {selectedTemplateId && (
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

         {!selectedTemplateId && templates.length > 0 && (
            <p className="text-sm text-muted-foreground">Select a template above to start entering card data.</p>
        )}
         {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates available. Please create one in the "Template Editor" tab first.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplateId} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
