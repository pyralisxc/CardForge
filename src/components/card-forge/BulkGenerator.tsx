
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types'; // Changed
import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // Added Input for AI theme and num cards
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateCardText } from '@/ai/flows/generate-card-text';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Sparkles, Download } from 'lucide-react';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[]; // Changed
  onCardsGenerated: (cards: DisplayCard[]) => void;
}

export function BulkGenerator({ templates, onCardsGenerated }: BulkGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [generationMethod, setGenerationMethod] = useState<'csv' | 'ai'>('csv');
  const [aiTheme, setAiTheme] = useState<string>(''); // e.g., "Goblin Warrior", "Fireball Spell"
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
    let generatedCards: DisplayCard[] = [];

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
          generatedCards.push({ template, data: cardData, uniqueId: nanoid() });
        }
      } else if (generationMethod === 'ai') {
        if (!aiTheme.trim()) {
          toast({ title: "Error", description: "Please provide a theme or concept for AI generation.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        for (let i = 0; i < numAiCards; i++) {
          // The existing generateCardText flow is very generic.
          // We'll use its output for rules text and the theme for the card name.
          // A more advanced flow would generate all TCG fields.
          const aiResult = await generateCardText({ theme: `TCG card ability for: ${aiTheme}` });
          
          const cardData: CardData = {
            // Populate some fields based on AI theme and result
            cardName: aiTheme, // Use theme as card name
            abilityDescription: aiResult.cardText, // Use AI output for rules text
            // Other fields will use template defaults or be blank if not in template
            manaCost: template.manaCostPlaceholder ? '{{manaCost}}' : '', // Default to placeholder if exists
            subType: template.cardTypeLinePlaceholder?.includes("{{subType}}") ? 'AI Generated' : '',
            power: template.powerToughnessPlaceholder ? 'X' : '',
            toughness: template.powerToughnessPlaceholder ? 'Y' : '',
            rarity: template.rarityPlaceholder ? 'C' : '',
            artistName: template.artistCreditPlaceholder ? 'AI & You' : '',
          };
          generatedCards.push({ template, data: cardData, uniqueId: nanoid() });
        }
      }
      onCardsGenerated(generatedCards);
      toast({ title: "Success", description: `${generatedCards.length} TCG cards generated.` });
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

  // Updated CSV example for TCG fields
  const exampleCSV = "cardName,manaCost,subType,abilityDescription,power,toughness,rarity,artistName,flavorText\nGoblin Raider,1R,Goblin Warrior,Haste,2,1,C,AI Artist,\"He raids.\"\nArcane Bolt,U,Sorcery,Deal 2 damage to any target.,,,U,AI Mage,\"Zap!\"";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk TCG Card Generator</CardTitle>
        <CardDescription>Generate multiple TCG cards from a template using CSV data or AI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="templateSelect">Select TCG Template</Label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger id="templateSelect">
              <SelectValue placeholder="Choose a TCG template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="generationMethod">Generation Method</Label>
          <Select value={generationMethod} onValueChange={(value) => setGenerationMethod(value as 'csv' | 'ai')}>
            <SelectTrigger id="generationMethod">
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
              Card Data (CSV: headers then data lines)
            </Label>
            <Textarea
              id="bulkData"
              value={bulkDataInput}
              onChange={handleDataInputChange}
              placeholder={exampleCSV}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ensure CSV headers match placeholders in your selected template (e.g., cardName, manaCost, etc.).
            </p>
          </div>
        )}

        {generationMethod === 'ai' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiTheme">Card Concept/Theme for AI</Label>
              <Input id="aiTheme" value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} placeholder="e.g., Swift Goblin Scout, Arcane Blast" />
              <p className="text-xs text-muted-foreground mt-1">AI will generate rules text. Card name will be based on the theme.</p>
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
