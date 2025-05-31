
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, ExtractedPlaceholder } from '@/types';
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

const NO_BACK_TEMPLATE_VALUE = "no-back-template";

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange?: (templateId: string | null) => void; // For front template
  selectedTemplateIdProp?: string | null;
}

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
  isImageKey: boolean;
  defaultValue?: string;
}

export function SingleCardGenerator({
  templates,
  onSingleCardAdded,
  onTemplateSelectionChange,
  selectedTemplateIdProp,
}: SingleCardGeneratorProps) {
  const [selectedFrontTemplateId, setSelectedFrontTemplateId] = useState<string | null>(selectedTemplateIdProp || templates[0]?.id || null);
  const [selectedBackTemplateId, setSelectedBackTemplateId] = useState<string | null>(null);

  const [frontCardData, setFrontCardData] = useState<CardData>({});
  const [backCardData, setBackCardData] = useState<CardData>({});

  const [frontDynamicFields, setFrontDynamicFields] = useState<DynamicField[]>([]);
  const [backDynamicFields, setBackDynamicFields] = useState<DynamicField[]>([]);

  const { toast } = useToast();
  const frontFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const backFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (selectedTemplateIdProp !== undefined) {
      setSelectedFrontTemplateId(selectedTemplateIdProp || templates[0]?.id || null);
    }
  }, [selectedTemplateIdProp, templates]);

  const generateDynamicFields = (template: TCGCardTemplate | undefined, currentData: CardData): [DynamicField[], CardData] => {
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
  };

  useEffect(() => {
    const frontTemplate = templates.find(t => t.id === selectedFrontTemplateId);
    const [newFrontFields, newFrontData] = generateDynamicFields(frontTemplate, frontCardData);
    setFrontDynamicFields(newFrontFields);
    if (Object.keys(frontCardData).join(',') !== Object.keys(newFrontData).join(',')) {
        setFrontCardData(newFrontData);
    } else {
        const updatedWithDefaults = {...newFrontData};
        Object.keys(newFrontData).forEach(key => {
            if (String(updatedWithDefaults[key]).trim() === '' && newFrontFields.find(f=>f.key === key)?.defaultValue) {
                updatedWithDefaults[key] = newFrontFields.find(f=>f.key === key)!.defaultValue!;
            }
        });
        setFrontCardData(updatedWithDefaults);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFrontTemplateId, templates]); // Only re-run for front if front template changes

  useEffect(() => {
    const backTemplate = templates.find(t => t.id === selectedBackTemplateId);
    const [newBackFields, newBackData] = generateDynamicFields(backTemplate, backCardData);
    setBackDynamicFields(newBackFields);
     if (Object.keys(backCardData).join(',') !== Object.keys(newBackData).join(',')) {
        setBackCardData(newBackData);
    } else {
        const updatedWithDefaults = {...newBackData};
        Object.keys(newBackData).forEach(key => {
            if (String(updatedWithDefaults[key]).trim() === '' && newBackFields.find(f=>f.key === key)?.defaultValue) {
                updatedWithDefaults[key] = newBackFields.find(f=>f.key === key)!.defaultValue!;
            }
        });
        setBackCardData(updatedWithDefaults);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBackTemplateId, templates]); // Only re-run for back if back template changes

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string, side: 'front' | 'back') => {
    const setter = side === 'front' ? setFrontCardData : setBackCardData;
    setter(prev => ({ ...prev, [fieldKey]: e.target.value }));
  }, []);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>, fieldKey: string, side: 'front' | 'back') => {
    const file = event.target.files?.[0];
    const setter = side === 'front' ? setFrontCardData : setBackCardData;
    const refs = side === 'front' ? frontFileInputRefs : backFileInputRefs;

    if (file) {
      const reader = new FileReader();
      reader.onload = (eRead) => {
        const dataUri = eRead.target?.result as string;
        setter(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded as Data URI for ${fieldKey} (${side}).` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: `Failed to read image file for ${side}.`, variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (refs.current[fieldKey]) {
      refs.current[fieldKey]!.value = "";
    }
  }, [toast]);

  const handleAddCard = useCallback(() => {
    const frontTemplate = templates.find(t => t.id === selectedFrontTemplateId);
    if (!frontTemplate) {
      toast({ title: "Front Template Required", description: "Please select a TCG template for the card front.", variant: "destructive" });
      return;
    }

    const finalFrontData: CardData = { ...frontCardData };
    frontDynamicFields.forEach(field => {
        const currentValue = String(finalFrontData[field.key] || '').trim();
        if (currentValue === '' || currentValue === `{{${field.key}}}`) {
          if (field.defaultValue !== undefined) finalFrontData[field.key] = field.defaultValue;
          else if (field.isImageKey) finalFrontData[field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
          else finalFrontData[field.key] = '';
        }
    });

    let backTemplate: TCGCardTemplate | null = null;
    let finalBackData: CardData | null = null;

    if (selectedBackTemplateId) {
        backTemplate = templates.find(t => t.id === selectedBackTemplateId) || null;
        if (backTemplate) {
            finalBackData = { ...backCardData };
            backDynamicFields.forEach(field => {
                const currentValue = String(finalBackData![field.key] || '').trim();
                 if (currentValue === '' || currentValue === `{{${field.key}}}`) {
                    if (field.defaultValue !== undefined) finalBackData![field.key] = field.defaultValue;
                    else if (field.isImageKey) finalBackData![field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
                    else finalBackData![field.key] = '';
                }
            });
        }
    }

    const displayCard: DisplayCard = {
      frontTemplate: frontTemplate,
      frontData: finalFrontData,
      backTemplate: backTemplate,
      backData: finalBackData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);

    toast({ title: "Success", description: `Card added to preview list.` });
  }, [selectedFrontTemplateId, selectedBackTemplateId, templates, frontCardData, backCardData, frontDynamicFields, backDynamicFields, onSingleCardAdded, toast]);

  const handleFrontTemplateSelectChange = useCallback((id: string | null) => {
    setSelectedFrontTemplateId(id);
    setFrontCardData({});
    if (onTemplateSelectionChange) {
      onTemplateSelectionChange(id);
    }
  }, [onTemplateSelectionChange]);

  const handleBackTemplateSelectChange = useCallback((id: string | null) => {
    setSelectedBackTemplateId(id === NO_BACK_TEMPLATE_VALUE ? null : id);
    setBackCardData({});
  }, []);

  const renderFieldsForSide = (
    fields: DynamicField[],
    data: CardData,
    side: 'front' | 'back',
    fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  ) => {
    if (fields.length === 0) {
      return <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields.</p>;
    }
    return fields.map(field => (
      <div key={`${side}-${field.key}`}>
        <Label htmlFor={`singleCard-${side}-${field.key}`}>
          {field.label} {field.isImageKey ? '(Image URL or Upload)' : ''}
        </Label>
        <div className={field.isImageKey ? "flex items-center gap-2" : ""}>
          {field.type === 'textarea' ? (
            <Textarea
              id={`singleCard-${side}-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key, side)}
              placeholder={`Enter value for ${field.key}...`}
              rows={3}
            />
          ) : (
            <Input
              id={`singleCard-${side}-${field.key}`}
              value={(data[field.key] as string) || ''}
              onChange={(e) => handleInputChange(e, field.key, side)}
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
                onChange={(e) => handleImageUpload(e, field.key, side)}
                style={{ display: 'none' }}
                id={`singleCard-file-${side}-${field.key}`}
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
        <CardDescription>Select template(s) and fill in data for its placeholders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleFrontTemplateSelect">Select Front Template*</Label>
          <Select
            value={selectedFrontTemplateId ?? undefined} // Use undefined for Select to show placeholder if value is null
            onValueChange={handleFrontTemplateSelectChange}
            disabled={templates.length === 0}
          >
            <SelectTrigger id="singleFrontTemplateSelect">
              <SelectValue placeholder="Choose front template (Required)" />
            </SelectTrigger>
            <SelectContent>
              {templates.length > 0 ? (
                templates.map(t => <SelectItem key={`front-${t.id || 'new-template-option'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5) || 'Untitled'}`}</SelectItem>)
              ) : (
                <SelectItem value="no-templates-front" disabled>No templates available.</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="singleBackTemplateSelect">Select Back Template (Optional)</Label>
          <Select
            value={selectedBackTemplateId ?? NO_BACK_TEMPLATE_VALUE}
            onValueChange={handleBackTemplateSelectChange}
            disabled={templates.length === 0}
          >
            <SelectTrigger id="singleBackTemplateSelect">
              <SelectValue placeholder="Choose back template (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BACK_TEMPLATE_VALUE}>No Back Template</SelectItem>
              {templates.map(t => <SelectItem key={`back-${t.id || 'new-template-option-back'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5) || 'Untitled'}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedFrontTemplateId && (
          <Accordion type="multiple" defaultValue={['front-data-item']} className="w-full">
            <AccordionItem value="front-data-item">
              <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Front Card Data
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3 border-t">
                {frontDynamicFields.length > 0 ?
                  renderFieldsForSide(frontDynamicFields, frontCardData, 'front', frontFileInputRefs) :
                  <p className="text-sm text-muted-foreground">Selected front template has no placeholder fields.</p>
                }
              </AccordionContent>
            </AccordionItem>

            {selectedBackTemplateId && templates.find(t => t.id === selectedBackTemplateId) && (
              <AccordionItem value="back-data-item" className="mt-3">
                <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden">
                   <div className="flex items-center gap-2">
                     <Layers className="h-4 w-4" /> Back Card Data
                   </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-3 border-t">
                  {backDynamicFields.length > 0 ?
                    renderFieldsForSide(backDynamicFields, backCardData, 'back', backFileInputRefs) :
                    <p className="text-sm text-muted-foreground">Selected back template has no placeholder fields.</p>
                  }
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}

         {!selectedFrontTemplateId && templates.length > 0 && (
            <p className="text-sm text-muted-foreground">Select a front template above to start entering card data.</p>
        )}
         {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates available. Please create one in the "Template Editor" tab first.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedFrontTemplateId} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
