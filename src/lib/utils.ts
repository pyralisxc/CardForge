
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TCGCardTemplate, CardData, CardSection } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}

/**
 * Extracts unique placeholder keys and their optional default values from a template's structure.
 * Placeholders are scanned from contentPlaceholder (if sectionContentType is 'placeholder')
 * and backgroundImageUrl fields. For image sections, contentPlaceholder is the key itself.
 * e.g., "{{cardName}}", "{{manaCost:"3"}}", "artworkUrl" (for image section)
 * Default values must be enclosed in double quotes.
 * @param template The TCGCardTemplate to parse.
 * @returns An array of unique placeholder objects { key: string; defaultValue?: string; }.
 */
export function extractUniquePlaceholderKeys(template?: TCGCardTemplate): ExtractedPlaceholder[] {
  if (!template || !template.rows) return [];

  const placeholderMap = new Map<string, ExtractedPlaceholder>();
  const placeholderRegex = /\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g; // For text placeholders

  const processStringForPlaceholders = (str: string | undefined) => {
    if (!str) return;
    let match;
    placeholderRegex.lastIndex = 0; 
    while ((match = placeholderRegex.exec(str)) !== null) {
      const key = match[1].trim();
      const defaultValue = match[2] !== undefined ? match[2].replace(/\\"/g, '"') : undefined;

      if (!placeholderMap.has(key) || (defaultValue !== undefined && placeholderMap.get(key)!.defaultValue === undefined)) {
        placeholderMap.set(key, { key, defaultValue });
      }
    }
  };

  template.rows.forEach(row => {
    row.columns.forEach(section => {
      if (section.sectionContentType === 'image') {
        if (section.contentPlaceholder && !placeholderMap.has(section.contentPlaceholder)) {
          placeholderMap.set(section.contentPlaceholder, { key: section.contentPlaceholder });
        }
      } else { // 'placeholder' type
        processStringForPlaceholders(section.contentPlaceholder);
      }
      processStringForPlaceholders(section.backgroundImageUrl); // Always check backgroundImageUrl
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
  // Split by uppercase letters or underscores/hyphens
  const result = text
    .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
    .replace(/[_-]/g, ' ')    // Replace underscores/hyphens with spaces
    .trim();
  
  // Capitalize first letter of each word
  return result
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
  const regex = /\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g;

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
      return ''; 
    }
    return fullMatch; 
  });

  return result;
}
