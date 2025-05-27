'use server';

/**
 * @fileOverview Generates sample text content for cards based on a given theme or topic.
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
    .describe('The theme or topic for the card text generation (e.g., Birthday, Thank You, Congratulations).'),
});
export type GenerateCardTextInput = z.infer<typeof GenerateCardTextInputSchema>;

const GenerateCardTextOutputSchema = z.object({
  cardText: z.string().describe('The generated sample text content for the card.'),
});
export type GenerateCardTextOutput = z.infer<typeof GenerateCardTextOutputSchema>;

export async function generateCardText(input: GenerateCardTextInput): Promise<GenerateCardTextOutput> {
  return generateCardTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCardTextPrompt',
  input: {schema: GenerateCardTextInputSchema},
  output: {schema: GenerateCardTextOutputSchema},
  prompt: `You are a creative writing assistant. Generate sample text content for a card with the following theme or topic: {{{theme}}}. The text should be suitable for a card and should be concise and engaging.`,
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
