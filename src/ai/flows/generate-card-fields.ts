
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
    console.log('Generating card fields for theme:', theme, 'Keys:', placeholderKeys);

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
      console.warn(`Using fallback placeholder values for theme "${theme}".`);
      placeholderKeys.forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes("name")) generatedData[key] = theme;
        else if (keyLower.includes("rules") || (keyLower.includes("text") && !keyLower.includes("flavor")) || keyLower.includes("effect") || keyLower.includes("abilit")) generatedData[key] = `Effect related to ${theme}.`;
        else if (keyLower.includes("flavor")) generatedData[key] = `A ${theme} of great renown.`;
        else if (keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl")) {
            generatedData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme)}`;
            if (!artworkKey) artworkKey = key; 
        }
        else generatedData[key] = "AI suggestion..."; 
      });
    };

    if (!textOutput || !textOutput.text) {
      console.warn(`AI did not return any text output for theme "${theme}".`);
      fallbackPlaceholderValues();
    } else {
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
        console.log("Parsed JSON from AI text generation:", parsedJson);

        placeholderKeys.forEach(key => {
          const keyLower = key.toLowerCase();
          const isArtKey = keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl");

          if (parsedJson[key] !== undefined) {
            generatedData[key] = String(parsedJson[key]); // Ensure it's a string
            if (isArtKey && typeof parsedJson[key] === 'string' && parsedJson[key].trim() !== "") {
              if (!artworkKey) { // Prioritize the first art-related key that has a description
                  artworkDescription = parsedJson[key].trim();
                  artworkKey = key;
                  console.log(`Found artwork description for key '${key}': "${artworkDescription}"`);
              }
            }
          } else {
            generatedData[key] = ""; // AI didn't provide, initialize to empty
             console.log(`AI did not provide value for key '${key}'.`);
          }
        });
        
      } catch (e) {
        console.error("Failed to parse AI JSON output for text fields:", textOutput.text, e);
        fallbackPlaceholderValues();
      }
    }

    // If no artworkDescription was specifically found in the parsed JSON for an art key,
    // but an art key *exists* in placeholderKeys, identify it so we can try generating an image using the theme.
    if (!artworkDescription && !artworkKey) {
        artworkKey = placeholderKeys.find(k => {
            const kl = k.toLowerCase();
            return kl.includes("art") || kl.includes("image") || kl.includes("artworkurl");
        }) || null;
        if (artworkKey) {
            console.log(`No specific artwork description found in JSON, but artwork key '${artworkKey}' exists in template. Will use theme for image generation.`);
        }
    }
    
    // Attempt image generation if an artworkKey has been identified
    if (artworkKey) {
      const imageGenConcept = artworkDescription || theme; // Use specific description if available, otherwise general theme
      console.log(`Attempting image generation for key '${artworkKey}' using concept: "${imageGenConcept}"`);
      try {
        const {media, text: imageGenText} = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: `You are an AI image generation assistant for a fantasy Trading Card Game. Generate artwork for a TCG card based on the concept: "${imageGenConcept}". Ensure the style is suitable for TCG card art. Output a brief textual description of the image you generated.`,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });
        
        if (media && media.url) {
          generatedData[artworkKey] = media.url; 
          console.log(`Successfully generated image for ${artworkKey}. URI starts with: ${media.url.substring(0, 100)}...`);
        } else {
          console.warn(`AI image generation failed or no media URL returned for concept "${imageGenConcept}". Text from model: ${imageGenText}. Falling back for key: ${artworkKey}`);
          generatedData[artworkKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Img Gen Fail)")}`;
        }
      } catch (imgError) {
        console.error(`Error during AI image generation for ${artworkKey} (concept: "${imageGenConcept}"):`, imgError);
        generatedData[artworkKey] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Img Gen Error)")}`;
      }
    } else {
        console.log("No artwork key identified in placeholders. Skipping image generation.");
    }
    
    // Final check to ensure all requested keys have some value and to fill any art keys missed by specific generation
    placeholderKeys.forEach(key => {
        if (generatedData[key] === undefined || generatedData[key] === "") {
            const keyLower = key.toLowerCase();
            if (keyLower.includes("art") || keyLower.includes("image") || keyLower.includes("artworkurl")) {
                 // This key was an art key but didn't get an image or a fallback yet (e.g., if 'artworkKey' was a different art key)
                generatedData[key] = `https://placehold.co/600x400.png?text=${encodeURIComponent(theme + " (Art Fallback)")}`;
                console.log(`Applied final fallback placeholder image for art key '${key}'.`);
            } else {
                 generatedData[key] = `Missing: ${key}`; 
                 console.log(`Key '${key}' was missing a value after all steps. Set to "Missing: ${key}".`);
            }
        }
    });

    console.log("Final generatedData before returning:", generatedData);
    return { generatedData };
  }
);

