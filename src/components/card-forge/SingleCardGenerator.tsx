
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
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
import { PlusSquare } from 'lucide-react';

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
}

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
}

export function SingleCardGenerator({ templates, onSingleCardAdded }: SingleCardGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const { toast } = useToast();

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      const allPlaceholderKeys = new Set<string>();
      // Iterate over all string properties of the template that might contain placeholders
      (Object.keys(selectedTemplate) as Array<keyof TCGCardTemplate>).forEach(propKey => {
        const value = selectedTemplate[propKey];
        if (typeof value === 'string') {
          extractUniquePlaceholderKeys(value).forEach(pKey => allPlaceholderKeys.add(pKey));
        }
      });

      const fields: DynamicField[] = Array.from(allPlaceholderKeys).map(key => {
        const definition = TCG_FIELD_DEFINITIONS.find(def => def.key === key);
        return {
          key,
          label: definition?.label || toTitleCase(key),
          type: definition?.type === 'textarea' ? 'textarea' : 'input',
        };
      });
      setDynamicFields(fields);
      
      const newCardData: CardData = {};
      fields.forEach(f => {
        if (f.key === 'artworkUrl' && selectedTemplate.artworkUrlPlaceholder) {
            newCardData[f.key] = cardData[f.key] || selectedTemplate.artworkUrlPlaceholder;
        } else {
            newCardData[f.key] = cardData[f.key] || '';
        }
      });
      setCardData(newCardData);

    } else {
      setDynamicFields([]);
      setCardData({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]); // Depend on selectedTemplateId to re-run when template changes

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setCardData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  };

  const handleAddCard = () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
      return;
    }

    // Basic validation: ensure at least a card name is provided if 'cardName' is a dynamic field
    const cardNameField = dynamicFields.find(f => f.key === 'cardName');
    if (cardNameField && !cardData[cardNameField.key]?.trim()) {
        toast({ title: "Error", description: `${cardNameField.label} is required.`, variant: "destructive" });
        return;
    }
    
    const completeCardData: CardData = { ...cardData };
    dynamicFields.forEach(field => {
        if (completeCardData[field.key] === undefined) {
          if (field.key === 'artworkUrl' && selectedTemplate.artworkUrlPlaceholder && !completeCardData.artworkUrl) {
            completeCardData.artworkUrl = selectedTemplate.artworkUrlPlaceholder;
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
    toast({ title: "Success", description: `TCG card "${completeCardData.cardName || completeCardData[dynamicFields.find(f => f.key.toLowerCase().includes('name'))?.key || ''] || 'Untitled Card'}" added.` });
    
    // Optionally reset form:
    // const freshCardData: CardData = {};
    // dynamicFields.forEach(f => { freshCardData[f.key] = (f.key === 'artworkUrl' && selectedTemplate.artworkUrlPlaceholder) ? selectedTemplate.artworkUrlPlaceholder : ''; });
    // setCardData(freshCardData);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Single TCG Card Entry</CardTitle>
        <CardDescription>Select a template and fill in the details for one card. Placeholders like {'{{variableName}}'} in the template will appear as fields here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select TCG Template</Label>
          <Select 
            value={selectedTemplateId} 
            onValueChange={(id) => {
              setSelectedTemplateId(id);
              // Card data & dynamic fields will be reset by the useEffect hook when selectedTemplateId changes
            }}
          >
            <SelectTrigger id="singleTemplateSelect">
              <SelectValue placeholder="Choose a TCG template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate && dynamicFields.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            {dynamicFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`singleCard-${field.key}`}>{field.label}</Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`singleCard-${field.key}`}
                    value={(cardData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    rows={field.key.toLowerCase().includes('rules') || field.key.toLowerCase().includes('text') ? 3 : 2}
                  />
                ) : (
                  <Input
                    id={`singleCard-${field.key}`}
                    value={(cardData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        
        {selectedTemplate && dynamicFields.length === 0 && (
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields (e.g., <code>{`{{cardName}}`}</code>, <code>{`{{manaCost}}`}</code>). Please edit the template to include them in its placeholder strings.</p>
        )}


        <Button onClick={handleAddCard} disabled={!selectedTemplate || dynamicFields.length === 0} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}

