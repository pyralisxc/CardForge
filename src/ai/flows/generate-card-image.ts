
'use server';
/**
 * @fileOverview Generates card artwork using AI based on a textual concept.
 *
 * - generateCardImage - A function that triggers the image generation flow.
 * - GenerateCardImageInput - The input type for the generateCardImage function.
 * - GenerateCardImageOutput - The return type for the generateCardImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardImageInputSchema = z.object({
  cardConcept: z
    .string()
    .describe(
      "A description of the card concept for image generation, e.g., 'Fire breathing dragon attacking a castle', 'Mystical elf enchantress in a forest'."
    ),
});
export type GenerateCardImageInput = z.infer<typeof GenerateCardImageInputSchema>;

const GenerateCardImageOutputSchema = z.object({
  imageDataUri: z
    .string()
    .describe("The generated image as a Base64 encoded Data URI."),
});
export type GenerateCardImageOutput = z.infer<typeof GenerateCardImageOutputSchema>;

export async function generateCardImage(input: GenerateCardImageInput): Promise<GenerateCardImageOutput> {
  return generateCardImageFlow(input);
}

const generateCardImageFlow = ai.defineFlow(
  {
    name: 'generateCardImageFlow',
    inputSchema: GenerateCardImageInputSchema,
    outputSchema: GenerateCardImageOutputSchema,
  },
  async (input) => {
    const {media, text} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // IMPORTANT: Use the specified model for image generation
      prompt: `You are an AI image generation assistant for a fantasy Trading Card Game. 
Generate a piece of artwork suitable for a TCG card based on the following concept: "${input.cardConcept}". 
The image should be visually appealing and fit a high fantasy theme. Focus on a single subject or a clear scene.
Ensure the style is suitable for TCG card art.
Output a brief textual description of the image you generated.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE
        // Optional: Add safety settings if needed, though defaults are usually fine for SFW fantasy art
        // safetySettings: [
        //   { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        // ],
      },
    });
    
    if (!media || !media.url) {
      // Attempt to use the text output as an error message if image generation failed
      const failureReason = text || "Image generation failed for an unknown reason.";
      console.error("Image generation failure:", failureReason);
      throw new Error(`Image generation failed: ${failureReason}`);
    }
    
    // console.log("Generated text description from model:", text); // For debugging what text comes with the image
    return { imageDataUri: media.url };
  }
);
