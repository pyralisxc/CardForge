
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TCGCardTemplate, CardData, FreeformCardElement } from "@/types";
import Papa from "papaparse";
import { TCG_ASPECT_RATIO } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}

const PLACEHOLDER_REGEX = /\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g;

const STATIC_IMAGE_SOURCE_PREFIXES = ['http://', 'https://', 'data:', 'blob:', 'css:', 'linear-gradient', 'radial-gradient', '/'];

const isStaticImageSource = (value: string): boolean => {
  const lower = value.toLowerCase();
  return STATIC_IMAGE_SOURCE_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const sanitizeImageFieldPart = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export function getBoundImageFieldKey(element: Pick<FreeformCardElement, 'imageSource' | 'content'>): string | undefined {
  const candidates = [element.imageSource, element.content];

  for (const candidate of candidates) {
    if (!candidate) continue;

    PLACEHOLDER_REGEX.lastIndex = 0;
    const placeholderMatch = PLACEHOLDER_REGEX.exec(candidate);
    if (placeholderMatch?.[1]) {
      return placeholderMatch[1].trim();
    }

    const trimmed = candidate.trim();
    if (!trimmed || isStaticImageSource(trimmed)) continue;
    if (/^[\w-]+$/.test(trimmed)) return trimmed;
  }

  return undefined;
}

export function deriveImageFieldKey(element: Pick<FreeformCardElement, 'id' | 'name'>): string {
  const namePart = sanitizeImageFieldPart(element.name || 'image');
  const idPart = sanitizeImageFieldPart(element.id || 'layer');
  return `image_${namePart || 'image'}_${idPart || 'layer'}`;
}

export function getImageFieldKeyForElement(
  element: Pick<FreeformCardElement, 'id' | 'name' | 'imageSource' | 'content'>
): string {
  return getBoundImageFieldKey(element) || deriveImageFieldKey(element);
}

/**
 * Extracts unique placeholder keys and their optional default values from a template's structure.
 * Placeholders are scanned from freeform element content, image sources,
 * background image URLs, and template-level image fields.
 * e.g., "{{cardName}}", "{{manaCost:"3"}}", "artworkUrl" (for image elements)
 * Default values must be enclosed in double quotes.
 * @param template The TCGCardTemplate to parse.
 * @returns An array of unique placeholder objects { key: string; defaultValue?: string; }.
 */
export function extractUniquePlaceholderKeys(template?: TCGCardTemplate): ExtractedPlaceholder[] {
  if (!template) return [];

  const placeholderMap = new Map<string, ExtractedPlaceholder>();

  const processStringForPlaceholders = (str: string | undefined) => {
    if (!str) return;
    let match;
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_REGEX.exec(str)) !== null) {
      const key = match[1].trim();
      const defaultValue = match[2] !== undefined
        ? match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        : undefined;

      if (!placeholderMap.has(key) || (defaultValue !== undefined && placeholderMap.get(key)!.defaultValue === undefined)) {
        placeholderMap.set(key, { key, defaultValue });
      }
    }
  };

  processStringForPlaceholders(template.cardBackgroundImageUrl);

  template.freeformCanvas?.elements?.forEach(element => {
    if (element.type === 'image') {
      const source = element.imageSource || element.content;

      const imageFieldKey = getImageFieldKeyForElement(element);
      const imageFieldExists = placeholderMap.has(imageFieldKey);
      if (!imageFieldExists) {
        const defaultValue = source && isStaticImageSource(source.trim()) ? source.trim() : undefined;
        placeholderMap.set(imageFieldKey, { key: imageFieldKey, defaultValue });
      }

      processStringForPlaceholders(source);
    } else {
      processStringForPlaceholders(element.content);
    }
    processStringForPlaceholders(element.backgroundImageUrl);
  });

  return Array.from(placeholderMap.values());
}

export function extractPlaceholderKeysFromText(text?: string): string[] {
  if (!text) return [];
  const keys: string[] = [];
  let match;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    const key = match[1]?.trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
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
    const cleanDefault = defaultValueFromPlaceholder !== undefined
      ? defaultValueFromPlaceholder.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : undefined;

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

export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: string; // CSS color
  color?: string;     // CSS color
}

/**
 * Parses a subset of markdown-like rich text syntax into an array of spans.
 * Supported: **bold**, _italic_, __underline__, ==highlight==, [color:#hex]text[/color]
 */
export function parseRichText(text: string): RichTextSpan[] {
  if (!text) return [{ text: '' }];
  const spans: RichTextSpan[] = [];
  // Tokenize by rich markers in order of precedence
  const regex = /(\*\*([^*]+)\*\*|_([^_]+)_|__([^_]+)__|==([^=]+)==|\[color:([^\]]+)\]([\s\S]*?)\[\/color\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined) spans.push({ text: match[2], bold: true });
    else if (match[3] !== undefined) spans.push({ text: match[3], italic: true });
    else if (match[4] !== undefined) spans.push({ text: match[4], underline: true });
    else if (match[5] !== undefined) spans.push({ text: match[5], highlight: 'rgba(255,215,0,0.35)' });
    else if (match[6] !== undefined && match[7] !== undefined) spans.push({ text: match[7], color: match[6] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex) });
  }
  return spans.length > 0 ? spans : [{ text }];
}

/**
 * Calculates the greatest common divisor (GCD) of two numbers.
 * @param a First number.
 * @param b Second number.
 * @returns The GCD of a and b.
 */
export function gcd(a: number, b: number): number {
  if (b === 0) {
    return a;
  }
  return gcd(b, a % b);
}

/**
 * Simplifies a width and height into a "W:H" ratio string.
 * Handles potential floating-point inputs by scaling them to integers.
 * @param w Width.
 * @param h Height.
 * @returns Simplified ratio string e.g., "16:9".
 */
export function simplifyRatio(w: number, h: number): string {
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return TCG_ASPECT_RATIO; // Default or indicate error
  }

  // Determine a multiplier to convert potential floats to integers
  // This handles up to 4 decimal places, common for user inputs like inches (e.g., 2.125)
  const PRECISION_MULTIPLIER = 10000;
  const intW = Math.round(w * PRECISION_MULTIPLIER);
  const intH = Math.round(h * PRECISION_MULTIPLIER);

  const commonDivisor = gcd(intW, intH);
  const simplifiedW = intW / commonDivisor;
  const simplifiedH = intH / commonDivisor;

  return `${simplifiedW}:${simplifiedH}`;
}

export function parseCSV(raw: string): string[][] {
  const result = Papa.parse<string[]>(raw, {
    skipEmptyLines: 'greedy',
    transform: (value) => value.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join('; '));
  }

  return result.data.filter((row) => row.some((field) => field.trim() !== ''));
}

export function unparseCSV(rows: Array<Array<string | number | null | undefined>>): string {
  return Papa.unparse(rows, {
    newline: '\n',
  });
}
