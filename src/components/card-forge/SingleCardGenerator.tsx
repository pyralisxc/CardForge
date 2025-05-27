
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
import { TCG_FIELD_DEFINITIONS } from '@/lib/constants';
import { useState, ChangeEvent } from 'react';
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

// Helper to extract placeholder keys from a template string
function extractPlaceholders(templateString?: string): string[] {
    if (!templateString) return [];
    const regex = /{{(.*?)}}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(templateString)) !== null) {
        matches.push(match[1].trim());
    }
    return matches;
}


export function SingleCardGenerator({ templates, onSingleCardAdded }: SingleCardGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [cardData, setCardData] = useState<CardData>({});
  const { toast } = useToast();

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setCardData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  };

  const handleAddCard = () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
      return;
    }

    // Basic validation: ensure at least a card name is provided if that placeholder exists
    const cardNameField = TCG_FIELD_DEFINITIONS.find(f => f.key === 'cardName');
    if (cardNameField && selectedTemplate[cardNameField.placeholderKey] && !cardData[cardNameField.key]) {
        toast({ title: "Error", description: "Card Name is required.", variant: "destructive" });
        return;
    }
    
    // Fill any missing data fields with empty strings or default from template if applicable
    const completeCardData: CardData = { ...cardData };
    TCG_FIELD_DEFINITIONS.forEach(fieldDef => {
        if (selectedTemplate[fieldDef.placeholderKey] && completeCardData[fieldDef.key] === undefined) {
            // If artworkUrl is missing and placeholder exists, use template's default artwork placeholder
            if (fieldDef.key === 'artworkUrl' && selectedTemplate.artworkUrlPlaceholder && !completeCardData.artworkUrl) {
                completeCardData.artworkUrl = selectedTemplate.artworkUrlPlaceholder;
            } else {
                 completeCardData[fieldDef.key] = ''; // Default to empty string for other missing fields
            }
        }
    });


    const displayCard: DisplayCard = {
      template: selectedTemplate,
      data: completeCardData,
      uniqueId: nanoid(),
    };
    onSingleCardAdded(displayCard);
    toast({ title: "Success", description: `TCG card "${completeCardData.cardName || 'Untitled Card'}" added.` });
    // Optionally reset form fields after adding, or keep them for quick iteration
    // setCardData({}); // Uncomment to reset form
  };

  // Determine which fields to show based on the selected template's placeholders
  const fieldsToShow = selectedTemplate 
    ? TCG_FIELD_DEFINITIONS.filter(fieldDef => {
        const placeholderValue = selectedTemplate[fieldDef.placeholderKey];
        if (typeof placeholderValue === 'string' && placeholderValue.trim() !== '') {
          // For P/T, check if the placeholder contains either power or toughness related keys
          if (fieldDef.placeholderKey === 'powerToughnessPlaceholder') {
            return extractPlaceholders(placeholderValue).some(p => p.toLowerCase().includes(fieldDef.key));
          }
          return extractPlaceholders(placeholderValue).includes(fieldDef.key) || 
                 (fieldDef.key === 'artworkUrl' && placeholderValue.includes("https://placehold.co")) || // Always show artwork if placeholder is a URL
                 placeholderValue.includes(`{{${fieldDef.key}}}`); // Direct match
        }
        return false;
      })
    : [];


  return (
    <Card>
      <CardHeader>
        <CardTitle>Single TCG Card Entry</CardTitle>
        <CardDescription>Select a template and fill in the details for one card.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select TCG Template</Label>
          <Select 
            value={selectedTemplateId} 
            onValueChange={(id) => {
              setSelectedTemplateId(id);
              setCardData({}); // Reset card data when template changes
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

        {selectedTemplate && fieldsToShow.length > 0 && (
          <div className="space-y-3 mt-4 border-t pt-4">
            {fieldsToShow.map(fieldDef => (
              <div key={fieldDef.key}>
                <Label htmlFor={`singleCard-${fieldDef.key}`}>{fieldDef.label}</Label>
                {fieldDef.type === 'textarea' ? (
                  <Textarea
                    id={`singleCard-${fieldDef.key}`}
                    value={(cardData[fieldDef.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, fieldDef.key)}
                    placeholder={`Enter ${fieldDef.label.toLowerCase()}...`}
                    rows={fieldDef.key === 'rulesText' ? 3 : 2}
                  />
                ) : (
                  <Input
                    id={`singleCard-${fieldDef.key}`}
                    value={(cardData[fieldDef.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, fieldDef.key)}
                    placeholder={`Enter ${fieldDef.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        
        {selectedTemplate && fieldsToShow.length === 0 && (
            <p className="text-sm text-muted-foreground">This template has no recognized placeholder fields for single card entry (e.g., `{{cardName}}`, `{{manaCost}}`). Please edit the template to include them.</p>
        )}


        <Button onClick={handleAddCard} disabled={!selectedTemplate || fieldsToShow.length === 0} className="w-full">
          <PlusSquare className="mr-2 h-4 w-4" /> Add Card to Preview List
        </Button>
      </CardContent>
    </Card>
  );
}
