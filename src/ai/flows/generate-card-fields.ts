
'use server';
/**
 * @fileOverview Generates thematic string values for a list of placeholder keys based on a given theme and optional context.
 *
 * - generateCardFields - A function that triggers the field generation flow.
 * - GenerateCardFieldsInput - The input type for the generateCardFields function.
 * - GenerateCardFieldsOutput - The return type for the generateCardFields function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// import { useToast } from '@/hooks/use-toast'; // Cannot be used in server component

const GenerateCardFieldsInputSchema = z.object({
  theme: z
    .string()
    .describe('The overall theme or concept for the TCG card (e.g., "Goblin Archer", "Ancient Spell of Shielding", "Mysterious Forest Spirit").'),
  placeholderKeys: z
    .array(z.string())
    .describe('An array of placeholder keys for which values need to be generated (e.g., ["cardName", "manaCost", "rulesText", "attackValue", "flavorText"]).'),
  abilityContext: z
    .string()
    .optional()
    .describe('Optional: A block of text describing game rules, specific abilities, or lore to guide the generation.')
});
export type GenerateCardFieldsInput = z.infer<typeof GenerateCardFieldsInputSchema>;

const GenerateCardFieldsOutputSchema = z.object({
    generatedData: z.record(z.string()).describe("An object where keys are the placeholder keys from the input, and values are the AI-generated strings for those fields.")
});
export type GenerateCardFieldsOutput = z.infer<typeof GenerateCardFieldsOutputSchema>;

export async function generateCardFields(input: GenerateCardFieldsInput): Promise<GenerateCardFieldsOutput> {
  return generateCardFieldsFlow(input);
}

const generateCardFieldsFlow = ai.defineFlow(
  {
    name: 'generateCardFieldsFlow',
    inputSchema: GenerateCardFieldsInputSchema,
    outputSchema: GenerateCardFieldsOutputSchema,
  },
  async (input) => {
    const { theme, placeholderKeys, abilityContext } = input;

    const placeholderListString = placeholderKeys.map(key => `- ${key}`).join('\n');
    const contextInstruction = abilityContext 
      ? `Consider the following game rules, specific abilities, or lore context when generating values:\n${abilityContext}\n\n` 
      : '';

    const prompt = `You are a creative AI assistant specializing in fantasy Trading Card Games (TCGs).
Your task is to generate thematic content for a TCG card based on the theme: "${theme}".
${contextInstruction}
Please provide appropriate string values for the following placeholder keys:
${placeholderListString}

Consider the likely meaning of each placeholder key when generating its value. For example:
- 'cardName', 'title': Should be a thematic name.
- 'manaCost', 'cost', 'energyCost': Could be a symbolic cost (e.g., "2RR", "3 colorless", "X").
- 'rulesText', 'effectText', 'abilities', 'description': Should be a game mechanic or ability description.
- 'flavorText': Should be a short, evocative sentence (1-2 sentences).
- 'power', 'attack', 'health', 'toughness', 'defense', 'points', 'level', 'attackValue', 'defenseValue': Should be numbers or simple stats (e.g., "3", "X", "Level 4").
- 'artworkUrl', 'art', 'image': Should be a descriptive phrase for image generation (e.g., "fiery dragon attacking castle", "mystic elf enchantress in a forest"). Do NOT generate an actual URL.
- 'cardType', 'type', 'subTypes': Should be appropriate TCG types (e.g., "Creature - Goblin Warrior", "Spell - Instant", "Artifact - Equipment").
- 'rarity': Should be a common TCG rarity (e.g., "Common", "Uncommon", "Rare", "Mythic").
- 'artistName': Should be a thematic artist name.

Return your response as a single, valid JSON object where the keys are the placeholder names from the list above, and the values are your generated strings for each. For example:
{
  "cardName": "Generated Name",
  "manaCost": "Generated Cost",
  "rulesText": "Generated rules text...",
  ... and so on for all provided keys
}`;

    const { output } = await ai.generate({
        prompt: prompt,
        config: {
            temperature: 0.7, // Slightly more creative but still grounded
        }
    });

    let generatedData: Record<string, string> = {};

    if (!output || !output.text) {
      console.warn(`AI did not return any text output for theme "${theme}". Using basic fallback.`);
      // Fallback for no text output
      placeholderKeys.forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes("name")) generatedData[key] = theme;
        else if (keyLower.includes("rules") || (keyLower.includes("text") && !keyLower.includes("flavor")) || keyLower.includes("effect") || keyLower.includes("abilit")) generatedData[key] = `Effect related to ${theme}.`;
        else if (keyLower.includes("flavor")) generatedData[key] = `A ${theme} of great renown.`;
        else if (keyLower.includes("art") || keyLower.includes("image")) generatedData[key] = `Artwork concept: ${theme}`;
        else generatedData[key] = "AI suggestion..."; 
      });
      return { generatedData };
    }

    try {
      let jsonString = output.text;
      // Remove markdown code fences if present
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7);
        if (jsonString.endsWith("```")) {
          jsonString = jsonString.substring(0, jsonString.length - 3);
        }
      }
      jsonString = jsonString.trim();
      const parsedJson = JSON.parse(jsonString);

      // Ensure all requested placeholderKeys are present in the final object, even if AI missed some
      placeholderKeys.forEach(key => {
        generatedData[key] = parsedJson[key] || ""; // Use empty string if AI didn't provide a value for a key
      });
      
      return { generatedData };

    } catch (e) {
      console.error("Failed to parse AI JSON output:", output.text, e);
      // Fallback for JSON parsing failure
      generatedData = {}; // Reset in case of partial parsing before error
      placeholderKeys.forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes("name")) generatedData[key] = theme;
        else if (keyLower.includes("rules") || (keyLower.includes("text") && !keyLower.includes("flavor")) || keyLower.includes("effect") || keyLower.includes("abilit")) generatedData[key] = `Effect related to ${theme}.`;
        else if (keyLower.includes("flavor")) generatedData[key] = `A ${theme} of great renown.`;
        else if (keyLower.includes("art") || keyLower.includes("image")) generatedData[key] = `Artwork concept: ${theme}`;
        else generatedData[key] = "AI suggestion..."; 
      });
      // The calling client component should handle displaying errors or partial success.
      console.warn("AI output wasn't perfect JSON, using basic fallback. Please review fields.");
      return { generatedData };
    }
  }
);
