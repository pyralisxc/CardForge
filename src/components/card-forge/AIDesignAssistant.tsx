
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // Added for card concept
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { suggestCardLayout } from '@/ai/flows/suggest-card-layout';
import { generateCardText } from '@/ai/flows/generate-card-text'; // Added for text generation
import { useToast } from '@/hooks/use-toast';
import { Sparkles, TextQuote, Palette } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


export function AIDesignAssistant() {
  const [activeAiTab, setActiveAiTab] = useState("designSuggestions");
  
  // For Design Suggestions
  const [textContentLayout, setTextContentLayout] = useState<string>('');
  const [cardConceptLayout, setCardConceptLayout] = useState<string>('');
  const [designSuggestion, setDesignSuggestion] = useState<string>('');
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);

  // For Text Generation
  const [textTheme, setTextTheme] = useState<string>('');
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);

  const { toast } = useToast();

  const handleGetDesignSuggestion = async () => {
    if (!textContentLayout.trim()) {
      toast({ title: "Input Required", description: "Please enter some text content for the card layout suggestion.", variant: "destructive" });
      return;
    }
    setIsLoadingLayout(true);
    setDesignSuggestion('');
    try {
      const result = await suggestCardLayout({ textContent: textContentLayout, cardConcept: cardConceptLayout });
      setDesignSuggestion(result.designSuggestion);
      toast({ title: "Suggestion Ready", description: "AI design suggestion has been generated." });
    } catch (error) {
      console.error("Error getting AI design suggestion:", error);
      toast({ title: "Error", description: "Failed to get AI design suggestion. Check console.", variant: "destructive" });
    } finally {
      setIsLoadingLayout(false);
    }
  };

  const handleGenerateText = async () => {
    if (!textTheme.trim()) {
      toast({ title: "Input Required", description: "Please enter a theme or concept for text generation.", variant: "destructive" });
      return;
    }
    setIsLoadingText(true);
    setGeneratedText('');
    try {
      const result = await generateCardText({ theme: textTheme });
      setGeneratedText(result.cardText);
      toast({ title: "Text Ready", description: "AI generated text is available." });
    } catch (error) {
      console.error("Error generating AI text:", error);
      toast({ title: "Error", description: "Failed to generate AI text. Check console.", variant: "destructive" });
    } finally {
      setIsLoadingText(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          AI Helper for TCG Cards
        </CardTitle>
        <CardDescription>Get AI-powered assistance for card text generation and design layout ideas for your fantasy TCG.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeAiTab} onValueChange={setActiveAiTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="designSuggestions" className="flex items-center gap-2"><Palette className="h-4 w-4" />Design Ideas</TabsTrigger>
            <TabsTrigger value="textGeneration" className="flex items-center gap-2"><TextQuote className="h-4 w-4" />Text Generation</TabsTrigger>
          </TabsList>

          <TabsContent value="designSuggestions" className="space-y-4">
            <CardDescription>Get AI-powered design suggestions based on your card's text content and concept.</CardDescription>
            <div>
              <Label htmlFor="cardTextContentLayout">Primary Card Text (Rules, Name, Type, etc.)</Label>
              <Textarea
                id="cardTextContentLayout"
                value={textContentLayout}
                onChange={(e) => setTextContentLayout(e.target.value)}
                placeholder="e.g., 'Flying, First Strike. When this creature enters the battlefield, draw a card.' or 'Goblin Warchief - Creature - Goblin Warrior'"
                rows={4}
              />
            </div>
             <div>
              <Label htmlFor="cardConceptLayout">Card Concept (Optional)</Label>
              <Input
                id="cardConceptLayout"
                value={cardConceptLayout}
                onChange={(e) => setCardConceptLayout(e.target.value)}
                placeholder="e.g., Aggressive Fire Creature, Defensive Enchantment, Utility Artifact"
              />
            </div>
            <Button onClick={handleGetDesignSuggestion} disabled={isLoadingLayout} className="w-full">
              {isLoadingLayout ? 'Thinking...' : 'Get Design Suggestions'}
            </Button>
            {designSuggestion && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Design Suggestion:</h4>
                <ScrollArea className="h-48 w-full rounded-md border p-3 bg-muted">
                  <pre className="whitespace-pre-wrap text-sm">{designSuggestion}</pre>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="textGeneration" className="space-y-4">
            <CardDescription>Generate rules text, flavor text, or ability ideas for your card.</CardDescription>
            <div>
              <Label htmlFor="textTheme">Card Theme/Concept for Text</Label>
              <Input
                id="textTheme"
                value={textTheme}
                onChange={(e) => setTextTheme(e.target.value)}
                placeholder="e.g., Goblin Archer with Reach, Ancient Spell of Shielding, Mysterious Forest Spirit flavor text"
              />
            </div>
            <Button onClick={handleGenerateText} disabled={isLoadingText} className="w-full">
              {isLoadingText ? 'Generating...' : 'Generate Card Text'}
            </Button>
            {generatedText && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Generated Text:</h4>
                 <ScrollArea className="h-32 w-full rounded-md border p-3 bg-muted">
                  <pre className="whitespace-pre-wrap text-sm">{generatedText}</pre>
                </ScrollArea>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(generatedText);
                  toast({title: "Copied!", description: "Generated text copied to clipboard."});
                }}>
                  Copy Text
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
