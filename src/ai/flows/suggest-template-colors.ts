
'use server';
/**
 * @fileOverview Suggests a color palette for a TCG card template based on a theme.
 *
 * - suggestTemplateColors - A function that triggers the color suggestion flow.
 * - SuggestTemplateColorsInput - The input type for the suggestTemplateColors function.
 * - SuggestTemplateColorsOutput - The return type for the suggestTemplateColors function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTemplateColorsInputSchema = z.object({
  theme: z
    .string()
    .describe(
      "The theme for color palette generation (e.g., 'Fiery Volcano', 'Mystic Forest', 'Dark Necromancy', 'Steampunk Contraption')."
    ),
});
export type SuggestTemplateColorsInput = z.infer<typeof SuggestTemplateColorsInputSchema>;

const ColorSuggestionSchema = z.string().describe("A hex color code, e.g., '#RRGGBB'. Leave empty if no specific suggestion for this element based on the theme.");

const SuggestTemplateColorsOutputSchema = z.object({
  baseBackgroundColor: ColorSuggestionSchema.optional(),
  baseTextColor: ColorSuggestionSchema.optional(),
  frameAccentColor: ColorSuggestionSchema.optional(), // A general accent for the frame or important borders
  nameTextColor: ColorSuggestionSchema.optional(),
  nameBackgroundColor: ColorSuggestionSchema.optional(),
  costTextColor: ColorSuggestionSchema.optional(),
  costBackgroundColor: ColorSuggestionSchema.optional(),
  typeLineTextColor: ColorSuggestionSchema.optional(),
  typeLineBackgroundColor: ColorSuggestionSchema.optional(),
  rulesTextBoxColor: ColorSuggestionSchema.optional(),
  rulesTextColor: ColorSuggestionSchema.optional(),
  flavorTextBoxColor: ColorSuggestionSchema.optional(),
  flavorTextColor: ColorSuggestionSchema.optional(),
  ptBoxColor: ColorSuggestionSchema.optional(), // Power/Toughness box
  ptTextColor: ColorSuggestionSchema.optional(),
});
export type SuggestTemplateColorsOutput = z.infer<typeof SuggestTemplateColorsOutputSchema>;

export async function suggestTemplateColors(input: SuggestTemplateColorsInput): Promise<SuggestTemplateColorsOutput> {
  return suggestTemplateColorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTemplateColorsPrompt',
  input: {schema: SuggestTemplateColorsInputSchema},
  output: {schema: SuggestTemplateColorsOutputSchema},
  prompt: `You are an expert TCG card designer with a keen eye for thematic color palettes.
Based on the theme "{{theme}}", suggest a harmonious and visually appealing color palette for a fantasy TCG card template.
Provide hex color codes for the following elements. If a color isn't strongly implied by the theme for a specific element, you can leave it empty or suggest a neutral color that complements the theme.
Focus on readability and thematic consistency.

Theme: {{{theme}}}

Suggest colors for:
- Base Background Color (overall card backdrop)
- Base Text Color (default text color)
- Frame Accent Color (for borders or key frame elements)
- Name Text Color
- Name Background Color (if different from base)
- Cost Text Color
- Cost Background Color (if different from base)
- Type Line Text Color
- Type Line Background Color
- Rules Text Box Color (background of the main text area)
- Rules Text Color
- Flavor Text Box Color (if different from rules box)
- Flavor Text Color
- P/T Box Color (Power/Toughness box background)
- P/T Text Color
`,
});

const suggestTemplateColorsFlow = ai.defineFlow(
  {
    name: 'suggestTemplateColorsFlow',
    inputSchema: SuggestTemplateColorsInputSchema,
    outputSchema: SuggestTemplateColorsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
    