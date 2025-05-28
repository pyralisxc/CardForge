
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, AbilityContextSet, ExtractedPlaceholder } from '@/types';
import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
// import { Input } from '@/components/ui/input'; // No longer needed for AI theme/num
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { generateCardFields } from '@/ai/flows/generate-card-fields'; // AI flow import removed
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Download, PackagePlus } from 'lucide-react'; // Sparkles icon removed
import { extractUniquePlaceholderKeys } from '@/lib/utils';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
  abilityContextSets: AbilityContextSet[]; // Kept for potential future re-integration, not used now
}

// const NO_CONTEXT_SELECTED_VALUE = "_NO_CONTEXT_"; // No longer needed

export function BulkGenerator({ templates, onCardsGenerated, abilityContextSets }: BulkGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  // const [generationMethod, setGenerationMethod] = useState<'csv' | 'ai'>('csv'); // Only CSV now
  // const [aiTheme, setAiTheme] = useState<string>(''); // Removed
  // const [numAiCards, setNumAiCards] = useState<number>(1); // Removed
  const [isLoading, setIsLoading] = useState(false); // Might still be useful for slow CSV processing if implemented
  const { toast } = useToast();
  // const [selectedAbilityContextIdForBulk, setSelectedAbilityContextIdForBulk] = useState<string>(''); // Removed


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
      // Only CSV method now
      if (!bulkDataInput.trim()) {
        toast({ title: "Error", description: "Please provide CSV data for card generation.", variant: "destructive" });
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
        if (lines[i].trim() === '') continue;
        const values = lines[i].split(',').map(v => v.trim());
        const cardData: CardData = {};
        headers.forEach((header, index) => {
          cardData[header] = values[index] || '';
        });
        generatedCardsData.push(cardData);
      }
      
      const displayCards = generatedCardsData.map(data => ({ template: selectedTemplate, data, uniqueId: nanoid() }));
      onCardsGenerated(displayCards);
      if (displayCards.length > 0) {
        toast({ title: "Success", description: `${displayCards.length} TCG cards generated from CSV.` });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Card Generation</CardTitle>
        <CardDescription>Generate multiple cards from a template using CSV data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="bulkTemplateSelect">Select Template</Label>
          <Select value={selectedTemplateId} onValueChange={(id) => {
            setSelectedTemplateId(id);
          }}>
            <SelectTrigger id="bulkTemplateSelect">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Generation method select removed - defaults to CSV */}
        
        <div>
          <Label htmlFor="bulkData">
            Card Data (CSV Format - one card per line, headers matching template placeholders)
          </Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={handleDataInputChange}
            placeholder={selectedTemplate ? `Example for "${selectedTemplate.name}":\n${exampleCSVHeaders}\n${exampleCSVDataLine}` : "Select a template to see example CSV structure."}
            rows={8}
            className="font-mono text-sm"
            disabled={!selectedTemplate}
          />
          {selectedTemplate && <p className="text-xs text-muted-foreground mt-1">
            Your CSV headers should be: <strong>{exampleCSVHeaders || "No placeholders found in template"}</strong>.
            Ensure data order matches header order. Use double quotes to enclose fields with commas if necessary.
          </p>}
          {!selectedTemplate && <p className="text-xs text-muted-foreground mt-1">Select a template first to see the expected CSV format based on its placeholders.</p>}
        </div>
        
        <Button onClick={handleGenerate} disabled={isLoading || !selectedTemplateId || !bulkDataInput.trim()} className="w-full">
          {isLoading ? 'Generating...' : <> <Download className="mr-2 h-4 w-4" /> Generate from CSV Data</>}
        </Button>
      </CardContent>
    </Card>
  );
}
