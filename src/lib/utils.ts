
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TCGCardTemplate } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}

/**
 * Extracts unique placeholder keys and their optional default values from a template's rows and columns.
 * e.g., "{{cardName}} - {{manaCost:"3"}} {{description:"Default description here"}}"
 * Default values must be enclosed in double quotes.
 * @param template The TCGCardTemplate to parse.
 * @returns An array of unique placeholder objects { key: string; defaultValue?: string; }.
 */
export function extractUniquePlaceholderKeys(template?: TCGCardTemplate): ExtractedPlaceholder[] {
  if (!template || !template.rows) return [];
  
  const placeholderMap = new Map<string, ExtractedPlaceholder>();
  const regex = /{{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*}}/g;


  template.rows.forEach(row => {
    row.columns.forEach(section => {
      if (section.contentPlaceholder) {
        let match;
        while ((match = regex.exec(section.contentPlaceholder)) !== null) {
          const key = match[1].trim();
          // For defaultValue (match[2]), unescape escaped quotes if any
          const defaultValue = match[2] !== undefined ? match[2].replace(/\\"/g, '"') : undefined;


          if (!placeholderMap.has(key)) {
            placeholderMap.set(key, { key, defaultValue });
          } else {
            const existing = placeholderMap.get(key)!;
            if (defaultValue !== undefined && existing.defaultValue === undefined) {
              placeholderMap.set(key, { key, defaultValue });
            }
          }
        }
      }
    });
  });
  return Array.from(placeholderMap.values());
}


/**
 * Converts a camelCase or snake_case string to Title Case.
 * e.g., "cardName" -> "Card Name", "my_custom_stat" -> "My Custom Stat"
 * @param text The string to convert.
 * @returns The Title Case string.
 */
export function toTitleCase(text: string): string {
  if (!text) return '';
  const result = text
    .replace(/([A-Z])/g, ' $1') 
    .replace(/_/g, ' ')       
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}


/**
 * Replaces placeholders in a given text string with values from a data object.
 * Handles placeholders like {{key}} and {{key:"Default Value"}}.
 * If removeUnmatched is true, placeholders without corresponding data are removed.
 * If removeUnmatched is false (e.g., for editor preview), they are left as is.
 * @param text The text string with placeholders.
 * @param dataContext The data object with key-value pairs.
 * @param removeUnmatched If true, removes unmatched placeholders.
 * @returns The processed text string.
 */
export function replacePlaceholdersLocal(text: string | undefined, dataContext: CardData, removeUnmatched: boolean): string {
  if (text === undefined || text === null) return '';
  let result = String(text);
  const regex = /{{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*}}/g;


  // First pass: replace placeholders that have data in dataContext
  let match;
  // Create a temporary string for replacement pass to avoid issues with regex exec state
  let tempResult = result;
  while ((match = regex.exec(result)) !== null) {
    const fullMatch = match[0];
    const key = match[1].trim();
    // const defaultValueFromPlaceholder = match[2] !== undefined ? match[2].replace(/\\"/g, '"') : undefined;

    if (dataContext[key] !== undefined && dataContext[key] !== null) {
      tempResult = tempResult.replace(fullMatch, String(dataContext[key]));
    }
    // If dataContext[key] is not found, we leave it for the next step (default value or removal)
  }
  result = tempResult;
  regex.lastIndex = 0; // Reset regex for the next pass


  // Second pass: handle default values from placeholders if dataContext didn't provide a value
  // AND if removeUnmatched is true (meaning we are in final rendering mode)
  // OR if removeUnmatched is false (editor preview, but we still want to see defaults if data is missing)
  // For editor preview, we generally want to see the {{key}} if no data, so this pass is mostly for final render.
  // The pre-population of dataContext with defaults in SingleCardGenerator/EditCardDialog handles this better.
  // This second pass is more of a fallback for direct rendering.

  // If not in editor preview (removeUnmatched = true), handle defaults or remove.
  if (removeUnmatched) {
    tempResult = result;
    while ((match = regex.exec(result)) !== null) {
        const fullMatch = match[0];
        const key = match[1].trim();
        const defaultValueFromPlaceholder = match[2] !== undefined ? match[2].replace(/\\"/g, '"') : undefined;

        // If the key wasn't replaced by dataContext in the first pass AND it has a default in the placeholder string
        if (dataContext[key] === undefined && defaultValueFromPlaceholder !== undefined) {
            tempResult = tempResult.replace(fullMatch, defaultValueFromPlaceholder);
        }
    }
    result = tempResult;
    regex.lastIndex = 0;

    // Final pass for removeUnmatched: remove any remaining placeholders
    result = result.replace(regex, '');
  }
  // If removeUnmatched is false (editor preview), we generally want to leave {{key}} as is.
  // The dataContext passed to editor preview already has {{key}} as value if no default.

  return result;
}
