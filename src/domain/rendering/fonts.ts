export type CardFontCategory = 'System' | 'Fantasy' | 'Classic' | 'Sci-Fi' | 'Utility';

export type CardFontOption = {
  name: string;
  value: string;
  category: CardFontCategory;
  cssFamily: string;
  sourceUrl?: string;
  sourceMimeType?: string;
};

export interface RegistryFontRow {
  asset_id: string;
  name: string;
  url: string;
  metadata: unknown;
}

export const CARD_FONT_OPTIONS: CardFontOption[] = [
  {
    name: 'System Sans',
    value: 'font-sans',
    category: 'System',
    cssFamily: 'var(--font-cardforge-ui), system-ui, sans-serif',
  },
  {
    name: 'Serif Classic',
    value: 'font-serif',
    category: 'System',
    cssFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    name: 'Monospaced',
    value: 'font-mono',
    category: 'Utility',
    cssFamily: 'var(--font-cardforge-mono), Menlo, Consolas, monospace',
  },
  {
    name: 'Fantasy Display (Cinzel)',
    value: 'font-cinzel',
    category: 'Fantasy',
    cssFamily: 'var(--font-cardforge-cinzel), Cinzel, serif',
  },
  {
    name: 'Clean Sans (Lato)',
    value: 'font-lato',
    category: 'System',
    cssFamily: 'var(--font-cardforge-lato), Lato, sans-serif',
  },
  {
    name: 'Trajan-Style Small Caps',
    value: 'font-trajan',
    category: 'Fantasy',
    cssFamily: 'var(--font-cardforge-cinzel), Cinzel, "Trajan Pro", "Palatino Linotype", serif',
  },
  {
    name: 'Oldstyle Book',
    value: 'font-book',
    category: 'Classic',
    cssFamily: 'var(--font-cardforge-eb-garamond), "Iowan Old Style", "Book Antiqua", "Palatino Linotype", Georgia, serif',
  },
  {
    name: 'Humanist Card Text',
    value: 'font-humanist',
    category: 'Utility',
    cssFamily: 'Optima, "Segoe UI", "Trebuchet MS", Arial, sans-serif',
  },
  {
    name: 'Condensed Title',
    value: 'font-condensed',
    category: 'Utility',
    cssFamily: 'var(--font-cardforge-barlow-condensed), "Arial Narrow", "Roboto Condensed", Arial, sans-serif',
  },
  {
    name: 'Engraved Serif',
    value: 'font-engraved',
    category: 'Classic',
    cssFamily: 'Garamond, Baskerville, "Times New Roman", serif',
  },
  {
    name: 'Cormorant Noble',
    value: 'font-cormorant',
    category: 'Classic',
    cssFamily: 'var(--font-cardforge-cormorant), "Cormorant Garamond", Garamond, serif',
  },
  {
    name: 'Alegreya Lore',
    value: 'font-alegreya',
    category: 'Classic',
    cssFamily: 'var(--font-cardforge-alegreya), Alegreya, Georgia, serif',
  },
  {
    name: 'Uncial Relic',
    value: 'font-uncial',
    category: 'Fantasy',
    cssFamily: 'var(--font-cardforge-uncial), "Uncial Antiqua", serif',
  },
  {
    name: 'Orbitron Tech',
    value: 'font-orbitron',
    category: 'Sci-Fi',
    cssFamily: 'var(--font-cardforge-orbitron), Orbitron, system-ui, sans-serif',
  },
  {
    name: 'Rajdhani Interface',
    value: 'font-rajdhani',
    category: 'Sci-Fi',
    cssFamily: 'var(--font-cardforge-rajdhani), Rajdhani, system-ui, sans-serif',
  },
  {
    name: 'Barlow Condensed',
    value: 'font-barlow-condensed',
    category: 'Utility',
    cssFamily: 'var(--font-cardforge-barlow-condensed), "Arial Narrow", Arial, sans-serif',
  },
  {
    name: 'Spectral Story',
    value: 'font-spectral',
    category: 'Classic',
    cssFamily: 'var(--font-cardforge-spectral), Spectral, Georgia, serif',
  },
];

