
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, CardSection } from '@/types';
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
import { PlusSquare, FilePlus2 } from 'lucide-react'; // Added FilePlus2

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
}

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
  example?: string;
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
      selectedTemplate.sections.forEach(section => {
        extractUniquePlaceholderKeys(section.contentPlaceholder).forEach(pKey => allPlaceholderKeys.add(pKey));
      });

      const fields: DynamicField[] = Array.from(allPlaceholderKeys).map(key => {
        const definition = TCG_FIELD_DEFINITIONS.find(def => def.key === key);
        return {
          key,
          label: definition?.label || toTitleCase(key.replace(/_/g, ' ')),
          type: definition?.type === 'textarea' ? 'textarea' : 'input',
          example: definition?.example || `e.g., ${toTitleCase(key.replace(/_/g, ' '))}`,
        };
      });
      setDynamicFields(fields);
      
      const newCardData: CardData = {};
      fields.forEach(f => {
        newCardData[f.key] = cardData[f.key] || ''; 
        const artSection = selectedTemplate.sections.find(s => s.type === 'Artwork');
        if (f.key === 'artworkUrl' && artSection && artSection.contentPlaceholder.includes('{{artworkUrl}}') && !newCardData[f.key]) {
            const defaultArtUrlMatch = artSection.contentPlaceholder.match(/^(https?:\/\/[^\s{}]+\.(?:png|jpg|jpeg|gif|svg))/i);
            if (defaultArtUrlMatch && defaultArtUrlMatch[0] !== artSection.contentPlaceholder) {
                 newCardData[f.key] = defaultArtUrlMatch[0];
            } else {
                 newCardData[f.key] = 'https://placehold.co/300x200.png';
            }
        }
      });
      setCardData(newCardData);

    } else {
      setDynamicFields([]);
      setCardData({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, templates]); 

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
          completeCardData[field.key] = ''; 
        }
    });

    const displayCard: DisplayCard = {
      template: selectedTemplate,
      data: completeCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);
    
    let cardIdentifier = "Untitled Card";
    const nameFieldKey = dynamicFields.find(f => f.key.toLowerCase().includes("name"))?.key;
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
        <CardDescription>Select a template and fill in data for its placeholders (e.g., {'{{cardName}}'}).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template</Label>
          <Select 
            value={selectedTemplateId} 
            onValueChange={(id) => {
              setSelectedTemplateId(id);
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
                <Label htmlFor={`singleCard-${field.key}`}>{field.label}</Label>
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
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields (e.g., <code>{`{{cardName}}`}</code>, <code>{`{{manaCost}}`}</code>). Please edit the template to include them in its section content placeholders.</p>
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
