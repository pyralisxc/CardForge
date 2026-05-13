
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
import { toTitleCase } from '@/lib/utils';
import { extractTemplateFieldDefinitions, type TemplateFieldDefinition } from '@/lib/templateFields';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { CardPreview } from '@/components/card-forge/CardPreview';
import { RichTextToolbar } from '@/components/card-forge/makerConstants';
import { useAppStore } from '@/store/appStore';

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
  
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useAppStore((state) => state.setRichTextHighlightColor);

  // selectedTemplate is derived from selectedTemplateIdProp (from Zustand) and templates prop.
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateIdProp);
  }, [templates, selectedTemplateIdProp]);


  const generateDynamicFields = useCallback((template: TCGCardTemplate | undefined, currentData: CardData): [TemplateFieldDefinition[], CardData] => {
    if (!template) return [[], {}];

    const extractedFields = extractTemplateFieldDefinitions(template);
    const newCardDataState: CardData = {};
    
    const fields: TemplateFieldDefinition[] = extractedFields.map(field => {
      let initialValue: string | number | undefined = currentData[field.key];
      if (initialValue === undefined && field.defaultValue !== undefined) {
        initialValue = field.defaultValue;
      }
      if (field.isImage && (initialValue === undefined || String(initialValue).trim() === '' || String(initialValue).trim() === `{{${field.key}}}`)) {
         initialValue = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
      }
      if (initialValue === undefined) {
        initialValue = '';
      }
      newCardDataState[field.key] = initialValue;

      return field;
    });
    return [fields, newCardDataState];
  }, []);

  // Safe useEffect: Reacts to selectedTemplateIdProp (from Zustand via prop) or templates list changes
  // to regenerate dynamic fields and reset local cardData (form state) with defaults from the new template.
  useEffect(() => {
    // The selectedTemplate is now derived via useMemo based on selectedTemplateIdProp
    // Regenerate fields and reset cardData with defaults from the new template.
    // Passing {} as currentData ensures fresh defaults are applied.
    const [newFields, newGeneratedData] = generateDynamicFields(selectedTemplate, {}); 
    
    setDynamicFields(newFields);
    setCardData(newGeneratedData); // This resets the form to the new template's structure/defaults.
  }, [selectedTemplate, generateDynamicFields]); // Depend on the derived selectedTemplate

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
    if (!selectedTemplate) { // Use the memoized selectedTemplate
      toast({ title: "Template Required", description: "Please select a TCG template for the card.", variant: "destructive" });
      return;
    }

    const finalCardData: CardData = { ...cardData };
    dynamicFields.forEach(field => {
        const currentValue = finalCardData[field.key];
        if (currentValue === undefined || String(currentValue).trim() === '' || String(currentValue).trim() === `{{${field.key}}}`) {
          if (field.defaultValue !== undefined) finalCardData[field.key] = field.defaultValue;
          else if (field.isImage) finalCardData[field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
          else finalCardData[field.key] = '';
        }
    });

    const displayCard: DisplayCard = {
      template: selectedTemplate, // Use the memoized selectedTemplate
      data: finalCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);

    toast({ title: "Success", description: `Card added to preview list.` });
    
    // Reset form fields to defaults for the currently selected template after adding a card
    const [_, resetData] = generateDynamicFields(selectedTemplate, {}); // Use memoized selectedTemplate
    setCardData(resetData);

  }, [selectedTemplate, cardData, dynamicFields, onSingleCardAdded, toast, generateDynamicFields]); // Use memoized selectedTemplate

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    onTemplateSelectionChange(id); // Calls Zustand action via prop
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
    return fields.map(field => (
      <div key={field.key} className="space-y-1">
        <Label htmlFor={`singleCard-${field.key}`}>
          {field.label} {field.isImage ? '(Image URL or Upload)' : ''}
        </Label>
        {field.editor === 'rich-textarea' && (
          <RichTextToolbar
            textareaRef={{
              current: textAreaRefs.current[field.key],
            }}
            value={(data[field.key] as string) || ''}
            onChange={(value) => setCardData(prev => ({ ...prev, [field.key]: value }))}
            highlightColor={richTextHighlightColor}
            onHighlightColorChange={setRichTextHighlightColorAction}
          />
        )}
        <div className={field.isImage ? "flex items-center gap-2" : ""}>
          {field.control === 'textarea' ? (
            <Textarea
              id={`singleCard-${field.key}`}
              ref={(el) => {
                textAreaRefs.current[field.key] = el;
              }}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key)}
              placeholder={field.supportsRichText ? `Enter value for ${field.key}... Rich text markers like ==highlight== are supported.` : `Enter value for ${field.key}...`}
              rows={field.editor === 'rich-textarea' ? 5 : 3}
              className={field.editor === 'rich-textarea' ? 'font-mono text-xs' : undefined}
            />
          ) : (
            <Input
              id={`singleCard-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key)}
              placeholder={field.isImage ? `URL or Data URI for ${field.key}` : `Enter value for ${field.key}...`}
              className={field.isImage ? "flex-grow" : ""}
            />
          )}
          {field.isImage && (
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
                ref={(el) => {
                  fileRefs.current[field.key] = el;
                }}
                onChange={(e) => handleImageUpload(e, field.key)}
                style={{ display: 'none' }}
                id={`singleCard-file-${field.key}`}
                aria-label={`Upload image for ${field.label}`}
              />
            </>
          )}
        </div>
        {field.helperText && (
          <p className="text-xs text-muted-foreground">{field.helperText}</p>
        )}
      </div>
    ));
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
        <CardDescription>Select a template and fill in data for its placeholders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template*</Label>
          <Select
            value={selectedTemplateIdProp ?? undefined}
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

        {/* Live mini-preview */}
        {liveDisplayCard && (
          <div className="flex justify-center py-1">
            <div className="rounded-md overflow-hidden shadow-md" style={{ width: 160 }}>
              <CardPreview card={liveDisplayCard} targetWidthPx={160} />
            </div>
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
            <p className="text-sm text-muted-foreground">Select a template above to start entering card data.</p>
        )}
         {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">No Maker 2.0 templates available. Please create one in "Card Template Maker 2.0" first.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplateIdProp} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
