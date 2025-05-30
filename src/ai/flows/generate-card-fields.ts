
'use server';
/**
 * @fileOverview Generates thematic string values for a list of placeholder keys based on a given theme.
 * For artwork placeholders, it now explicitly sets a placeholder.co URL.
 *
 * - generateCardFields - A function that triggers the field generation flow.
 * - GenerateCardFieldsInput - The input type for the generateCardFields function.
 * - GenerateCardFieldsOutput - The return type for the generateCardFields function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const GenerateCardFieldsInputSchema = z.object({
  theme: z
    .string()
    .describe('The overall theme or concept for the TCG card (e.g., "Goblin Archer", "Ancient Spell of Shielding", "Mysterious Forest Spirit").'),
  placeholderKeys: z
    .array(z.string())
    .describe('An array of placeholder keys for which values need to be generated (e.g., ["cardName", "manaCost", "rulesText", "artworkUrl", "flavorText", "artistName"]).'),
});
export type GenerateCardFieldsInput = z.infer<typeof GenerateCardFieldsInputSchema>;

const GenerateCardFieldsOutputSchema = z.object({
    generatedData: z.record(z.string()).describe("An object where keys are the placeholder keys from the input, and values are the AI-generated strings (or a placeholder.co URL for artwork) for those fields.")
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
    console.log('Generating card fields for theme:', theme, 'Keys:', placeholderKeys);

    const placeholderListString = placeholderKeys.map(key => `- ${key}`).join('\n');
    
    const textGenPrompt = `You are a creative AI assistant specializing in fantasy Trading Card Games (TCGs).
Your task is to generate thematic content for a TCG card based on the theme: "${theme}".

Please provide appropriate string values for the following placeholder keys:
${placeholderListString}

Consider the likely meaning of each placeholder key when generating its value. For example:
- 'cardName', 'title': Should be a thematic name.
- 'manaCost', 'cost', 'energyCost': Could be a symbolic cost (e.g., "2RR", "3 colorless", "X").
- 'rulesText', 'effectText', 'abilities', 'description': Should be a game mechanic or ability description.
- 'flavorText': Should be a short, evocative sentence (1-2 sentences).
- 'power', 'attack', 'health', 'toughness', 'defense', 'points', 'level', 'attackValue', 'defenseValue': Should be numbers or simple stats (e.g., "3", "X", "Level 4").
- 'cardType', 'type', 'subTypes': Should be appropriate TCG types (e.g., "Creature - Goblin Warrior", "Spell - Instant", "Artifact - Equipment").
- 'rarity': Should be a common TCG rarity (e.g., "Common", "Uncommon", "Rare", "Mythic").
- 'artistName': For 'artistName', generate a thematic fictional artist name (e.g., 'Elara Meadowlight', 'Studio Glimmerforge'). Do NOT provide URLs or image descriptions for 'artistName'.
- For any keys that sound like they are for an image or artwork (e.g., 'artworkUrl', 'art', 'image', 'cardArt', 'illustration'): Return an empty string "" or the exact word "IGNORE". DO NOT generate a description or any other text value for these artwork keys.

Return your response as a single, valid JSON object where the keys are the placeholder names from the list above, and the values are your generated strings for each. For example:
{
  "cardName": "Generated Name",
  "manaCost": "Generated Cost",
  "artworkUrl": "", 
  "artistName": "Elara Meadowlight",
  ... and so on for all provided keys
}`;

    const { output: textOutput } = await ai.generate({
        prompt: textGenPrompt,
        config: {
            temperature: 0.7, 
        }
    });

    let generatedData: Record<string, string> = {};

    const isArtworkKey = (key: string): boolean => {
        const keyLower = key.toLowerCase();
        return keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl") || keyLower.includes("illustration");
    };
    
    const fallbackPlaceholderValues = (reason: string) => {
      console.warn(`AI text generation issue for generateCardFields (${reason}). Using fallback placeholder values for theme "${theme}".`);
      placeholderKeys.forEach(key => {
        if (isArtworkKey(key)) {
            generatedData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " Art")}`;
        } else if (key.toLowerCase().includes("name")) generatedData[key] = theme;
        else if (key.toLowerCase().includes("rules") || (key.toLowerCase().includes("text") && !key.toLowerCase().includes("flavor")) || key.toLowerCase().includes("effect") || key.toLowerCase().includes("abilit")) generatedData[key] = `Default effect related to ${theme}.`;
        else if (key.toLowerCase().includes("flavor")) generatedData[key] = `A ${theme} of great renown.`;
        else if (key.toLowerCase().includes("artistname")) generatedData[key] = "AI Artist";
        else generatedData[key] = `Missing: ${key}`; 
      });
    };

    if (!textOutput || !textOutput.text) {
      fallbackPlaceholderValues("AI did not return any text output");
    } else {
      try {
        let jsonString = textOutput.text;
        // Strip markdown if present
        if (jsonString.startsWith("```json")) {
          jsonString = jsonString.substring(7);
          if (jsonString.endsWith("```")) {
            jsonString = jsonString.substring(0, jsonString.length - 3);
          }
        }
        jsonString = jsonString.trim();
        const parsedJson = JSON.parse(jsonString);
        console.log("Parsed JSON from AI text generation (generateCardFields):", parsedJson);

        placeholderKeys.forEach(key => {
          if (parsedJson[key] !== undefined && String(parsedJson[key]).trim() !== "" && String(parsedJson[key]).toUpperCase() !== "IGNORE") {
            generatedData[key] = String(parsedJson[key]);
          } else {
            generatedData[key] = ""; // Initialize to empty if AI omitted or said IGNORE
          }
        });
        
      } catch (e) {
        console.error("Failed to parse AI JSON output for text fields (generateCardFields):", textOutput.text, e);
        fallbackPlaceholderValues("JSON parsing failed");
      }
    }
    
    // Ensure all requested keys have some value, applying specific fallbacks including for artwork
    placeholderKeys.forEach(key => {
        if (isArtworkKey(key)) {
            // ALWAYS set artwork keys to placeholder.co, overriding any AI value or if it was empty/IGNORE
            generatedData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " Art")}`;
        } else if (key.toLowerCase() === "artistname") {
            const artistValue = String(generatedData[key] || "").trim();
            if (artistValue.startsWith("http://") || artistValue.startsWith("https://") || artistValue.startsWith("data:")) {
                console.warn(`AI provided a URL for artistName ('${key}'). Replacing with fallback 'AI Artist'.`);
                generatedData[key] = "AI Artist"; 
            } else if (artistValue === "") {
                generatedData[key] = "AI Artist"; // Default if empty
            }
        } else if (generatedData[key] === undefined || String(generatedData[key]).trim() === "") {
            // Apply general fallbacks for other non-artwork keys if they are still empty.
            if (key.toLowerCase().includes("name")) generatedData[key] = theme;
            else if (key.toLowerCase().includes("rules") || (key.toLowerCase().includes("text") && !key.toLowerCase().includes("flavor")) || key.toLowerCase().includes("effect") || key.toLowerCase().includes("abilit")) generatedData[key] = `Default effect for ${theme}.`;
            else if (key.toLowerCase().includes("flavor")) generatedData[key] = `Default flavor text for ${theme}.`;
            else generatedData[key] = `Missing: ${key}`; 
        }
    });

    console.log("Final generatedData before returning (generateCardFields):", generatedData);
    return { generatedData };
  }
);
