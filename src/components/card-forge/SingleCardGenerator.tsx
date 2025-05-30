
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, ExtractedPlaceholder, CardSection } from '@/types';
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
import { PlusSquare, FilePlus2 } from 'lucide-react';

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange?: (templateId: string | null) => void;
}

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea'; // For text placeholders
  isImageKey: boolean; // True if this key is for an image section's URL
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

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const prevCardDataRef = useRef<CardData | null>(null);

  useEffect(() => {
    prevCardDataRef.current = cardData;
  }, [cardData]);

  useEffect(() => {
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
            placeholder.key.toLowerCase().includes('text') || // broad 'text'
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
          label: `${toTitleCase(placeholder.key)}${isImageSectionKey ? ' (Image URL)' : ''}`,
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
  }, [selectedTemplateId, selectedTemplate]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setCardData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  };

  const handleAddCard = () => {
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
            // Ensure image keys have a fallback if empty even after defaults were missed
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
    const nameFieldKey = dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname"))?.key ||
                         dynamicFields.find(f => f.key.toLowerCase().includes("title"))?.key;

    if (nameFieldKey && completeCardData[nameFieldKey]) {
        cardIdentifier = String(completeCardData[nameFieldKey]);
    } else if (dynamicFields.length > 0 && completeCardData[dynamicFields[0].key]) {
        cardIdentifier = String(completeCardData[dynamicFields[0].key]);
    }
    toast({ title: "Success", description: `Card "${cardIdentifier}" added to preview.` });
  };
  
  const handleTemplateSelectChange = (id: string) => {
    setSelectedTemplateId(id);
    setCardData({}); // Clear previous card data to ensure new template defaults/fields are applied
    if (onTemplateSelectionChange) {
      onTemplateSelectionChange(id);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Select a template and fill in data. For 'Image' sections, provide a URL. For 'Placeholder' sections, use text (and <code>{`{{vars}}`}</code> if needed).</CardDescription>
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
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate && dynamicFields.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Enter data for template: <strong className="text-foreground">{selectedTemplate.name}</strong></p>
            {dynamicFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`singleCard-${field.key}`}>
                  {field.label}
                  {field.defaultValue !== undefined && <span className="text-xs text-muted-foreground ml-1">(Default: "{field.defaultValue}")</span>}
                </Label>
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
                    placeholder={field.isImageKey ? `URL for ${field.key}` : `Enter value for ${field.key}...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {selectedTemplate && dynamicFields.length === 0 && (
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields. Please edit the template to include them (e.g., <code>{`{{cardName}}`}</code> for text, or define an 'Image' section with an Image URL Key).</p>
        )}
         {!selectedTemplate && (
            <p className="text-sm text-muted-foreground">Select a template above to start entering card data.</p>
        )}

        <Button onClick={handleAddCard} disabled={!selectedTemplate || dynamicFields.length === 0} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
