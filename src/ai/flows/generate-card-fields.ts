
'use server';
/**
 * @fileOverview Generates thematic string values for a list of placeholder keys based on a given theme.
 *
 * - generateCardFields - A function that triggers the field generation flow.
 * - GenerateCardFieldsInput - The input type for the generateCardFields function.
 * - GenerateCardFieldsOutput - The return type for the generateCardFields function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardFieldsInputSchema = z.object({
  theme: z
    .string()
    .describe('The overall theme or concept for the TCG card (e.g., "Goblin Archer", "Ancient Spell of Shielding", "Mysterious Forest Spirit").'),
  placeholderKeys: z
    .array(z.string())
    .describe('An array of placeholder keys for which values need to be generated (e.g., ["cardName", "manaCost", "rulesText", "attackValue", "flavorText"]).'),
});
export type GenerateCardFieldsInput = z.infer<typeof GenerateCardFieldsInputSchema>;

// The output will be a dynamic object where keys are the placeholderKeys provided in input,
// and values are the generated strings.
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
    const { theme, placeholderKeys } = input;

    // Constructing a dynamic prompt to ask for values for each key.
    // The model is asked to provide a JSON object as a string, which we will parse.
    // We are using ai.generate directly because the prompt structure is highly dynamic.
    const placeholderListString = placeholderKeys.map(key => `- ${key}`).join('\n');
    const prompt = `You are a creative AI assistant specializing in fantasy Trading Card Games (TCGs).
Your task is to generate thematic content for a TCG card based on the theme: "${theme}".

Please provide appropriate string values for the following placeholder keys:
${placeholderListString}

Consider the likely meaning of each placeholder key when generating its value. For example:
- 'cardName' should be a thematic name.
- 'manaCost' could be a symbolic cost (e.g., "2RR", "3 colorless").
- 'rulesText' or 'effectText' should be a game mechanic or ability.
- 'flavorText' should be a short, evocative sentence.
- 'attackValue', 'power', 'health', 'defense', 'toughness' should be numbers or simple stats (e.g., "3", "X").
- 'artworkUrl' should be a descriptive phrase for image generation (e.g., "fiery dragon attacking castle").
- 'cardType', 'subTypes' should be appropriate TCG types (e.g., "Creature - Goblin Warrior", "Spell - Instant").

Return your response as a single JSON object where the keys are the placeholder names from the list above, and the values are your generated strings for each. For example:
{
  "cardName": "Generated Name",
  "manaCost": "Generated Cost",
  "rulesText": "Generated rules text...",
  ... and so on for all provided keys
}`;

    const { output } = await ai.generate({
        prompt: prompt,
        // No specific model output schema here as we're asking for dynamic JSON and will parse it.
        // We rely on the model to follow the JSON output instruction.
        config: {
            // safetySettings can be added if needed
            // temperature: 0.8, // Slightly more creative
        }
    });

    if (!output || !output.text) {
      throw new Error("AI did not return any text.");
    }

    let generatedData: Record<string, string> = {};
    try {
      // Attempt to parse the AI's text output as JSON
      // The model might sometimes return the JSON string within ```json ... ```, so we try to strip that.
      let jsonString = output.text;
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7);
        if (jsonString.endsWith("```")) {
          jsonString = jsonString.substring(0, jsonString.length - 3);
        }
      }
      jsonString = jsonString.trim();
      generatedData = JSON.parse(jsonString);

      // Ensure all requested keys are present, even if with empty string, to match schema
      const completeData: Record<string, string> = {};
      placeholderKeys.forEach(key => {
        completeData[key] = generatedData[key] || ""; // Use AI value or empty string
      });
      return { generatedData: completeData };

    } catch (e) {
      console.error("Failed to parse AI JSON output:", output.text, e);
      // Fallback: Try to populate based on common patterns if JSON parsing fails
      // This is a very basic fallback and might not work well for complex placeholder sets.
      generatedData = {};
      placeholderKeys.forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes("name")) generatedData[key] = theme;
        else if (keyLower.includes("rules") || keyLower.includes("text") && !keyLower.includes("flavor")) generatedData[key] = `Effect related to ${theme}.`;
        else if (keyLower.includes("flavor")) generatedData[key] = `A ${theme} of great renown.`;
        else generatedData[key] = "AI suggestion..."; // Generic fallback
      });
      toast({
          title: "AI Parsing Issue",
          description: "AI output wasn't perfect JSON, using basic fallback. Please review fields.",
          variant: "default"
      });
      return { generatedData };
    }
  }
);
