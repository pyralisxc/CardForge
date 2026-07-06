#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const PLACEHOLDER_REGEX = /\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g;

function parseArgs(argv) {
  const args = {
    template: 'data/default-templates/default-playing-card-theme.json',
    count: 500,
    out: 'data/bulk-samples/playing-card-500.csv',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--template' && argv[i + 1]) {
      args.template = argv[i + 1];
      i += 1;
    } else if (token === '--count' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.count = parsed;
      }
      i += 1;
    } else if (token === '--out' && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function collectPlaceholders(value, map) {
  if (typeof value === 'string') {
    let match;
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_REGEX.exec(value)) !== null) {
      const key = match[1].trim();
      const defaultValue = match[2] !== undefined
        ? match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        : undefined;

      if (!map.has(key) || (defaultValue !== undefined && map.get(key)?.defaultValue === undefined)) {
        map.set(key, { key, defaultValue });
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPlaceholders(item, map);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectPlaceholders(nested, map);
    }
  }
}

function normalizeKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function deriveSetCode(templateName) {
  const letters = (templateName || 'SET').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const trimmed = letters.slice(0, 3);
  return trimmed.padEnd(3, 'X');
}

function deriveCardPrefix(templateName) {
  const cleaned = (templateName || 'Card')
    .replace(/template/gi, '')
    .replace(/smoke/gi, '')
    .replace(/freeform/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Card';
}

function makeValueForKey(key, index, count, defaultValue, templateName) {
  const normalized = normalizeKey(key);
  const setCode = deriveSetCode(templateName);
  const cardPrefix = deriveCardPrefix(templateName);

  if (normalized.includes('cardnumber') || normalized === 'number') {
    return `${String(index).padStart(5, '0')}/${count}`;
  }
  if (normalized.includes('setcode')) {
    return setCode;
  }
  if (normalized === 'title' || normalized.includes('cardname') || normalized === 'name') {
    return `${cardPrefix} ${index}`;
  }
  if (normalized.includes('rulestext') || normalized.includes('effect') || normalized.includes('description')) {
    return `Generated effect for card ${index}.\\nIf this is a bulk test, card ${index} validates row-level rendering.`;
  }
  if (normalized.includes('flavor')) {
    return `\\"Batch ${index}: forged at scale.\\"`;
  }
  if (normalized.includes('typeline') || normalized === 'type' || normalized.includes('cardtype')) {
    return 'CREATURE - TESTER';
  }
  if (normalized === 'cost' || normalized.includes('manacost')) {
    return String((index % 9) + 1);
  }
  if (normalized === 'power') {
    return String((index % 7) + 1);
  }
  if (normalized === 'toughness') {
    return String(((index + 2) % 7) + 1);
  }
  if (normalized.includes('reward')) {
    return `Reward: Gain ${((index % 5) + 1) * 100} gold.`;
  }
  if (normalized.includes('newtext')) {
    return `Variant ${index}`;
  }
  if (normalized.includes('image') || normalized.includes('artwork') || normalized.includes('arturl')) {
    return `https://placehold.co/600x400/png?text=${encodeURIComponent(`Card ${index}`)}`;
  }
  if (defaultValue && defaultValue.trim().length > 0) {
    return `${defaultValue} ${index}`;
  }

  return `${key}_${index}`;
}

function buildCsv(headers, rows) {
  return `${Papa.unparse([headers, ...rows], { newline: '\n' })}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const templatePath = path.resolve(process.cwd(), args.template);
  const outPath = path.resolve(process.cwd(), args.out);

  if (!fs.existsSync(templatePath)) {
    console.error(`Template file not found: ${templatePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(templatePath, 'utf8');
  const template = JSON.parse(raw);

  const placeholderMap = new Map();
  collectPlaceholders(template, placeholderMap);
  const fields = Array.from(placeholderMap.values());

  if (fields.length === 0) {
    console.error('No placeholders found in template.');
    process.exit(1);
  }

  const headers = fields.map((field) => field.key);
  const rows = [];

  for (let i = 1; i <= args.count; i += 1) {
    const row = headers.map((key) => {
      const field = placeholderMap.get(key);
      return makeValueForKey(key, i, args.count, field?.defaultValue, template.name || 'Card');
    });
    rows.push(row);
  }

  const csv = buildCsv(headers, rows);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, csv, 'utf8');

  console.log(`Generated ${args.count} cards using template: ${args.template}`);
  console.log(`Fields: ${headers.join(', ')}`);
  console.log(`Output: ${path.relative(process.cwd(), outPath)}`);
  console.log('Tip: generate 10,000 cards with --count 10000');
}

main();
