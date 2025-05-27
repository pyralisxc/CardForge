import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts unique placeholder keys from a string.
 * e.g., "{{cardName}} - {{manaCost}}, {{cardName}}" -> ["cardName", "manaCost"]
 * @param text The string to parse.
 * @returns An array of unique placeholder keys.
 */
export function extractUniquePlaceholderKeys(text?: string): string[] {
  if (!text) return [];
  const regex = /{{(.*?)}}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1].trim());
  }
  return Array.from(matches);
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
    .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
    .replace(/_/g, ' ')       // Replace underscores with spaces
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}
