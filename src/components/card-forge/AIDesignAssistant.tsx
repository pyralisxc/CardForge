
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { suggestCardLayout, SuggestCardLayoutInput } from '@/ai/flows/suggest-card-layout';
import { generateCardText } from '@/ai/flows/generate-card-text';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, TextQuote, Palette } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TCGCardTemplate } from '@/types'; // Import TCGCardTemplate

interface AIDesignAssistantProps {
  templates: TCGCardTemplate[]; // Pass templates to the assistant
}

export function AIDesignAssistant({ templates }: AIDesignAssistantProps) {
  const [activeAiTab, setActiveAiTab] = useState("designSuggestions");
  
  const [textContentLayout, setTextContentLayout] = useState<string>('');
  const [cardConceptLayout, setCardConceptLayout] = useState<string>('');
  const [currentSectionsForLayout, setCurrentSectionsForLayout] = useState<string>(''); // New state for sections info
  const [designSuggestion, setDesignSuggestion] = useState<string>('');
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);

  const [textTheme, setTextTheme] = useState<string>('');
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);

  const { toast } = useToast();

  const handleGetDesignSuggestion = async () => {
    if (!textContentLayout.trim() && !currentSectionsForLayout.trim()) {
      toast({ title: "Input Required", description: "Please enter text content or describe sections for layout suggestion.", variant: "destructive" });
      return;
    }
    setIsLoadingLayout(true);
    setDesignSuggestion('');
    try {
      const input: SuggestCardLayoutInput = { 
        textContent: textContentLayout, 
        cardConcept: cardConceptLayout,
      };
      if (currentSectionsForLayout.trim()) {
        input.currentSections = currentSectionsForLayout;
      }
      const result = await suggestCardLayout(input);
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

  // Helper to get a string representation of current template sections (if any are being edited)
  // This is a simplified approach. A more robust way would involve letting user pick a template
  // or directly inputting section details for AI analysis.
  const getActiveTemplateSectionsInfo = () => {
    // For now, let's assume user types this manually or we could try to grab it from a selected template in future.
    // This is a placeholder for a more complex UI interaction.
    return ""; 
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          AI Helper for TCG Cards
        </CardTitle>
        <CardDescription>Get AI-powered assistance for card text generation and design layout ideas, especially for custom sequential layouts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeAiTab} onValueChange={setActiveAiTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="designSuggestions" className="flex items-center gap-2"><Palette className="h-4 w-4" />Design Ideas</TabsTrigger>
            <TabsTrigger value="textGeneration" className="flex items-center gap-2"><TextQuote className="h-4 w-4" />Text Generation</TabsTrigger>
          </TabsList>

          <TabsContent value="designSuggestions" className="space-y-4">
            <CardDescription>Get AI design suggestions based on card text, concept, or existing section layout.</CardDescription>
            <div>
              <Label htmlFor="cardTextContentLayout">Primary Card Text (Keywords, Abilities, Names etc.)</Label>
              <Textarea
                id="cardTextContentLayout"
                value={textContentLayout}
                onChange={(e) => setTextContentLayout(e.target.value)}
                placeholder="e.g., 'Flying, First Strike. When this creature enters, draw a card.' OR describe elements like 'Goblin Warchief // 2RR // Creature - Goblin Warrior'"
                rows={3}
              />
            </div>
             <div>
              <Label htmlFor="cardConceptLayout">Card Concept/Theme (Optional)</Label>
              <Input
                id="cardConceptLayout"
                value={cardConceptLayout}
                onChange={(e) => setCardConceptLayout(e.target.value)}
                placeholder="e.g., Aggressive Fire Creature, Defensive Enchantment, Utility Artifact"
              />
            </div>
             <div>
              <Label htmlFor="currentSectionsLayout">Current Sections (Optional - Describe your layout)</Label>
              <Textarea
                id="currentSectionsLayout"
                value={currentSectionsForLayout}
                onChange={(e) => setCurrentSectionsForLayout(e.target.value)}
                placeholder="e.g., 'Top: Name ({{cardName}}), ManaCost ({{cost}}). Middle: Artwork ({{art}}). Bottom: Rules ({{rules}}), P/T ({{pt}})'"
                rows={3}
              />
               <p className="text-xs text-muted-foreground">If using a custom sequential layout, briefly describe the sections and their placeholders for more tailored suggestions.</p>
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
