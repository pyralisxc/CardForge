
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types'; // Removed AbilityContextSet
import { extractUniquePlaceholderKeys } from '@/lib/utils';
import { useState, ChangeEvent, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusSquare, FilePlus2 } from 'lucide-react'; // Removed Sparkles

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange?: (templateId: string) => void;
  // abilityContextSets prop removed
}

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
  example?: string;
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

      const fields: DynamicField[] = extractedPlaceholders.map(placeholder => {
        const isTextarea = placeholder.key.toLowerCase().includes('rules') ||
                           placeholder.key.toLowerCase().includes('text') ||
                           placeholder.key.toLowerCase().includes('effect') ||
                           placeholder.key.toLowerCase().includes('abilit') ||
                           placeholder.key.toLowerCase().includes('description');

        let exampleText = `e.g., value for ${placeholder.key}`;
         if (placeholder.key.toLowerCase().includes('url') || placeholder.key.toLowerCase().includes('artwork')) {
            exampleText = 'e.g., https://placehold.co/300x200.png or data:image/...';
        }

        return {
          key: placeholder.key,
          label: `{{${placeholder.key}}}`,
          type: isTextarea ? 'textarea' : 'input',
          example: exampleText,
          defaultValue: placeholder.defaultValue,
        };
      });
      setDynamicFields(fields);

      const newCardData: CardData = {};
      const prevData = prevCardDataRef.current || {}; // Keep any existing typed data if possible

      fields.forEach(f => {
        let initialValue = prevData[f.key]; // Prioritize already existing data for this key
        
        if (initialValue === undefined && f.defaultValue !== undefined) {
          initialValue = f.defaultValue; // Then template default
        }

        const keyLower = f.key.toLowerCase();
        if ((keyLower.includes('url') || keyLower.includes('artwork') || keyLower.includes('art') || keyLower.includes('image')) && (initialValue === undefined || initialValue === '')) {
           // Only apply placehold.co if no existing data and no template default
           initialValue = `https://placehold.co/600x400.png?text=${encodeURIComponent(selectedTemplate.name + " Art")}`;
        }
         if (initialValue === undefined) { // Final fallback to empty string
          initialValue = '';
        }
        newCardData[f.key] = initialValue;
      });
      setCardData(newCardData);

      if (onTemplateSelectionChange) {
        onTemplateSelectionChange(selectedTemplate.id);
      }

    } else {
      setDynamicFields([]);
      setCardData({});
      if (onTemplateSelectionChange) {
        onTemplateSelectionChange('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, selectedTemplate]); // prevCardDataRef removed from deps to avoid stale closures


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
    const nameFieldKey = dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artist"))?.key ||
                         dynamicFields.find(f => f.key.toLowerCase().includes("title"))?.key;

    if (nameFieldKey && completeCardData[nameFieldKey]) {
        cardIdentifier = String(completeCardData[nameFieldKey]);
    } else if (dynamicFields.length > 0 && completeCardData[dynamicFields[0].key]) {
        cardIdentifier = String(completeCardData[dynamicFields[0].key]);
    }

    toast({ title: "Success", description: `Card "${cardIdentifier}" added to preview.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Select a template and fill in data. Placeholders with defaults (e.g., <code>{`{{key:"default"}}`}</code>) will pre-fill fields.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template</Label>
          <Select
            value={selectedTemplateId}
            onValueChange={(id) => {
              setSelectedTemplateId(id);
              // setCardData({}); // Clear previous card data to ensure new template defaults are applied - Re-evaluate if this is best UX
              if (onTemplateSelectionChange) {
                onTemplateSelectionChange(id);
              }
            }}
          >
            <SelectTrigger id="singleTemplateSelect">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* AI Fill Fields UI Removed */}

        {selectedTemplate && dynamicFields.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Enter data for template: <strong className="text-foreground">{selectedTemplate.name}</strong></p>
            {dynamicFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`singleCard-${field.key}`}>
                  {field.label}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`singleCard-${field.key}`}
                    value={(cardData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter value for ${field.key}...`}
                    rows={field.key.toLowerCase().includes('rules') || field.key.toLowerCase().includes('text') || field.key.toLowerCase().includes('effect') || field.key.toLowerCase().includes('abilit') || field.key.toLowerCase().includes('description') ? 3 : 2}
                  />
                ) : (
                  <Input
                    id={`singleCard-${field.key}`}
                    value={(cardData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter value for ${field.key}...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {selectedTemplate && dynamicFields.length === 0 && (
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields (e.g., <code>{`{{cardName}}`}</code>). Please edit the template to include them.</p>
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