export const AVAILABLE_FONTS: Array<{ name: string; value: string }> = CARD_FONT_OPTIONS.map(({ name, value }) => ({
  name,
  value,
}));

export const CARD_FONT_STACKS: Record<string, string> = Object.fromEntries(
  CARD_FONT_OPTIONS.map((font) => [font.value, font.cssFamily])
);

const FONT_CATEGORIES: readonly CardFontCategory[] = ['System', 'Fantasy', 'Classic', 'Sci-Fi', 'Utility'];
const FONT_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);

const isCardFontCategory = (value: unknown): value is CardFontCategory =>
  typeof value === 'string' && (FONT_CATEGORIES as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cssString = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const sanitizeFontValue = (value: string): string => (
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'developer-font'
);

const getFontExtension = (url: string): string => {
  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return FONT_EXTENSIONS.has(extension) ? extension : '';
};

const getFontFormat = (font: Pick<CardFontOption, 'sourceUrl' | 'sourceMimeType'>): string | null => {
  const mimeType = font.sourceMimeType?.toLowerCase();
  if (mimeType === 'font/woff2') return 'woff2';
  if (mimeType === 'font/woff' || mimeType === 'application/font-woff') return 'woff';
  if (mimeType === 'font/ttf' || mimeType === 'application/x-font-ttf') return 'truetype';
  if (mimeType === 'font/otf' || mimeType === 'application/x-font-opentype') return 'opentype';
  const extension = getFontExtension(font.sourceUrl ?? '');
  if (extension === 'woff2') return 'woff2';
  if (extension === 'woff') return 'woff';
  if (extension === 'ttf') return 'truetype';
  if (extension === 'otf') return 'opentype';
  return null;
};

export const mapRegistryRowsToCardFontOptions = (rows: RegistryFontRow[]): CardFontOption[] => rows
  .map((row): CardFontOption | null => {
    const name = row.name.trim();
    const sourceUrl = row.url.trim();
    if (!name || !sourceUrl || !getFontExtension(sourceUrl)) return null;

    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const category = isCardFontCategory(metadata.category) ? metadata.category : 'Utility';
    const fallback = typeof metadata.fallback === 'string' && metadata.fallback.trim()
      ? metadata.fallback.trim()
      : category === 'System' || category === 'Utility' || category === 'Sci-Fi'
        ? 'sans-serif'
        : 'serif';
    const value = `font-dev-${sanitizeFontValue(row.asset_id)}`;

    return {
      name,
      value,
      category,
      cssFamily: `"${cssString(value)}", ${fallback}`,
      sourceUrl,
    };
  })
  .filter((font): font is CardFontOption => Boolean(font));

export const mergeCardFontOptions = (
  baseFonts: CardFontOption[],
  developerFonts: CardFontOption[],
): CardFontOption[] => {
  const seen = new Set<string>();
  return [...baseFonts, ...developerFonts].filter((font) => {
    if (seen.has(font.value)) return false;
    seen.add(font.value);
    return true;
  });
};

export const cardFontOptionsToSelectOptions = (
  fonts: CardFontOption[],
): Array<{ name: string; value: string }> => fonts.map(({ name, value }) => ({ name, value }));

export const createPipelineFontFaceCss = (fonts: CardFontOption[]): string => fonts
  .filter((font) => font.sourceUrl && getFontFormat(font))
  .map((font) => [
    '@font-face {',
    `  font-family: "${cssString(font.value)}";`,
    `  src: url("${cssString(font.sourceUrl ?? '')}") format("${getFontFormat(font)}");`,
    '  font-weight: 100 900;',
    '  font-style: normal;',
    '  font-display: swap;',
    '}',
    `.${font.value} { font-family: ${font.cssFamily}; }`,
  ].join('\n'))
  .join('\n\n');

export const cardFontFamilyToCss = (fontFamily?: string): string | undefined => {
  if (!fontFamily) return undefined;
  if (fontFamily.startsWith('font-dev-') || fontFamily.startsWith('font-personal-')) {
    return `"${cssString(fontFamily)}"`;
  }
  return CARD_FONT_STACKS[fontFamily] || fontFamily;
};
