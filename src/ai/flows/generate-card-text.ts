
'use server';

/**
 * @fileOverview Generates sample text content (rules, abilities, flavor) for TCG cards based on a given theme or topic.
 *
 * - generateCardText - A function that generates sample card text.
 * - GenerateCardTextInput - The input type for the generateCardText function.
 * - GenerateCardTextOutput - The return type for the generateCardText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardTextInputSchema = z.object({
  theme: z
    .string()
    .describe('The theme, concept, or specific card idea for text generation (e.g., "Goblin Archer with Reach", "Ancient Spell of Shielding", "Mysterious Forest Spirit flavor text").'),
});
export type GenerateCardTextInput = z.infer<typeof GenerateCardTextInputSchema>;

const GenerateCardTextOutputSchema = z.object({
  cardText: z.string().describe('The generated sample text content (e.g., rules, abilities, flavor text) for the TCG card.'),
});
export type GenerateCardTextOutput = z.infer<typeof GenerateCardTextOutputSchema>;

export async function generateCardText(input: GenerateCardTextInput): Promise<GenerateCardTextOutput> {
  return generateCardTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCardTextPrompt',
  input: {schema: GenerateCardTextInputSchema},
  output: {schema: GenerateCardTextOutputSchema},
  prompt: `You are a creative writing assistant specializing in fantasy Trading Card Games (TCGs) like Magic: The Gathering or Hearthstone. 
Generate compelling and thematic text (rules, abilities, or flavor text) for a TCG card based on the following theme or concept: {{{theme}}}. 
The text should be concise, evocative, and suitable for a fantasy TCG card. If the theme implies rules, provide functional game text. If it implies flavor, provide immersive descriptive text.
Focus on one primary aspect (e.g., one ability, or a short flavor paragraph).
Output only the generated text itself.`,
});

const generateCardTextFlow = ai.defineFlow(
  {
    name: 'generateCardTextFlow',
    inputSchema: GenerateCardTextInputSchema,
    outputSchema: GenerateCardTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
