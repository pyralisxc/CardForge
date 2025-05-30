
'use server';

/**
 * @fileOverview Generates sample text content (rules, abilities, flavor) for TCG cards based on a given theme or topic and text type.
 *
 * - generateCardText - A function that generates sample card text.
 * - GenerateCardTextInput - The input type for the generateCardText function.
 * - GenerateCardTextOutput - The return type for the generateCardText function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const GenerateCardTextInputSchema = z.object({
  theme: z
    .string()
    .describe('The theme, concept, or specific card idea for text generation (e.g., "Goblin Archer with Reach", "Ancient Spell of Shielding", "Mysterious Forest Spirit flavor text").'),
  textType: z.enum(['CardName', 'RulesText', 'FlavorText', 'FullConceptIdea'])
    .optional()
    .default('RulesText')
    .describe("The specific type of text to generate. 'FullConceptIdea' might generate a name, simple rules, and flavor."),
});
export type GenerateCardTextInput = z.infer<typeof GenerateCardTextInputSchema>;

const GenerateCardTextOutputSchema = z.object({
  cardText: z.string().describe('The generated sample text content (e.g., rules, abilities, flavor text, or full concept) for the TCG card.'),
});
export type GenerateCardTextOutput = z.infer<typeof GenerateCardTextOutputSchema>;

export async function generateCardText(input: GenerateCardTextInput): Promise<GenerateCardTextOutput> {
  return generateCardTextFlow(input);
}

const constructPrompt = (textType: GenerateCardTextInput['textType'], theme: string) => {
  let taskDescription = "";
  switch (textType) {
    case 'CardName':
      taskDescription = `Generate a compelling and thematic card name for a fantasy TCG card based on the concept: "${theme}". The name should be concise and evocative. Output only the card name.`;
      break;
    case 'FlavorText':
      taskDescription = `Generate immersive and thematic flavor text for a fantasy TCG card based on the concept: "${theme}". The text should be short (1-2 sentences) and suitable for a fantasy TCG card. Output only the flavor text.`;
      break;
    case 'FullConceptIdea':
      taskDescription = `Generate a full card concept idea for a fantasy TCG. Based on the theme "${theme}", provide:
1. Card Name: A thematic name.
2. Basic Rules Text: A simple, functional game mechanic or ability.
3. Flavor Text: A short, evocative sentence.
Format the output clearly, for example:
Card Name: [Generated Name]
Rules Text: [Generated Rules]
Flavor Text: [Generated Flavor]`;
      break;
    case 'RulesText':
    default:
      taskDescription = `Generate compelling and thematic rules text or ability description for a fantasy TCG card based on the concept: "${theme}". The text should be concise, functional, and suitable for a fantasy TCG. Focus on one primary ability or effect. Output only the rules text.`;
      break;
  }
  return `You are a creative writing assistant specializing in fantasy Trading Card Games (TCGs) like Magic: The Gathering or Hearthstone. ${taskDescription}`;
};

const generateCardTextFlow = ai.defineFlow(
  {
    name: 'generateCardTextFlow',
    inputSchema: GenerateCardTextInputSchema,
    outputSchema: GenerateCardTextOutputSchema,
  },
  async (input) => {
    const { theme, textType } = input;
    const dynamicPrompt = constructPrompt(textType, theme);

    console.log("[generateCardTextFlow] Prompt being sent to AI:", dynamicPrompt);

    const {output} = await ai.generate({
      prompt: dynamicPrompt,
    });

    return { cardText: output?.text || "No text generated." };
  }
);
