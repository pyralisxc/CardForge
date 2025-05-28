
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, CardSection, AbilityContextSet } from '@/types';
import { TCG_FIELD_DEFINITIONS } from '@/lib/constants';
import { extractUniquePlaceholderKeys, toTitleCase } from '@/lib/utils';
import { useState, ChangeEvent, useEffect } from 'react';
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
  onTemplateSelectionChange?: (templateId: string) => void;
  abilityContextSets: AbilityContextSet[]; // Kept in case other features might use it, but AI fill part is removed
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
  abilityContextSets // Kept for prop consistency, though not directly used by removed AI fill
}: SingleCardGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const { toast } = useToast();

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      const extractedPlaceholders = extractUniquePlaceholderKeys(selectedTemplate);

      const fields: DynamicField[] = extractedPlaceholders.map(placeholder => {
        const definition = TCG_FIELD_DEFINITIONS.find(def => def.key.toLowerCase() === placeholder.key.toLowerCase());
        let exampleText = `e.g., ${toTitleCase(placeholder.key)}`;
        if (placeholder.key.toLowerCase().includes('url') || placeholder.key.toLowerCase().includes('artwork')) {
            exampleText = 'e.g., https://placehold.co/300x200.png, data:image/..., or a text description for AI Image Gen';
        }
        
        return {
          key: placeholder.key,
          label: definition?.label || toTitleCase(placeholder.key),
          type: definition?.type === 'textarea' ? 'textarea' : 'input',
          example: definition?.example || exampleText,
          defaultValue: placeholder.defaultValue,
        };
      });
      setDynamicFields(fields);
      
      const newCardData: CardData = {};
      fields.forEach(f => {
        let initialValue = cardData[f.key]; // Preserve existing data if user was typing
        if (initialValue === undefined && f.defaultValue !== undefined) {
          initialValue = f.defaultValue;
        }
        if (initialValue === undefined) {
          initialValue = '';
        }
        newCardData[f.key] = initialValue;
        
        // Special handling for artwork URL if it's a known placeholder and empty/no default
        if ((f.key.toLowerCase().includes('url') || f.key.toLowerCase().includes('artwork')) && !newCardData[f.key] && !f.defaultValue) {
           const artSectionInTemplate = selectedTemplate.rows
            .flatMap(r => r.columns)
            .find(s => s.type === 'Artwork' && s.contentPlaceholder.includes(`{{${f.key}}}`));

            if (artSectionInTemplate) {
                const defaultArtUrlMatch = artSectionInTemplate.contentPlaceholder.match(/^(https?:\/\/[^\s{}]+\.(?:png|jpg|jpeg|gif|svg|webp))/i);
                if (defaultArtUrlMatch && defaultArtUrlMatch[0] === artSectionInTemplate.contentPlaceholder) {
                     newCardData[f.key] = defaultArtUrlMatch[0];
                } else {
                    newCardData[f.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(selectedTemplate.name + " Art")}`;
                }
            } else if (f.key.toLowerCase() === 'artworkurl' && !newCardData[f.key]) { // Broader fallback
                newCardData[f.key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(selectedTemplate.name + " Art")}`;
            }
        }
      });
      setCardData(newCardData); 

      if (onTemplateSelectionChange) {
        onTemplateSelectionChange(selectedTemplate.id);
      }

    } else {
      setDynamicFields([]);
      setCardData({}); // Clear card data if no template is selected
      if (onTemplateSelectionChange) {
        onTemplateSelectionChange(''); 
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]); // Removed 'templates' and 'cardData' to be more targeted


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
        if (completeCardData[field.key] === undefined) { 
          completeCardData[field.key] = field.defaultValue !== undefined ? field.defaultValue : ''; 
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
        <CardDescription>Select a template and fill in data. Placeholders like <code>{`{{key:"default"}}`}</code> use defaults from the template.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template</Label>
          <Select 
            value={selectedTemplateId} 
            onValueChange={(id) => {
              setSelectedTemplateId(id);
              // Clear cardData when template changes to correctly apply defaults of new template
              setCardData({}); 
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

        {selectedTemplate && dynamicFields.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Enter data for placeholders in template: <strong className="text-foreground">{selectedTemplate.name}</strong></p>
            {dynamicFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`singleCard-${field.key}`}>
                  {field.label} 
                  {field.defaultValue !== undefined && 
                    <span className="text-xs text-muted-foreground ml-1">(Default: "{field.defaultValue}")</span>
                  }
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`singleCard-${field.key}`}
                    value={(cardData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter ${field.label.toLowerCase()}...`}
                    rows={field.key.toLowerCase().includes('rules') || field.key.toLowerCase().includes('text') || field.key.toLowerCase().includes('effect') ? 3 : 2}
                  />
                ) : (
                  <Input
                    id={`singleCard-${field.key}`}
                    value={(cardData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter ${field.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        
        {selectedTemplate && dynamicFields.length === 0 && (
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields (e.g., <code>{`{{cardName}}`}</code> or <code>{`{{key:"default"}}`}</code>). Please edit the template to include them.</p>
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
