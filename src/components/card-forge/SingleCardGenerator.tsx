
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
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2, Upload } from 'lucide-react';

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange?: (templateId: string | null) => void;
}

interface DynamicField {
  key: string;
  label: string; // Will be {{key}}
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
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});


  useEffect(() => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (selectedTemplate) {
      const extractedPlaceholders = extractUniquePlaceholderKeys(selectedTemplate);
      const newCardData: CardData = {};

      const fields: DynamicField[] = extractedPlaceholders.map(placeholder => {
        const isImageSectionKey = selectedTemplate.rows.some(row =>
            row.columns.some(col =>
                col.sectionContentType === 'image' && col.contentPlaceholder === placeholder.key
            )
        );

        const isTextarea = !isImageSectionKey && (
            placeholder.key.toLowerCase().includes('rules') ||
            placeholder.key.toLowerCase().includes('text') || // General text
            placeholder.key.toLowerCase().includes('effect') ||
            placeholder.key.toLowerCase().includes('abilit') || // covers abilities, ability
            placeholder.key.toLowerCase().includes('description')
        );

        let initialValue = cardData[placeholder.key]; // Try to preserve existing typed data
        if (initialValue === undefined && placeholder.defaultValue !== undefined) {
          initialValue = placeholder.defaultValue;
        }

        if (isImageSectionKey && (initialValue === undefined || String(initialValue).trim() === '' || String(initialValue).trim() === `{{${placeholder.key}}}`)) {
           initialValue = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(placeholder.key))}`;
        }
        if (initialValue === undefined) {
          initialValue = '';
        }
        newCardData[placeholder.key] = initialValue;

        return {
          key: placeholder.key,
          label: `{{${placeholder.key}}}`, // Label is the placeholder key itself
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
  }, [selectedTemplateId, templates]); // templates added as dep


  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setCardData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  }, []);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setCardData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded as Data URI for ${fieldKey}.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = ""; // Reset file input
    }
  }, [toast]);

  const handleAddCard = useCallback(() => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
      return;
    }

    const completeCardData: CardData = { ...cardData };
    dynamicFields.forEach(field => {
        const currentValue = String(completeCardData[field.key] || '').trim();
        if (currentValue === '' || currentValue === `{{${field.key}}}`) { // If empty or still the placeholder label
          if (field.defaultValue !== undefined) {
            completeCardData[field.key] = field.defaultValue;
          } else if (field.isImageKey) {
            // Ensure artwork placeholders get a default visual even if user didn't touch the field
            completeCardData[field.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(field.key))}`;
          } else {
            completeCardData[field.key] = ''; // Default to empty string for other text fields
          }
        }
    });

    const displayCard: DisplayCard = {
      template: selectedTemplate,
      data: completeCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);

    const cardIdentifier = String(completeCardData[dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.isImageKey)?.key || ''] || 
                           completeCardData[dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImageKey)?.key || ''] || 
                           `Card ${displayCard.uniqueId.substring(0,5)}`);
                           
    toast({ title: "Success", description: `Card "${cardIdentifier}" added to preview.` });
  }, [selectedTemplateId, templates, cardData, dynamicFields, onSingleCardAdded, toast]);

  const handleTemplateSelectChange = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setCardData({}); // Clear previous card data when template changes
    if (onTemplateSelectionChange) {
      onTemplateSelectionChange(id);
    }
  }, [onTemplateSelectionChange]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Select a template and fill in data for its placeholders.</CardDescription>
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
                templates.map(t => <SelectItem key={t.id || 'new'} value={t.id!}>{t.id || "New Template"}</SelectItem>) // Display ID if name is missing
              ) : (
                <SelectItem value="no-templates" disabled>No templates available. Create one first.</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplateId && dynamicFields.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Enter data for template: <strong className="text-foreground">{templates.find(t=>t.id === selectedTemplateId)?.id || "Selected Template"}</strong></p> {/* Display ID if name is missing */}
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
                        aria-label={`Upload image for ${field.label}`}
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
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields (e.g., `{{cardName}}`). Please edit the template to include them.</p>
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
