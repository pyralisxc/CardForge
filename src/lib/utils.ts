
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TCGCardTemplate, CardData } from "@/types"; // Correctly import CardData

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}

/**
 * Extracts unique placeholder keys and their optional default values from a template's structure.
 * Placeholders are scanned from contentPlaceholder and backgroundImageUrl fields.
 * e.g., "{{cardName}}", "{{manaCost:"3"}}", "{{backgroundImage:"default.png"}}"
 * Default values must be enclosed in double quotes.
 * @param template The TCGCardTemplate to parse.
 * @returns An array of unique placeholder objects { key: string; defaultValue?: string; }.
 */
export function extractUniquePlaceholderKeys(template?: TCGCardTemplate): ExtractedPlaceholder[] {
  if (!template || !template.rows) return [];

  const placeholderMap = new Map<string, ExtractedPlaceholder>();
  const regex = /{{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*}}/g;

  const processStringForPlaceholders = (str: string | undefined) => {
    if (!str) return;
    let match;
    // Must reset lastIndex before each exec loop on a new string or with global regex
    regex.lastIndex = 0;
    while ((match = regex.exec(str)) !== null) {
      const key = match[1].trim();
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
  };

  template.rows.forEach(row => {
    row.columns.forEach(section => {
      processStringForPlaceholders(section.contentPlaceholder);
      processStringForPlaceholders(section.backgroundImageUrl);
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
 * If removeUnmatched is true, placeholders without corresponding data (and no default in the string) are removed.
 * If removeUnmatched is false (e.g., for editor preview), they are left as is.
 * @param text The text string with placeholders.
 * @param dataContext The data object with key-value pairs.
 * @param removeUnmatchedIfNoDefault If true, removes unmatched placeholders that don't have a default in the string.
 * @returns The processed text string.
 */
export function replacePlaceholdersLocal(text: string | undefined, dataContext: CardData, removeUnmatchedIfNoDefault: boolean): string {
  if (text === undefined || text === null) return '';
  let result = String(text);
  const regex = /{{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*}}/g;

  // Iterate over matches and replace them
  // This needs to be done carefully with global regex to avoid infinite loops or missed replacements
  // A common approach is to build a new string or replace from right to left,
  // or use a function with String.prototype.replace
  result = result.replace(regex, (fullMatch, key, defaultValueFromPlaceholder) => {
    const cleanKey = key.trim();
    const cleanDefault = defaultValueFromPlaceholder !== undefined ? defaultValueFromPlaceholder.replace(/\\"/g, '"') : undefined;

    if (dataContext[cleanKey] !== undefined && dataContext[cleanKey] !== null) {
      return String(dataContext[cleanKey]);
    }
    if (cleanDefault !== undefined) {
      return cleanDefault;
    }
    if (removeUnmatchedIfNoDefault) {
      return ''; // Remove if no data and no default in placeholder string
    }
    return fullMatch; // Leave as is (e.g., for editor preview)
  });

  return result;
}
