
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, ExtractedPlaceholder } from '@/types';
import { extractUniquePlaceholderKeys, toTitleCase } from '@/lib/utils';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2, Upload } from 'lucide-react'; // Added Upload icon

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange?: (templateId: string | null) => void;
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
}: SingleCardGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const { toast } = useToast();
  const prevCardDataRef = useRef<CardData | null>(null);
  // Store refs for file inputs in an object, keyed by fieldKey
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});


  useEffect(() => {
    prevCardDataRef.current = cardData;
  }, [cardData]);

  useEffect(() => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (selectedTemplate) {
      const extractedPlaceholders = extractUniquePlaceholderKeys(selectedTemplate);
      const newCardData: CardData = {};
      const prevData = prevCardDataRef.current || {};

      const fields: DynamicField[] = extractedPlaceholders.map(placeholder => {
        const isImageSectionKey = selectedTemplate.rows.some(row =>
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

        let initialValue = prevData[placeholder.key];
        if (initialValue === undefined && placeholder.defaultValue !== undefined) {
          initialValue = placeholder.defaultValue;
        }

        if (isImageSectionKey && (initialValue === undefined || String(initialValue).trim() === '')) {
           initialValue = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(placeholder.key))}`;
        }
        if (initialValue === undefined) {
          initialValue = '';
        }
        newCardData[placeholder.key] = initialValue;

        return {
          key: placeholder.key,
          label: `{{${placeholder.key}}}`,
          type: isTextarea ? 'textarea' : 'input',
          isImageKey: isImageSectionKey,
          defaultValue: placeholder.defaultValue,
        };
      });

      setDynamicFields(fields);
      setCardData(newCardData);

      if (onTemplateSelectionChange) {
        onTemplateSelectionChange(selectedTemplate.id);
      }
    } else {
      setDynamicFields([]);
      setCardData({});
      if (onTemplateSelectionChange) {
        onTemplateSelectionChange(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, templates]); // templates added as dep for when it changes


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setCardData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setCardData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded as Data URI.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value to allow uploading the same file again
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleAddCard = () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
      return;
    }

    const completeCardData: CardData = { ...cardData };
    dynamicFields.forEach(field => {
        if (completeCardData[field.key] === undefined || String(completeCardData[field.key]).trim() === '') {
          if (field.defaultValue !== undefined) {
            completeCardData[field.key] = field.defaultValue;
          } else if (field.isImageKey) {
            completeCardData[field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
          } else {
            completeCardData[field.key] = '';
          }
        }
    });

    const displayCard: DisplayCard = {
      template: selectedTemplate,
      data: completeCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);

    let cardIdentifier = "Untitled Card";
    const nameFieldKey = dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImageKey)?.key ||
                         dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImageKey)?.key;

    if (nameFieldKey && completeCardData[nameFieldKey]) {
        cardIdentifier = String(completeCardData[nameFieldKey]);
    } else if (dynamicFields.length > 0 && completeCardData[dynamicFields[0].key] && !dynamicFields[0].isImageKey) {
        cardIdentifier = String(completeCardData[dynamicFields[0].key]);
    }
    toast({ title: "Success", description: `Card "${cardIdentifier}" added to preview.` });
  };

  const handleTemplateSelectChange = (id: string) => {
    setSelectedTemplateId(id);
    setCardData({});
    if (onTemplateSelectionChange) {
      onTemplateSelectionChange(id);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Select a template and fill in data. For 'Image' sections, provide a URL or upload an image. For 'Placeholder' sections, use text.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template</Label>
          <Select
            value={selectedTemplateId}
            onValueChange={handleTemplateSelectChange}
          >
            <SelectTrigger id="singleTemplateSelect">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.length > 0 ? (
                templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
              ) : (
                <SelectItem value="no-templates" disabled>No templates available. Create one first.</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplateId && dynamicFields.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Enter data for template: <strong className="text-foreground">{templates.find(t=>t.id === selectedTemplateId)?.name}</strong></p>
            {dynamicFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`singleCard-${field.key}`}>
                  {field.label} {field.isImageKey ? '(Image URL or Upload)' : ''}
                </Label>
                <div className={field.isImageKey ? "flex items-center gap-2" : ""}>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`singleCard-${field.key}`}
                      value={(cardData[field.key] as string) || ''}
                      onChange={(e) => handleInputChange(e, field.key)}
                      placeholder={`Enter value for ${field.key}...`}
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={`singleCard-${field.key}`}
                      value={(cardData[field.key] as string) || ''}
                      onChange={(e) => handleInputChange(e, field.key)}
                      placeholder={field.isImageKey ? `URL for ${field.key} or Upload` : `Enter value for ${field.key}...`}
                      className={field.isImageKey ? "flex-grow" : ""}
                    />
                  )}
                  {field.isImageKey && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[field.key]?.click()}
                        className="shrink-0"
                      >
                        <Upload className="mr-2 h-4 w-4" /> Upload
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        ref={el => fileInputRefs.current[field.key] = el}
                        onChange={(e) => handleImageUpload(e, field.key)}
                        style={{ display: 'none' }}
                        id={`singleCard-file-${field.key}`}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTemplateId && dynamicFields.length === 0 && (
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields. Please edit the template to include them.</p>
        )}
         {!selectedTemplateId && (
            <p className="text-sm text-muted-foreground">Select a template above to start entering card data.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplateId || dynamicFields.length === 0} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
