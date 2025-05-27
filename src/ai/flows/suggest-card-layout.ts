
'use server';

/**
 * @fileOverview AI-powered design suggestions for fantasy TCG card layouts based on input content and section descriptions.
 *
 * - suggestCardLayout - A function that suggests card layouts.
 * - SuggestCardLayoutInput - The input type for the suggestCardLayout function.
 * - SuggestCardLayoutOutput - The return type for the suggestCardLayout function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Updated Input Schema
const SuggestCardLayoutInputSchema = z.object({
  textContent: z
    .string()
    .optional()
    .describe('The primary text content (e.g., rules text, name, type) that will be used in the TCG card layout. This can also be a general description of the card if not providing specific section details.'),
  cardConcept: z.string().optional().describe('Optional: A brief concept of the card (e.g., "Aggressive Fire Creature", "Defensive Enchantment", "Utility Artifact").'),
  currentSections: z.string().optional().describe('Optional: A description of the current or desired card sections and their content placeholders, if using a custom sequential layout. E.g., "Header: Name ({{cardName}}), Cost ({{cost}}). Main: Art ({{artUrl}}). Textbox: Rules ({{rules}}), Flavor ({{flavor}}). Footer: P/T ({{pt}})."')
});
export type SuggestCardLayoutInput = z.infer<typeof SuggestCardLayoutInputSchema>;

const SuggestCardLayoutOutputSchema = z.object({
  designSuggestion: z
    .string()
    .describe('AI-powered design suggestions for the fantasy TCG card layout, considering sequential sections if provided.'),
});
export type SuggestCardLayoutOutput = z.infer<typeof SuggestCardLayoutOutputSchema>;

export async function suggestCardLayout(input: SuggestCardLayoutInput): Promise<SuggestCardLayoutOutput> {
  return suggestCardLayoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCardLayoutPrompt',
  input: {schema: SuggestCardLayoutInputSchema},
  output: {schema: SuggestCardLayoutOutputSchema},
  prompt: `You are an expert fantasy Trading Card Game (TCG) designer, specializing in card layout and visual hierarchy.
Your goal is to provide design suggestions for a fantasy TCG card. Consider the overall theme and specific TCG elements.

If 'Current Sections' are provided, focus on how to best arrange and style these sequential sections. 
If not, provide general layout advice based on 'Text Content' and 'Card Concept'.

Key TCG elements to consider:
- Overall card frame and borders.
- Name section: Typography, placement, background.
- Mana/Resource Cost section: Symbols, placement, integration with name or frame.
- Artwork section: Prominence, shape, interaction with frame/other sections. How it guides the eye.
- Type Line section: Font, placement, background, separators (e.g., Creature — Goblin Warrior).
- Text Box section(s) (for rules, abilities, flavor text): Font choices, iconography, dividers between rules and flavor, clear readability.
- Power/Toughness (or similar stats) section: Style, placement, background, clear visibility.
- Rarity indicators: Subtle symbols or color cues.
- Thematic consistency: Color palettes (e.g., faction colors, magic type colors), frame styles, iconography that fit a fantasy TCG.
- Visual flow: How the user's eye moves from one section to another.
- Space management: Efficient use of card real estate.

Provide descriptive, actionable ideas. Be creative.

Card Concept (if provided): {{{cardConcept}}}
Primary Text Content (if provided): {{{textContent}}}
Current Sections (if provided, this is key for custom layouts): {{{currentSections}}}

Based on the above, generate your design suggestions. If 'Current Sections' are given, explain how to make that specific sequence look good.
If only text content/concept is given, suggest a good sequence of sections and their styling.
`,
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
