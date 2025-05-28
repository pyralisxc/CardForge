
'use server';
/**
 * @fileOverview Generates thematic string values for a list of placeholder keys based on a given theme and optional context.
 * If an artwork placeholder is present, it attempts to generate an image and provide its Data URI.
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
    .describe('An array of placeholder keys for which values need to be generated (e.g., ["cardName", "manaCost", "rulesText", "attackValue", "flavorText", "artworkUrl"]).'),
  abilityContext: z
    .string()
    .optional()
    .describe('Optional: A block of text describing game rules, specific abilities, or lore to guide the generation.')
});
export type GenerateCardFieldsInput = z.infer<typeof GenerateCardFieldsInputSchema>;

const GenerateCardFieldsOutputSchema = z.object({
    generatedData: z.record(z.string()).describe("An object where keys are the placeholder keys from the input, and values are the AI-generated strings (or Data URI for artwork) for those fields.")
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

    const textGenPrompt = `You are a creative AI assistant specializing in fantasy Trading Card Games (TCGs).
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
- 'artworkUrl', 'art', 'image', 'cardArt': For these keys, provide a DETAILED DESCRIPTIVE PHRASE for image generation (e.g., "fiery dragon with scales shimmering red and gold, attacking a dark stone castle keep during a stormy night, lightning in background", "mystic elf enchantress in an ancient, glowing forest, holding a crystal staff, with ethereal wisps of light around her"). Do NOT generate an actual URL or Data URI for this part.
- 'cardType', 'type', 'subTypes': Should be appropriate TCG types (e.g., "Creature - Goblin Warrior", "Spell - Instant", "Artifact - Equipment").
- 'rarity': Should be a common TCG rarity (e.g., "Common", "Uncommon", "Rare", "Mythic").
- 'artistName': Should be a thematic artist name.

Return your response as a single, valid JSON object where the keys are the placeholder names from the list above, and the values are your generated strings for each. For example:
{
  "cardName": "Generated Name",
  "manaCost": "Generated Cost",
  "artworkUrl": "Detailed description for an image of Generated Name",
  ... and so on for all provided keys
}`;

    const { output: textOutput } = await ai.generate({
        prompt: textGenPrompt,
        config: {
            temperature: 0.7, 
        }
    });

    let generatedData: Record<string, string> = {};
    let artworkDescription: string | null = null;
    let artworkKey: string | null = null;

    const fallbackPlaceholderValues = () => {
      placeholderKeys.forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes("name")) generatedData[key] = theme;
        else if (keyLower.includes("rules") || (keyLower.includes("text") && !keyLower.includes("flavor")) || keyLower.includes("effect") || keyLower.includes("abilit")) generatedData[key] = `Effect related to ${theme}.`;
        else if (keyLower.includes("flavor")) generatedData[key] = `A ${theme} of great renown.`;
        else if (keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl")) {
            generatedData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme)}`;
            if (!artworkKey) artworkKey = key; // Keep track of the first art-related key
        }
        else generatedData[key] = "AI suggestion..."; 
      });
    };

    if (!textOutput || !textOutput.text) {
      console.warn(`AI did not return any text output for theme "${theme}". Using basic fallback.`);
      fallbackPlaceholderValues();
      return { generatedData };
    }

    try {
      let jsonString = textOutput.text;
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7);
        if (jsonString.endsWith("```")) {
          jsonString = jsonString.substring(0, jsonString.length - 3);
        }
      }
      jsonString = jsonString.trim();
      const parsedJson = JSON.parse(jsonString);

      placeholderKeys.forEach(key => {
        generatedData[key] = parsedJson[key] || ""; // Use empty string if AI didn't provide
        const keyLower = key.toLowerCase();
        if (keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl")) {
          if (generatedData[key] && typeof generatedData[key] === 'string' && (generatedData[key] as string).length > 10) { // Heuristic for a description
            artworkDescription = generatedData[key] as string;
            artworkKey = key;
          }
        }
      });
      
    } catch (e) {
      console.error("Failed to parse AI JSON output for text fields:", textOutput.text, e);
      fallbackPlaceholderValues();
      // Even if text gen fails, we still want to return some data
    }

    // If an artwork key and description were identified, attempt image generation
    if (artworkKey && artworkDescription) {
      try {
        console.log(`Attempting image generation for concept: "${artworkDescription}"`);
        const {media, text: imageGenText} = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: `You are an AI image generation assistant for a fantasy Trading Card Game. Generate a piece of artwork suitable for a TCG card based on the following detailed concept: "${artworkDescription}". Ensure the style is suitable for TCG card art. Output a brief textual description of the image you generated.`,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });
        
        if (media && media.url) {
          generatedData[artworkKey] = media.url; // Replace description with Data URI
          console.log(`Successfully generated image for ${artworkKey}.`);
        } else {
          console.warn(`AI image generation failed or no media URL returned. Text: ${imageGenText}. Falling back for key: ${artworkKey}`);
          generatedData[artworkKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Img Fail)")}`;
        }
      } catch (imgError) {
        console.error(`Error during AI image generation for ${artworkKey}:`, imgError);
        generatedData[artworkKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Img Error)")}`;
      }
    } else if (artworkKey && !artworkDescription) {
      // If there's an art key but no description came from the AI text gen, use the theme
      // This is a fallback path.
      console.log(`No specific art description, using theme "${theme}" for image generation for key: ${artworkKey}`);
       try {
        const {media, text: imageGenText} = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: `You are an AI image generation assistant for a fantasy Trading Card Game. Generate artwork for a TCG card based on the theme: "${theme}". Ensure the style is suitable for TCG card art. Output a brief textual description of the image generated.`,
          config: { responseModalities: ['TEXT', 'IMAGE'] },
        });
        if (media && media.url) {
          generatedData[artworkKey] = media.url;
        } else {
           console.warn(`AI image generation (theme fallback) failed. Text: ${imageGenText}. Falling back for key: ${artworkKey}`);
           generatedData[artworkKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Img Fail)")}`;
        }
      } catch (imgError) {
        console.error(`Error during AI image generation (theme fallback) for ${artworkKey}:`, imgError);
        generatedData[artworkKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Img Error)")}`;
      }
    } else {
        // Ensure any art key that didn't get processed for image gen still gets a placeholder
        placeholderKeys.forEach(key => {
            const keyLower = key.toLowerCase();
             if ((keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl")) && !generatedData[key]) {
                generatedData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme)}`;
             }
        });
    }
    
    // Final check to ensure all requested keys have some value
    placeholderKeys.forEach(key => {
        if (generatedData[key] === undefined || generatedData[key] === "") {
            // A simple fallback if a key was completely missed after all steps
            generatedData[key] = `Missing: ${key}`; 
        }
    });

    return { generatedData };
  }
);
