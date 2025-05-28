
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
import { PlusSquare, FilePlus2, Sparkles } from 'lucide-react'; 
import { generateCardFields } from '@/ai/flows/generate-card-fields';

interface SingleCardGeneratorProps {
  templates: TCGCardTemplate[];
  onSingleCardAdded: (card: DisplayCard) => void;
  onTemplateSelectionChange?: (templateId: string) => void;
}

interface DynamicField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
  example?: string;
}

export function SingleCardGenerator({ templates, onSingleCardAdded, onTemplateSelectionChange }: SingleCardGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [cardData, setCardData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const { toast } = useToast();

  const [aiThemeForFill, setAiThemeForFill] = useState<string>('');
  const [isAiFilling, setIsAiFilling] = useState<boolean>(false);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      const allPlaceholderKeys = extractUniquePlaceholderKeys(selectedTemplate);

      const fields: DynamicField[] = allPlaceholderKeys.map(key => {
        const definition = TCG_FIELD_DEFINITIONS.find(def => def.key.toLowerCase() === key.toLowerCase());
        let exampleText = `e.g., ${toTitleCase(key)}`;
        if (key.toLowerCase().includes('url') || key.toLowerCase().includes('artwork')) {
            exampleText = 'e.g., https://placehold.co/300x200.png or data:image/...';
        }
        
        return {
          key,
          label: definition?.label || toTitleCase(key),
          type: definition?.type === 'textarea' ? 'textarea' : 'input',
          example: definition?.example || exampleText,
        };
      });
      setDynamicFields(fields);
      
      const newCardData: CardData = {};
      fields.forEach(f => {
        newCardData[f.key] = cardData[f.key] || ''; 
        // Attempt to pre-fill artwork URL from template's default if the placeholder matches common keys
        const artPlaceholderSection = selectedTemplate.rows
            .flatMap(r => r.columns)
            .find(s => s.type === 'Artwork' && s.contentPlaceholder.includes(`{{${f.key}}}`));

        if (artPlaceholderSection && (f.key.toLowerCase().includes('url') || f.key.toLowerCase().includes('artwork')) && !newCardData[f.key]) {
            // Check if the placeholder string itself contains a default URL (a simple heuristic)
            const defaultArtUrlMatch = artPlaceholderSection.contentPlaceholder.match(/^(https?:\/\/[^\s{}]+\.(?:png|jpg|jpeg|gif|svg|webp))/i);
            if (defaultArtUrlMatch && defaultArtUrlMatch[0] !== artPlaceholderSection.contentPlaceholder && !defaultArtUrlMatch[0].startsWith('{{')) {
                 newCardData[f.key] = defaultArtUrlMatch[0];
            } else if (f.key.toLowerCase() === 'artworkurl') { 
                 // Fallback for common placeholder name if no default in string
                 newCardData[f.key] = 'https://placehold.co/600x400.png';
            }
        }
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
    const nameFieldKey = dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artist"))?.key || 
                         dynamicFields.find(f => f.key.toLowerCase().includes("title"))?.key;

    if (nameFieldKey && completeCardData[nameFieldKey]) {
        cardIdentifier = String(completeCardData[nameFieldKey]);
    } else if (dynamicFields.length > 0 && completeCardData[dynamicFields[0].key]) {
        cardIdentifier = String(completeCardData[dynamicFields[0].key]);
    }

    toast({ title: "Success", description: `Card "${cardIdentifier}" added to preview.` });
  };

  const handleAiFillFields = async () => {
    if (!selectedTemplate) {
      toast({ title: "No Template Selected", description: "Please select a template first.", variant: "default" });
      return;
    }
    if (dynamicFields.length === 0) {
      toast({ title: "No Placeholders", description: "Selected template has no fields for AI to fill.", variant: "default" });
      return;
    }
    if (!aiThemeForFill.trim()) {
      toast({ title: "Theme Required", description: "Please enter a card concept or theme for AI.", variant: "default" });
      return;
    }

    setIsAiFilling(true);
    try {
      const placeholderKeys = dynamicFields.map(f => f.key);
      const result = await generateCardFields({ theme: aiThemeForFill, placeholderKeys });
      
      setCardData(prevData => ({
        ...prevData,
        ...result.generatedData
      }));

      toast({ title: "AI Fill Complete", description: "Card fields populated by AI." });
    } catch (error) {
      console.error("Error with AI Fill:", error);
      toast({ title: "AI Fill Error", description: (error as Error).message || "Failed to get AI suggestions.", variant: "destructive" });
    } finally {
      setIsAiFilling(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />Single Card Entry</CardTitle>
        <CardDescription>Select a template and fill in data for its placeholders (e.g., <code>{`{{cardName}}`}</code>).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="singleTemplateSelect">Select Template</Label>
          <Select 
            value={selectedTemplateId} 
            onValueChange={(id) => {
              setSelectedTemplateId(id);
              setAiThemeForFill(''); // Clear AI theme when template changes
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

        {selectedTemplate && (
          <div className="space-y-2 pt-2 border-t mt-2">
            <Label htmlFor="aiThemeForFill">Card Concept/Theme for AI Fill</Label>
            <div className="flex gap-2">
              <Input
                id="aiThemeForFill"
                value={aiThemeForFill}
                onChange={(e) => setAiThemeForFill(e.target.value)}
                placeholder="e.g., 'Undead Pirate Captain', 'Mystic Healing Potion'"
                disabled={!selectedTemplate || dynamicFields.length === 0}
              />
              <Button
                onClick={handleAiFillFields}
                disabled={!selectedTemplate || dynamicFields.length === 0 || !aiThemeForFill.trim() || isAiFilling}
                variant="outline"
                className="shrink-0"
              >
                <Sparkles className="mr-2 h-4 w-4" /> {isAiFilling ? 'Filling...' : 'AI Fill Fields'}
              </Button>
            </div>
          </div>
        )}

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
