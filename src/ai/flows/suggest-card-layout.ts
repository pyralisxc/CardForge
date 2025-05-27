
'use server';

/**
 * @fileOverview AI-powered design suggestions for fantasy TCG card layouts based on the input content.
 *
 * - suggestCardLayout - A function that suggests card layouts.
 * - SuggestCardLayoutInput - The input type for the suggestCardLayout function.
 * - SuggestCardLayoutOutput - The return type for the suggestCardLayout function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCardLayoutInputSchema = z.object({
  textContent: z
    .string()
    .describe('The primary text content (e.g., rules text, name, type) that will be used in the TCG card layout.'),
  cardConcept: z.string().optional().describe('Optional: A brief concept of the card (e.g., "Aggressive Fire Creature", "Defensive Enchantment", "Utility Artifact").')
});
export type SuggestCardLayoutInput = z.infer<typeof SuggestCardLayoutInputSchema>;

const SuggestCardLayoutOutputSchema = z.object({
  designSuggestion: z
    .string()
    .describe('AI-powered design suggestions for the fantasy TCG card layout.'),
});
export type SuggestCardLayoutOutput = z.infer<typeof SuggestCardLayoutOutputSchema>;

export async function suggestCardLayout(input: SuggestCardLayoutInput): Promise<SuggestCardLayoutOutput> {
  return suggestCardLayoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCardLayoutPrompt',
  input: {schema: SuggestCardLayoutInputSchema},
  output: {schema: SuggestCardLayoutOutputSchema},
  prompt: `You are an expert fantasy Trading Card Game (TCG) designer.
Based on the following text content and card concept, provide design suggestions for a fantasy TCG card layout. 
Be creative and consider TCG-specific elements such as:
- Mana cost representation (symbols, placement).
- Artwork area (shape, prominence, interaction with frame).
- Card name typography and placement.
- Card type line (e.g., "Creature - Goblin Warrior", "Instant", "Artifact - Equipment").
- Text box for rules and flavor text (how to divide, font choices, iconography).
- Power/Toughness box (if applicable, style and placement).
- Rarity symbols or indicators.
- Overall thematic consistency for a fantasy game (e.g., color palettes related to card type/faction, frame styles).
The design suggestion should be descriptive and provide actionable ideas.

Card Concept (if provided): {{{cardConcept}}}
Primary Text Content: {{{textContent}}}`,
});

const suggestCardLayoutFlow = ai.defineFlow(
  {
    name: 'suggestCardLayoutFlow',
    inputSchema: SuggestCardLayoutInputSchema,
    outputSchema: SuggestCardLayoutOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
