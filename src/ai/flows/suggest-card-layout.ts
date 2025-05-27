'use server';

/**
 * @fileOverview AI-powered design suggestions for card layouts based on the input content.
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
    .describe('The text content that will be used in the card layout.'),
});
export type SuggestCardLayoutInput = z.infer<typeof SuggestCardLayoutInputSchema>;

const SuggestCardLayoutOutputSchema = z.object({
  designSuggestion: z
    .string()
    .describe('AI-powered design suggestions for the card layout.'),
});
export type SuggestCardLayoutOutput = z.infer<typeof SuggestCardLayoutOutputSchema>;

export async function suggestCardLayout(input: SuggestCardLayoutInput): Promise<SuggestCardLayoutOutput> {
  return suggestCardLayoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCardLayoutPrompt',
  input: {schema: SuggestCardLayoutInputSchema},
  output: {schema: SuggestCardLayoutOutputSchema},
  prompt: `You are an expert card designer. Based on the following text content, provide design suggestions for a card layout. Be creative and consider various design elements such as typography, color schemes, and image placement. The design suggestion should be detailed and actionable.

Text Content: {{{textContent}}}`,
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
