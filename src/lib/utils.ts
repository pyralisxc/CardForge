
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import Papa from "papaparse";
import { TCG_ASPECT_RATIO } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
