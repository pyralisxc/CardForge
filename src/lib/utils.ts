
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TCGCardTemplate } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts unique placeholder keys from a template's rows and columns.
 * e.g., "{{cardName}} - {{manaCost}}, {{cardName}}" -> ["cardName", "manaCost"]
 * @param template The TCGCardTemplate to parse.
 * @returns An array of unique placeholder keys.
 */
export function extractUniquePlaceholderKeys(template?: TCGCardTemplate): string[] {
  if (!template || !template.rows) return [];
  
  const placeholderSet = new Set<string>();
  const regex = /{{\s*([\w-]+)\s*}}/g; // Simpler regex for {{key}}

  template.rows.forEach(row => {
    row.columns.forEach(section => {
      if (section.contentPlaceholder) {
        let match;
        while ((match = regex.exec(section.contentPlaceholder)) !== null) {
          placeholderSet.add(match[1].trim());
        }
      }
    });
  });
  return Array.from(placeholderSet);
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
