"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { suggestCardLayout } from '@/ai/flows/suggest-card-layout';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

export function AIDesignAssistant() {
  const [textContent, setTextContent] = useState<string>('');
  const [suggestion, setSuggestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGetSuggestion = async () => {
    if (!textContent.trim()) {
      toast({ title: "Input Required", description: "Please enter some text content for the card.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setSuggestion('');
    try {
      const result = await suggestCardLayout({ textContent });
      setSuggestion(result.designSuggestion);
      toast({ title: "Suggestion Ready", description: "AI design suggestion has been generated." });
    } catch (error) {
      console.error("Error getting AI design suggestion:", error);
      toast({ title: "Error", description: "Failed to get AI design suggestion. Check console.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          AI Design Assistant
        </CardTitle>
        <CardDescription>Get AI-powered design suggestions based on your card's text content.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="cardTextContent">Card Text Content</Label>
          <Textarea
            id="cardTextContent"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Enter the main text for your card (e.g., 'Happy Birthday, Sarah! Hope you have a wonderful day.')"
            rows={5}
          />
        </div>
        <Button onClick={handleGetSuggestion} disabled={isLoading} className="w-full">
          {isLoading ? 'Thinking...' : 'Get Design Suggestions'}
        </Button>
        {suggestion && (
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Design Suggestion:</h4>
            <ScrollArea className="h-48 w-full rounded-md border p-3 bg-muted">
              <pre className="whitespace-pre-wrap text-sm">{suggestion}</pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
