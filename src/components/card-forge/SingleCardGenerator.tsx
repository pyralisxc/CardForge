
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
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

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
  isImageKey: boolean;
  defaultValue?: string;
}

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
  // selectedTemplateId is now directly from selectedTemplateIdProp (Zustand store).
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Comment: selectedTemplateIdProp is managed by Zustand.
  // Defaulting logic (e.g., selecting the first template if the current one is invalid)
  // is handled by the Zustand store's _rehydrateCallback or actions like deleteTemplate.

  const generateDynamicFields = useCallback((template: TCGCardTemplate | undefined, currentData: CardData): [DynamicField[], CardData] => {
    if (!template) return [[], {}];

    const extractedPlaceholders = extractUniquePlaceholderKeys(template);
    const newCardDataState: CardData = {};
    
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

      let initialValue: string | number | undefined = currentData[placeholder.key];
      if (initialValue === undefined && placeholder.defaultValue !== undefined) {
        initialValue = placeholder.defaultValue;
      }
      if (isImageSectionKey && (initialValue === undefined || String(initialValue).trim() === '' || String(initialValue).trim() === `{{${placeholder.key}}}`)) {
         initialValue = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(placeholder.key))}`;
      }
      if (initialValue === undefined) {
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
  }, []);

  // Safe useEffect: Reacts to selectedTemplateIdProp (from Zustand) or templates list changes
  // to regenerate dynamic fields and reset local cardData (form state) with defaults from the new template.
  useEffect(() => {
    const template = templates.find(t => t.id === selectedTemplateIdProp);
    // Regenerate fields and reset cardData with defaults from the new template.
    // Passing {} as currentData ensures fresh defaults are applied.
    const [newFields, newGeneratedData] = generateDynamicFields(template, {}); 
    
    setDynamicFields(newFields);
    setCardData(newGeneratedData); // This resets the form to the new template's structure/defaults.
  }, [selectedTemplateIdProp, templates, generateDynamicFields]);

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
    const template = templates.find(t => t.id === selectedTemplateIdProp);
    if (!template) {
      toast({ title: "Template Required", description: "Please select a TCG template for the card.", variant: "destructive" });
      return;
    }

    const finalCardData: CardData = { ...cardData };
    dynamicFields.forEach(field => {
        const currentValue = finalCardData[field.key];
        if (currentValue === undefined || String(currentValue).trim() === '' || String(currentValue).trim() === `{{${field.key}}}`) {
          if (field.defaultValue !== undefined) finalCardData[field.key] = field.defaultValue;
          else if (field.isImageKey) finalCardData[field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
          else finalCardData[field.key] = '';
        }
    });

    const displayCard: DisplayCard = {
      template: template,
      data: finalCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);

    toast({ title: "Success", description: `Card added to preview list.` });
    
    // Reset form fields to defaults for the currently selected template after adding a card
    const [_, resetData] = generateDynamicFields(template, {});
    setCardData(resetData);

  }, [selectedTemplateIdProp, templates, cardData, dynamicFields, onSingleCardAdded, toast, generateDynamicFields]);

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    onTemplateSelectionChange(id); // Calls Zustand action via prop
    // cardData will be reset by the useEffect hook reacting to selectedTemplateIdProp change
  }, [onTemplateSelectionChange]);


  const renderFields = (
    fields: DynamicField[],
    data: CardData,
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0 && selectedTemplateIdProp) {
      return <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields.</p>;
    }
    if (!selectedTemplateIdProp) {
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
            value={selectedTemplateIdProp ?? undefined} // Use prop from Zustand
            onValueChange={handleTemplateSelectChange} // Calls Zustand action
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
            <p className="text-sm text-muted-foreground">Select a template above to start entering card data.</p>
        )}
         {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates available. Please create one in the "Template Editor" tab first.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplateIdProp} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
