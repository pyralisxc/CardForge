"use client";

import type { SimplifiedCardTemplate, CardData, DisplayCard } from '@/types';
import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateCardText } from '@/ai/flows/generate-card-text';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Sparkles, Download } from 'lucide-react';

interface BulkGeneratorProps {
  templates: SimplifiedCardTemplate[];
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
      toast({ title: "Error", description: "Please select a template.", variant: "destructive" });
      return;
    }
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      toast({ title: "Error", description: "Selected template not found.", variant: "destructive" });
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
        // CSV: first line is headers, subsequent lines are data
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
          toast({ title: "Error", description: "Please provide a theme for AI generation.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        for (let i = 0; i < numAiCards; i++) {
          const aiResult = await generateCardText({ theme: aiTheme });
          // This AI flow returns a single string. We need to adapt it or make assumptions.
          // For now, let's assume the AI text is for the 'body' and we create a generic title.
          const cardData: CardData = {
            title: `AI Card: ${aiTheme}`,
            body: aiResult.cardText,
            // You might want to extract more from a more structured AI response
          };
          generatedCards.push({ template, data: cardData, uniqueId: nanoid() });
        }
      }
      onCardsGenerated(generatedCards);
      toast({ title: "Success", description: `${generatedCards.length} cards generated.` });
    } catch (error) {
      console.error("Error generating cards:", error);
      toast({ title: "Error", description: "Failed to generate cards. Check console for details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDataInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDataInput(e.target.value);
  };

  const exampleCSV = "name,occasion,gift\nAlice,Birthday,a book\nBob,Graduation,a watch\nCharlie,Thank You,your help";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Card Generator</CardTitle>
        <CardDescription>Generate multiple cards from a template using CSV data or AI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="templateSelect">Select Template</Label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger id="templateSelect">
              <SelectValue placeholder="Choose a template" />
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
              <SelectItem value="ai">AI Text Generation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {generationMethod === 'csv' && (
          <div>
            <Label htmlFor="bulkData">
              Card Data (CSV format - first line headers, then data lines)
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
              Example: name,occasion. Then each line: John Doe,Birthday
            </p>
          </div>
        )}

        {generationMethod === 'ai' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiTheme">Theme for AI Generation</Label>
              <Input id="aiTheme" value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} placeholder="e.g., Congratulations on new job" />
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
