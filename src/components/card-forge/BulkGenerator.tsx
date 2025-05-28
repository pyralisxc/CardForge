
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, AbilityContextSet, ExtractedPlaceholder } from '@/types';
import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateCardFields } from '@/ai/flows/generate-card-fields'; // Changed import
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Sparkles, Download, PackagePlus } from 'lucide-react'; 
import { extractUniquePlaceholderKeys } from '@/lib/utils';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
  abilityContextSets: AbilityContextSet[];
}

const NO_CONTEXT_SELECTED_VALUE = "_NO_CONTEXT_";

export function BulkGenerator({ templates, onCardsGenerated, abilityContextSets }: BulkGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [generationMethod, setGenerationMethod] = useState<'csv' | 'ai'>('csv');
  const [aiTheme, setAiTheme] = useState<string>('');
  const [numAiCards, setNumAiCards] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedAbilityContextIdForBulk, setSelectedAbilityContextIdForBulk] = useState<string>('');


  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getPlaceholdersFromSelectedTemplate = (): ExtractedPlaceholder[] => {
    return selectedTemplate ? extractUniquePlaceholderKeys(selectedTemplate) : [];
  };
  
  const placeholderObjects = getPlaceholdersFromSelectedTemplate();
  const exampleCSVHeaders = placeholderObjects.map(p => p.key).join(',');
  
  const exampleCSVDataLine = placeholderObjects.map(p => {
    const keyLower = p.key.toLowerCase();
    if (keyLower.includes('url') || keyLower.includes('artwork')) return 'https://placehold.co/600x400.png?text=Artwork';
    if (keyLower.includes('name')) return 'Sample Card';
    if (keyLower.includes('cost')) return '3';
    if (keyLower.includes('type')) return 'Sample Type';
    if (keyLower.includes('text')) return 'Sample effect text.';
    return p.defaultValue || 'value';
  }).join(',');

  const exampleCSV = exampleCSVHeaders + '\n' + exampleCSVDataLine;


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
        const lines = bulkDataInput.trim().split('\n'); // Changed to split by actual newline
        if (lines.length < 2) {
          toast({ title: "Error", description: "CSV data must include a header row and at least one data row.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue; // Skip empty lines
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
        
        const currentPlaceholders = getPlaceholdersFromSelectedTemplate().map(p => p.key);
        if (currentPlaceholders.length === 0) {
            toast({ title: "Error", description: "Selected template has no placeholders for AI to fill.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
        
        const selectedContext = abilityContextSets.find(cs => cs.id === selectedAbilityContextIdForBulk);

        for (let i = 0; i < numAiCards; i++) {
          const themeForThisCard = `${aiTheme}${numAiCards > 1 ? ` (variation ${i+1})` : ''}`;
          try {
            const aiResult = await generateCardFields({ 
              theme: themeForThisCard,
              placeholderKeys: currentPlaceholders,
              abilityContext: selectedContext?.description
            });
            
            generatedCardsData.push(aiResult.generatedData);
          } catch (aiError) {
            console.error(`AI generation failed for card ${i+1} with theme "${themeForThisCard}":`, aiError);
            toast({ title: "AI Generation Error", description: `Failed to generate data for card variation ${i+1}. Using fallbacks.`, variant: "default" });
            // Add a fallback card data object if AI fails for one variation
            const fallbackData: CardData = {};
            currentPlaceholders.forEach(key => {
                const keyLower = key.toLowerCase();
                if (keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl")) {
                    fallbackData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(themeForThisCard + " (Art)")}`;
                } else if (keyLower.includes("name")) fallbackData[key] = themeForThisCard;
                else if (keyLower.includes("rules") || (keyLower.includes("text") && !keyLower.includes("flavor")) || keyLower.includes("effect") || keyLower.includes("abilit")) fallbackData[key] = `Default effect for ${themeForThisCard}.`;
                else if (keyLower.includes("flavor")) fallbackData[key] = `Default flavor for ${themeForThisCard}.`;
                else fallbackData[key] = `Missing: ${key}`;
            });
            generatedCardsData.push(fallbackData);
          }
        }
      }
      
      const displayCards = generatedCardsData.map(data => ({ template: selectedTemplate, data, uniqueId: nanoid() }));
      onCardsGenerated(displayCards);
      if (displayCards.length > 0) {
        toast({ title: "Success", description: `${displayCards.length} TCG cards generated.` });
      } else {
        toast({ title: "No Cards Generated", description: "No data was processed to generate cards.", variant: "default" });
      }

    } catch (error) {
      console.error("Error generating TCG cards:", error);
      toast({ title: "Generation Error", description: `Failed to generate TCG cards: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDataInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDataInput(e.target.value);
  };

  const handleBulkAbilityContextChange = (value: string) => {
    if (value === NO_CONTEXT_SELECTED_VALUE) {
      setSelectedAbilityContextIdForBulk('');
    } else {
      setSelectedAbilityContextIdForBulk(value);
    }
  };

  const handleNumAiCardsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    if (valStr === "") {
      setNumAiCards(1); 
    } else {
      const num = parseInt(valStr, 10);
      if (isNaN(num)) {
        setNumAiCards(1);
      } else {
        setNumAiCards(Math.max(1, num));
      }
    }
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
            setSelectedAbilityContextIdForBulk(''); // Reset context selection on template change
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
              <SelectItem value="ai">AI Field Generation (Experimental)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {generationMethod === 'csv' && (
          <div>
            <Label htmlFor="bulkData">
              Card Data (CSV Format - one card per line)
            </Label>
            <Textarea
              id="bulkData"
              value={bulkDataInput}
              onChange={handleDataInputChange}
              placeholder={selectedTemplate ? `Example:\n${exampleCSV.replace(/\\n/g, '\n')}` : "Select a template to see example CSV structure."}
              rows={8}
              className="font-mono text-sm"
              disabled={!selectedTemplate}
            />
            {selectedTemplate && <p className="text-xs text-muted-foreground mt-1">
              Your CSV headers should be: <strong>{exampleCSVHeaders || "No placeholders found in template"}</strong>.
              Use double quotes to enclose fields with commas or newlines.
            </p>}
            {!selectedTemplate && <p className="text-xs text-muted-foreground mt-1">Select a template first to see the expected CSV format based on its placeholders.</p>}
          </div>
        )}

        {generationMethod === 'ai' && selectedTemplate && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiTheme">Card Concept/Theme for AI</Label>
              <Input id="aiTheme" value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} placeholder="e.g., Swift Goblin Scout, Arcane Blast" />
              <p className="text-xs text-muted-foreground mt-1">AI will attempt to generate thematic values for all placeholders in the selected template.</p>
            </div>
            {abilityContextSets.length > 0 && (
               <div>
                <Label htmlFor="bulkAbilityContextSelect">Optional: AI Context Set</Label>
                <Select 
                  value={selectedAbilityContextIdForBulk || NO_CONTEXT_SELECTED_VALUE} 
                  onValueChange={handleBulkAbilityContextChange}
                >
                  <SelectTrigger id="bulkAbilityContextSelect">
                    <SelectValue placeholder="None (general AI knowledge)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTEXT_SELECTED_VALUE}>None (general AI knowledge)</SelectItem>
                    {abilityContextSets.map(cs => <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="numAiCards">Number of Cards (AI)</Label>
              <Input 
                id="numAiCards" 
                type="number" 
                value={numAiCards}
                onChange={handleNumAiCardsChange} 
                min="1" 
              />
            </div>
          </div>
        )}
         {!selectedTemplate && generationMethod === 'ai' && (
            <p className="text-sm text-muted-foreground">Please select a template first to use AI generation.</p>
        )}
        
        <Button onClick={handleGenerate} disabled={isLoading || !selectedTemplateId || (generationMethod === 'ai' && !aiTheme.trim())} className="w-full">
          {isLoading ? 'Generating...' : (generationMethod === 'ai' ? <> <Sparkles className="mr-2 h-4 w-4" /> Generate with AI</> : <> <Download className="mr-2 h-4 w-4" /> Generate from Data</>)}
        </Button>
      </CardContent>
    </Card>
  );
}

    