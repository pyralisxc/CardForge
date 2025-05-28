
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TCGCardTemplate } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ExtractedPlaceholder {
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
  // Regex to capture:
  // 1. The key (alphanumeric, hyphens, underscores)
  // 2. Optionally, a colon and a double-quoted default value
  const regex = /{{\s*([\w-]+)\s*(?::\s*"([^"]*)")?\s*}}/g;

  template.rows.forEach(row => {
    row.columns.forEach(section => {
      if (section.contentPlaceholder) {
        let match;
        while ((match = regex.exec(section.contentPlaceholder)) !== null) {
          const key = match[1].trim();
          const defaultValue = match[2]; // This will be undefined if no default value is present

          if (!placeholderMap.has(key)) {
            placeholderMap.set(key, { key, defaultValue });
          } else {
            // If key already exists, only update if a new default value is found and old one was undefined
            // This prioritizes the first encountered default value if multiple exist for the same key
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
  // Handle cases like "manaCost" -> "Mana Cost" and "my_stat" -> "My Stat"
  const result = text
    .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters in camelCase
    .replace(/_/g, ' ')       // Replace underscores with spaces
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase().replace(/\b\w/g, char => char.toUpperCase()); // Title case words
}
