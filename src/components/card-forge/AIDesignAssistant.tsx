
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { suggestCardLayout, SuggestCardLayoutInput } from '@/ai/flows/suggest-card-layout';
import { generateCardText, GenerateCardTextInput } from '@/ai/flows/generate-card-text';
import { generateCardImage, GenerateCardImageInput } from '@/ai/flows/generate-card-image';
import { suggestTemplateColors, SuggestTemplateColorsInput, SuggestTemplateColorsOutput } from '@/ai/flows/suggest-template-colors'; 
import { useToast } from '@/hooks/use-toast';
import { Sparkles, TextQuote, Palette, Lightbulb, Copy, Image as ImageIcon, Paintbrush as PaintbrushIcon } from 'lucide-react'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TCGCardTemplate } from '@/types'; 
import NextImage from 'next/image'; // Renamed to avoid conflict with Lucide icon

interface AIDesignAssistantProps {
  templates: TCGCardTemplate[]; 
}

type TextGenType = GenerateCardTextInput['textType'];

export function AIDesignAssistant({ templates }: AIDesignAssistantProps) {
  const [activeAiTab, setActiveAiTab] = useState("designSuggestions");
  
  const [textContentLayout, setTextContentLayout] = useState<string>('');
  const [cardConceptLayout, setCardConceptLayout] = useState<string>('');
  const [currentSectionsForLayout, setCurrentSectionsForLayout] = useState<string>('');
  const [designSuggestion, setDesignSuggestion] = useState<string>('');
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);

  const [textTheme, setTextTheme] = useState<string>('');
  const [textGenType, setTextGenType] = useState<TextGenType>('RulesText');
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);

  const [imageConcept, setImageConcept] = useState<string>('');
  const [generatedImageDataUri, setGeneratedImageDataUri] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const [colorTheme, setColorTheme] = useState<string>('');
  const [suggestedColors, setSuggestedColors] = useState<SuggestTemplateColorsOutput | null>(null);
  const [isLoadingColors, setIsLoadingColors] = useState(false);


  const { toast } = useToast();

  const handleGetDesignSuggestion = async () => {
    if (!textContentLayout.trim() && !currentSectionsForLayout.trim() && !cardConceptLayout.trim()) {
      toast({ title: "Input Required", description: "Please enter text, concept, or sections for layout suggestion.", variant: "destructive" });
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
      const result = await generateCardText({ theme: textTheme, textType: textGenType });
      setGeneratedText(result.cardText);
      toast({ title: "Text Ready", description: "AI generated text is available." });
    } catch (error) {
      console.error("Error generating AI text:", error);
      toast({ title: "Error", description: "Failed to generate AI text. Check console.", variant: "destructive" });
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imageConcept.trim()) {
      toast({ title: "Input Required", description: "Please enter a concept for image generation.", variant: "destructive" });
      return;
    }
    setIsLoadingImage(true);
    setGeneratedImageDataUri('');
    try {
      const result = await generateCardImage({ cardConcept: imageConcept });
      setGeneratedImageDataUri(result.imageDataUri);
      toast({ title: "Image Ready", description: "AI generated image is available." });
    } catch (error) {
      console.error("Error generating AI image:", error);
      toast({ title: "Error", description: `Failed to generate AI image: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleSuggestColors = async () => {
    if (!colorTheme.trim()) {
      toast({ title: "Input Required", description: "Please enter a theme for color suggestions.", variant: "destructive" });
      return;
    }
    setIsLoadingColors(true);
    setSuggestedColors(null);
    try {
      const result = await suggestTemplateColors({ theme: colorTheme });
      setSuggestedColors(result);
      toast({ title: "Color Palette Suggested", description: "AI has suggested colors for your theme." });
    } catch (error) {
      console.error("Error suggesting colors:", error);
      toast({ title: "Error", description: `Failed to suggest colors: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingColors(false);
    }
  };


  const copyToClipboard = (textToCopy: string, successMessage: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast({ title: "Copied!", description: successMessage }))
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast({ title: "Copy Failed", description: "Could not copy text to clipboard.", variant: "destructive" });
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          AI Helper
        </CardTitle>
        <CardDescription>Get AI-powered assistance for card text, design, image ideas, and color palettes.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeAiTab} onValueChange={setActiveAiTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
            <TabsTrigger value="designSuggestions" className="flex items-center gap-2"><Palette className="h-4 w-4" />Layout</TabsTrigger>
            <TabsTrigger value="textGeneration" className="flex items-center gap-2"><TextQuote className="h-4 w-4" />Text</TabsTrigger>
            <TabsTrigger value="imageGeneration" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Image</TabsTrigger>
            <TabsTrigger value="colorSuggestions" className="flex items-center gap-2"><PaintbrushIcon className="h-4 w-4" />Colors</TabsTrigger>
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
              <Lightbulb className="mr-2 h-4 w-4" /> {isLoadingLayout ? 'Thinking...' : 'Get Design Suggestions'}
            </Button>
            {designSuggestion && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Design Suggestion:</h4>
                <ScrollArea className="h-48 w-full rounded-md border p-3 bg-muted/50">
                  <pre className="whitespace-pre-wrap text-sm">{designSuggestion}</pre>
                </ScrollArea>
                 <Button variant="outline" size="sm" onClick={() => copyToClipboard(designSuggestion, "Design suggestion copied.")}>
                  <Copy className="mr-2 h-3 w-3" /> Copy Suggestion
                </Button>
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
                placeholder="e.g., Goblin Archer with Reach, Ancient Spell of Shielding"
              />
            </div>
            <div>
              <Label htmlFor="textGenTypeSelect">Type of Text to Generate</Label>
              <Select value={textGenType} onValueChange={(value) => setTextGenType(value as TextGenType)}>
                <SelectTrigger id="textGenTypeSelect">
                  <SelectValue placeholder="Choose text type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RulesText">Rules Text / Ability</SelectItem>
                  <SelectItem value="FlavorText">Flavor Text</SelectItem>
                  <SelectItem value="CardName">Card Name</SelectItem>
                  <SelectItem value="FullConceptIdea">Full Card Concept Idea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateText} disabled={isLoadingText} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" /> {isLoadingText ? 'Generating...' : 'Generate Card Text'}
            </Button>
            {generatedText && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Generated Text:</h4>
                 <ScrollArea className="h-32 w-full rounded-md border p-3 bg-muted/50">
                  <pre className="whitespace-pre-wrap text-sm">{generatedText}</pre>
                </ScrollArea>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedText, "Generated text copied.")}>
                  <Copy className="mr-2 h-3 w-3" /> Copy Text
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="imageGeneration" className="space-y-4">
            <CardDescription>Generate artwork ideas for your card. The AI will provide a Data URI for the image.</CardDescription>
            <div>
              <Label htmlFor="imageConcept">Card Concept for Image Generation</Label>
              <Input
                id="imageConcept"
                value={imageConcept}
                onChange={(e) => setImageConcept(e.target.value)}
                placeholder="e.g., 'Ancient stone golem awakening in a ruin', 'Knight facing a fiery dragon'"
              />
               <p className="text-xs text-muted-foreground mt-1">Describe the desired artwork. Be descriptive for best results.</p>
            </div>
            <Button onClick={handleGenerateImage} disabled={isLoadingImage} className="w-full">
              <ImageIcon className="mr-2 h-4 w-4" /> {isLoadingImage ? 'Generating Image...' : 'Generate Image Idea'}
            </Button>
            {generatedImageDataUri && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Generated Image:</h4>
                <div className="border rounded-md p-2 bg-muted/50 flex justify-center items-center max-h-96 overflow-hidden">
                  <NextImage 
                    src={generatedImageDataUri} 
                    alt="AI Generated Card Artwork" 
                    width={300} 
                    height={400} 
                    className="rounded"
                    style={{ objectFit: 'contain', width: 'auto', height: 'auto', maxHeight: '360px' }}
                    data-ai-hint="generated card art"
                    />
                </div>
                <Textarea
                  value={generatedImageDataUri}
                  readOnly
                  rows={3}
                  className="mt-2 font-mono text-xs"
                  aria-label="Generated Image Data URI"
                />
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedImageDataUri, "Image Data URI copied.")}>
                  <Copy className="mr-2 h-3 w-3" /> Copy Data URI
                </Button>
                <p className="text-xs text-muted-foreground">
                  Copy this Data URI and paste it into the 'Artwork URL' field in the Single or Bulk Card Generator.
                  Note: Generated images can be large and may impact performance if many are used.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="colorSuggestions" className="space-y-4">
            <CardDescription>Get AI-suggested color palettes for your card template based on a theme. You can then manually apply these in the Template Editor.</CardDescription>
            <div>
              <Label htmlFor="colorTheme">Theme for Color Palette</Label>
              <Input
                id="colorTheme"
                value={colorTheme}
                onChange={(e) => setColorTheme(e.target.value)}
                placeholder="e.g., 'Fiery Volcano', 'Mystic Forest', 'Ancient Tomb'"
              />
            </div>
            <Button onClick={handleSuggestColors} disabled={isLoadingColors} className="w-full">
              <PaintbrushIcon className="mr-2 h-4 w-4" /> {isLoadingColors ? 'Suggesting Colors...' : 'Suggest Thematic Colors'}
            </Button>
            {suggestedColors && (
              <div className="mt-4 space-y-3">
                <h4 className="font-semibold">Suggested Color Palette:</h4>
                <ScrollArea className="h-64 w-full rounded-md border p-3 bg-muted/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {Object.entries(suggestedColors).map(([key, value]) => {
                      if (!value) return null;
                      // Convert camelCase key to Title Case for display
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{label}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{value}</span>
                            <div className="h-4 w-4 rounded border" style={{ backgroundColor: value }}></div>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(value, `${label} color copied.`)}>
                                <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">Use these color codes in the Template Editor's styling options.</p>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}
    
