
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, CardSection, AbilityContextSet } from '@/types';
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
import { Sparkles, Download, PackagePlus } from 'lucide-react'; 
import { extractUniquePlaceholderKeys } from '@/lib/utils';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
  abilityContextSets: AbilityContextSet[]; // New prop
}

export function BulkGenerator({ templates, onCardsGenerated, abilityContextSets }: BulkGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [generationMethod, setGenerationMethod] = useState<'csv' | 'ai'>('csv');
  const [aiTheme, setAiTheme] = useState<string>('');
  const [numAiCards, setNumAiCards] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedAbilityContextIdForBulk, setSelectedAbilityContextIdForBulk] = useState<string>(''); // New state


  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getPlaceholdersFromSelectedTemplate = (): string[] => {
    return selectedTemplate ? extractUniquePlaceholderKeys(selectedTemplate) : [];
  };
  
  const exampleCSVHeaders = getPlaceholdersFromSelectedTemplate().join(',');
  const exampleCSVDataLine = getPlaceholdersFromSelectedTemplate().map(h => {
    if (h.toLowerCase().includes('url') || h.toLowerCase().includes('artwork')) return 'https://placehold.co/600x400.png?text=Artwork';
    if (h.toLowerCase().includes('name')) return 'Sample Card';
    if (h.toLowerCase().includes('cost')) return '3';
    if (h.toLowerCase().includes('type')) return 'Sample Type';
    if (h.toLowerCase().includes('text')) return 'Sample effect text.';
    return 'value';
  }).join(',');

  const exampleCSV = exampleCSVHeaders + '\\n' + exampleCSVDataLine;


  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
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
        const lines = bulkDataInput.trim().split('\\n');
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
        
        const placeholders = getPlaceholdersFromSelectedTemplate();
        // Find common placeholder keys (case-insensitive for robustness)
        const findPlaceholder = (keywords: string[], excludeSubstrings?: string[]): string | undefined => {
            return placeholders.find(p => {
                const pLower = p.toLowerCase();
                const matchesKeyword = keywords.some(kw => pLower.includes(kw));
                const notExcluded = excludeSubstrings ? !excludeSubstrings.some(ex => pLower.includes(ex)) : true;
                return matchesKeyword && notExcluded;
            });
        };

        const namePlaceholder = findPlaceholder(['name', 'title'], ['artist']) || placeholders[0] || 'cardName';
        const rulesPlaceholder = findPlaceholder(['rules', 'effect', 'text'], ['flavor']) || placeholders[1] || 'rulesText';
        const flavorPlaceholder = findPlaceholder(['flavor']);
        const artworkPlaceholder = findPlaceholder(['art', 'image', 'url'], ['artist']);
        const costPlaceholder = findPlaceholder(['cost', 'mana']);
        const typePlaceholder = findPlaceholder(['type', 'kind'], ['sub']);
        const powerPlaceholder = findPlaceholder(['power', 'atk', 'attack'], ['toughness', 'defense', 'hp', 'health']);
        const toughnessPlaceholder = findPlaceholder(['toughness', 'def', 'defense', 'hp', 'health'], ['power', 'attack']);

        const selectedContext = abilityContextSets.find(cs => cs.id === selectedAbilityContextIdForBulk);

        for (let i = 0; i < numAiCards; i++) {
          const aiResult = await generateCardText({ 
            theme: `A fantasy TCG card with the concept: ${aiTheme}${numAiCards > 1 ? ` (variation ${i+1})` : ''}`,
            textType: 'FullConceptIdea',
            abilityContext: selectedContext?.description
          });
          
          const cardData: CardData = {};
          // Initialize all placeholders for the template to empty string
          placeholders.forEach(pKey => {
            cardData[pKey] = ''; 
          });

          // Default artwork if placeholder exists
          if (artworkPlaceholder) {
            cardData[artworkPlaceholder] = `https://placehold.co/600x400.png?text=${encodeURIComponent(aiTheme + (numAiCards > 1 ? ` ${i+1}` : ''))}`;
          }

          // Parse AI output (which is expected to be "Card Name: ...\nRules Text: ...\nFlavor Text: ...")
          const lines = aiResult.cardText.split('\\n');
          let parsedName = `${aiTheme}${numAiCards > 1 ? ` #${i+1}` : ''}`;
          let parsedRules = "AI generated text.";

          lines.forEach(line => {
            const [keyPart, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();
            if (keyPart.toLowerCase().startsWith("card name")) {
              parsedName = value;
            } else if (keyPart.toLowerCase().startsWith("rules text")) {
              parsedRules = value;
            } else if (keyPart.toLowerCase().startsWith("flavor text") && flavorPlaceholder) {
              cardData[flavorPlaceholder] = value;
            }
          });

          cardData[namePlaceholder] = parsedName;
          if (rulesPlaceholder) cardData[rulesPlaceholder] = parsedRules;
          
          // Fill other common placeholders with generic or random values
          if (costPlaceholder) cardData[costPlaceholder] = String(Math.floor(Math.random() * 5) + 1); // Random cost 1-5
          if (typePlaceholder) cardData[typePlaceholder] = ['Creature', 'Spell', 'Enchantment', 'Artifact'][Math.floor(Math.random() * 4)];
          if (powerPlaceholder) cardData[powerPlaceholder] = String(Math.floor(Math.random() * 5) + 1);
          if (toughnessPlaceholder) cardData[toughnessPlaceholder] = String(Math.floor(Math.random() * 5) + 1);

          generatedCardsData.push(cardData);
        }
      }
      
      const displayCards = generatedCardsData.map(data => ({ template: selectedTemplate, data, uniqueId: nanoid() }));
      onCardsGenerated(displayCards);
      toast({ title: "Success", description: `${displayCards.length} TCG cards generated.` });

    } catch (error) {
      console.error("Error generating TCG cards:", error);
      toast({ title: "Error", description: `Failed to generate TCG cards: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDataInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDataInput(e.target.value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Card Generation</CardTitle>
        <CardDescription>Generate multiple cards from a template using CSV data or AI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="bulkTemplateSelect">Select Template</Label>
          <Select value={selectedTemplateId} onValueChange={(id) => {
            setSelectedTemplateId(id);
            setSelectedAbilityContextIdForBulk('');
          }}>
            <SelectTrigger id="bulkTemplateSelect">
              <SelectValue placeholder="Choose a template" />
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
              Card Data (CSV Format - use '\n' (literal backslash n) for line breaks within a field, not actual newlines in textarea)
            </Label>
            <Textarea
              id="bulkData"
              value={bulkDataInput}
              onChange={handleDataInputChange}
              placeholder={selectedTemplate ? exampleCSV.replace(/\\n/g, '\n') : "Select a template to see example CSV structure."}
              rows={8}
              className="font-mono text-sm"
              disabled={!selectedTemplate}
            />
            {selectedTemplate && <p className="text-xs text-muted-foreground mt-1">
              Your CSV headers should be: <strong>{exampleCSVHeaders || "No placeholders found in template"}</strong>. Use '\n' for line breaks in text.
            </p>}
            {!selectedTemplate && <p className="text-xs text-muted-foreground mt-1">Select a template first to see the expected CSV format based on its placeholders.</p>}
          </div>
        )}

        {generationMethod === 'ai' && selectedTemplate && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiTheme">Card Concept/Theme for AI</Label>
              <Input id="aiTheme" value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} placeholder="e.g., Swift Goblin Scout, Arcane Blast" />
              <p className="text-xs text-muted-foreground mt-1">AI will generate text for name, rules, and flavor. Other fields may get generic values. Artwork is a placeholder.</p>
            </div>
            {abilityContextSets.length > 0 && (
               <div>
                <Label htmlFor="bulkAbilityContextSelect">Optional: AI Context Set</Label>
                <Select value={selectedAbilityContextIdForBulk} onValueChange={setSelectedAbilityContextIdForBulk}>
                  <SelectTrigger id="bulkAbilityContextSelect">
                    <SelectValue placeholder="None (general AI knowledge)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (general AI knowledge)</SelectItem>
                    {abilityContextSets.map(cs => <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
