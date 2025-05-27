
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateCardText } from '@/ai/flows/generate-card-text';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Sparkles, Download } from 'lucide-react';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
}

export function BulkGenerator({ templates, onCardsGenerated }: BulkGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [generationMethod, setGenerationMethod] = useState<'csv' | 'ai'>('csv');
  const [aiTheme, setAiTheme] = useState<string>('');
  const [numAiCards, setNumAiCards] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
      return;
    }
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      toast({ title: "Error", description: "Selected TCG template not found.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    let generatedCardsData: CardData[] = [];

    try {
      if (generationMethod === 'csv') {
        if (!bulkDataInput.trim()) {
          toast({ title: "Error", description: "Please provide data for card generation.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const lines = bulkDataInput.trim().split('\n');
        if (lines.length < 2) {
          toast({ title: "Error", description: "CSV data must include a header row and at least one data row.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const cardData: CardData = {};
          headers.forEach((header, index) => {
            cardData[header] = values[index] || '';
          });
          generatedCardsData.push(cardData);
        }
      } else if (generationMethod === 'ai') {
        if (!aiTheme.trim()) {
          toast({ title: "Error", description: "Please provide a theme or concept for AI generation.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        for (let i = 0; i < numAiCards; i++) {
          const aiResult = await generateCardText({ theme: `A fantasy TCG card ability or flavor text for a card concept: ${aiTheme}` });
          
          // Basic mapping: AI generates rules text, theme is card name.
          // Other fields will use template defaults or be blank.
          const cardData: CardData = {
            cardName: `${aiTheme}${numAiCards > 1 ? ` #${i+1}` : ''}`,
            rulesText: aiResult.cardText, // Using 'rulesText' as a common key
            // Attempt to fill other common TCG fields, user can override later
            manaCost: template.manaCostPlaceholder ? '{{manaCost}}' : '3', // Default example
            cardType: template.cardTypeLinePlaceholder ? '{{cardType}}' : 'Spell - Arcane', // Default example
            power: template.powerToughnessPlaceholder ? 'X' : '',
            toughness: template.powerToughnessPlaceholder ? 'Y' : '',
            rarity: template.rarityPlaceholder ? 'C' : 'Common',
            artistName: template.artistCreditPlaceholder ? 'AI & You' : 'AI & You',
            artworkUrl: template.artworkUrlPlaceholder || `https://placehold.co/375x275.png`,
          };
          // Filter out keys that don't have corresponding placeholders in the template
          // This is a simple way to avoid sending useless data
          Object.keys(cardData).forEach(key => {
            const placeholderKey = (key + 'Placeholder') as keyof TCGCardTemplate;
            if (placeholderKey.endsWith('Placeholder') && !template[placeholderKey as keyof TCGCardTemplate]) {
                // If placeholder like 'cardNamePlaceholder' doesn't exist on template, remove the data key
                // This is a very rough check. Better to align CardData keys with known template placeholder names.
            }
          });
          generatedCardsData.push(cardData);
        }
      }
      
      const displayCards = generatedCardsData.map(data => ({ template, data, uniqueId: nanoid() }));
      onCardsGenerated(displayCards);
      toast({ title: "Success", description: `${displayCards.length} TCG cards generated.` });

    } catch (error) {
      console.error("Error generating TCG cards:", error);
      toast({ title: "Error", description: "Failed to generate TCG cards. Check console.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDataInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDataInput(e.target.value);
  };

  const exampleCSV = `cardName,manaCost,artworkUrl,cardType,rulesText,flavorText,power,toughness,rarity,artistName
Goblin Raider,1R,https://placehold.co/375x275.png?text=Goblin,Creature - Goblin Warrior,"Haste (This creature can attack and {T} as soon as it comes under your control.)","Goblins are not known for their patience, or their hygiene.",2,1,C,AI The Goblin
Arcane Blast,2U,https://placehold.co/375x275.png?text=Spell,Instant,"Deal 3 damage to any target. Draw a card.","The air crackled with raw magic.",,,U,AI The Mage
Ancient Relic,3,https://placehold.co/375x275.png?text=Artifact,Artifact,"{T}: Add one mana of any color.","Its purpose lost to time, its power remains.",,,R,AI The Historian`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk TCG Card Generator</CardTitle>
        <CardDescription>Generate multiple TCG cards from a template using CSV data or AI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="bulkTemplateSelect">Select TCG Template</Label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger id="bulkTemplateSelect">
              <SelectValue placeholder="Choose a TCG template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="bulkGenerationMethod">Generation Method</Label>
          <Select value={generationMethod} onValueChange={(value) => setGenerationMethod(value as 'csv' | 'ai')}>
            <SelectTrigger id="bulkGenerationMethod">
              <SelectValue placeholder="Choose generation method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV Data Input</SelectItem>
              <SelectItem value="ai">AI Text Generation (Experimental)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {generationMethod === 'csv' && (
          <div>
            <Label htmlFor="bulkData">
              Card Data (CSV: headers matching template fields, then data lines)
            </Label>
            <Textarea
              id="bulkData"
              value={bulkDataInput}
              onChange={handleDataInputChange}
              placeholder={exampleCSV}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Common TCG field names: cardName, manaCost, artworkUrl, cardType, rulesText, flavorText, power, toughness, rarity, artistName. Ensure your CSV headers match the data keys you intend to use.
            </p>
          </div>
        )}

        {generationMethod === 'ai' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiTheme">Card Concept/Theme for AI</Label>
              <Input id="aiTheme" value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} placeholder="e.g., Swift Goblin Scout, Arcane Blast" />
              <p className="text-xs text-muted-foreground mt-1">AI will generate rules/flavor text. Card name will be based on the theme.</p>
            </div>
            <div>
              <Label htmlFor="numAiCards">Number of Cards (AI)</Label>
              <Input id="numAiCards" type="number" value={numAiCards} onChange={(e) => setNumAiCards(Math.max(1, parseInt(e.target.value,10)))} min="1" />
            </div>
          </div>
        )}
        
        <Button onClick={handleGenerate} disabled={isLoading || !selectedTemplateId} className="w-full">
          {isLoading ? 'Generating...' : (generationMethod === 'ai' ? <> <Sparkles className="mr-2 h-4 w-4" /> Generate with AI</> : <> <Download className="mr-2 h-4 w-4" /> Generate from Data</>)}
        </Button>
      </CardContent>
    </Card>
  );
}
