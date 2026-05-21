import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { getCardExportDimensionsPx } from '@/lib/cardExportGeometry';
import { rasterizeSvgToPng } from '@/lib/server/sharpRaster';
import { parseRichText, replacePlaceholdersLocal, type RichTextSpan } from '@/lib/utils';
import { parseTemplateTextSegments, parseTextBinding, resolveTemplateTextSegments } from '@/lib/textBindings';
import { getElementFieldContract } from '@/lib/textElementContracts';
import { formatStructuredListRows } from '@/lib/structuredList';
import type { CardData, CardFace, DisplayCard, FreeformCanvas, FreeformCardElement, TCGCardTemplate } from '@/types';

const DEFAULT_CANVAS_WIDTH = 630;
const DEFAULT_CANVAS_HEIGHT = 880;
const DEFAULT_TEXT_COLOR = '#f8fafc';
const DEFAULT_BACKGROUND = '#020617';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cssNumber = (value: string | number | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fontSizePx = (element: FreeformCardElement): number => {
  if (typeof element.fontSizePx === 'number' && Number.isFinite(element.fontSizePx)) return element.fontSizePx;
  const classMap: Record<string, number> = {
    'text-xs': 12,
    'text-sm': 14,
    'text-base': 16,
    'text-lg': 18,
    'text-xl': 20,
    'text-2xl': 24,
  };
  return element.fontSize ? classMap[element.fontSize] ?? 16 : 16;
};

const fontWeight = (value?: FreeformCardElement['fontWeight']): string => {
  if (value === 'font-bold') return '700';
  if (value === 'font-semibold') return '600';
  if (value === 'font-medium') return '500';
  return '400';
};

const fontFamily = (value?: string): string => {
  if (!value) return 'Georgia, serif';
  if (value.includes('mono')) return 'monospace';
  if (value.includes('serif')) return 'Georgia, serif';
  return 'Arial, sans-serif';
};

const textAnchor = (align?: FreeformCardElement['textAlign']): 'start' | 'middle' | 'end' => {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
};

const textX = (element: FreeformCardElement): number => {
  if (element.textAlign === 'center') return element.x + element.width / 2;
  if (element.textAlign === 'right') return element.x + element.width;
  return element.x;
};

const elementTransform = (element: FreeformCardElement): string => {
  const rotation = element.rotation || 0;
  if (!rotation) return '';
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  return ` transform="rotate(${rotation} ${cx} ${cy})"`;
};

const resolveCanvas = (template: TCGCardTemplate, face: CardFace): FreeformCanvas => {
  const canvas = face === 'back' ? template.backCanvas : template.freeformCanvas;
  return canvas || { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT, elements: [] };
};

const resolveTemplateBackground = (template: TCGCardTemplate): string =>
  template.baseBackgroundColor || template.appearance?.material?.baseColor || DEFAULT_BACKGROUND;

const resolveElementFill = (element: FreeformCardElement): string =>
  element.fillColor || element.backgroundColor || element.appearance?.material?.fillColor || 'transparent';

const resolveElementStroke = (element: FreeformCardElement): string =>
  element.strokeColor || element.borderColor || element.appearance?.material?.strokeColor || 'transparent';

const resolveTextValue = (
  template: TCGCardTemplate,
  element: FreeformCardElement,
  data: CardData
): string => {
  const simple = parseTextBinding(element.content);
  if (simple.field) {
    const contract = getElementFieldContract(template, element, simple.field);
    const value = data[simple.field] ?? simple.fallback;
    return contract?.type === 'structuredList'
      ? formatStructuredListRows(value, contract.structuredListColumns, contract.structuredListRowTemplate, contract.structuredListRowSeparator)
      : String(value ?? '');
  }

  const segments = parseTemplateTextSegments(element.content);
  return segments.map((segment, index) => {
    if (segment.type === 'variable') {
      const contract = segment.key ? getElementFieldContract(template, element, segment.key) : undefined;
      const value = segment.key ? data[segment.key] ?? segment.text : segment.text;
      return contract?.type === 'structuredList'
        ? formatStructuredListRows(value, contract.structuredListColumns, contract.structuredListRowTemplate, contract.structuredListRowSeparator)
        : String(value ?? '');
    }

    return resolveTemplateTextSegments(element.id, segment.text, data, true) || segment.text || `__static_${index}`;
  }).join('');
};

interface SvgTextToken {
  text: string;
  span: RichTextSpan;
}

const splitSpanTokens = (span: RichTextSpan): SvgTextToken[] => {
  const parts = span.text.split(/(\s+)/).filter((part) => part.length > 0);
  return parts.map((text) => ({ text, span }));
};

const measureToken = (token: SvgTextToken, size: number): number =>
  token.text.length * size * (token.span.bold ? 0.62 : 0.54);

const layoutTextLines = (spans: RichTextSpan[], maxWidth: number, size: number): SvgTextToken[][] => {
  const lines: SvgTextToken[][] = [];
  let current: SvgTextToken[] = [];
  let width = 0;

  const pushLine = () => {
    lines.push(current.length > 0 ? current : [{ text: '', span: { text: '' } }]);
    current = [];
    width = 0;
  };

  spans.forEach((span) => {
    const paragraphs = span.text.split('\n');
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraphIndex > 0) pushLine();
      splitSpanTokens({ ...span, text: paragraph }).forEach((token) => {
        const tokenWidth = measureToken(token, size);
        if (current.length > 0 && width + tokenWidth > maxWidth) {
          pushLine();
          if (/^\s+$/.test(token.text)) return;
        }
        current.push(token);
        width += tokenWidth;
      });
    });
  });

  if (current.length > 0 || lines.length === 0) pushLine();
  return lines;
};

const renderSpanAttributes = (span: RichTextSpan, element: FreeformCardElement): string => {
  const attrs = [
    `fill="${escapeXml(span.color || element.textColor || DEFAULT_TEXT_COLOR)}"`,
    `font-weight="${span.bold ? 700 : fontWeight(element.fontWeight)}"`,
  ];
  if (span.italic || element.fontStyle === 'italic') attrs.push('font-style="italic"');
  if (span.underline || element.textDecoration === 'underline') attrs.push('text-decoration="underline"');
  return attrs.join(' ');
};

async function resolveImageHref(source: string | undefined, data: CardData): Promise<string | null> {
  const resolved = replacePlaceholdersLocal(source, data, true).trim();
  if (!resolved) return null;
  if (/^(data:|https?:)/i.test(resolved)) return resolved;

  if (resolved.startsWith('/')) {
    const candidate = path.join(process.cwd(), 'public', resolved);
    try {
      const bytes = await readFile(candidate);
      const mime = MIME_BY_EXTENSION[path.extname(candidate).toLowerCase()] || 'application/octet-stream';
      return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
    } catch {
      return null;
    }
  }

  return null;
}

const renderShape = (element: FreeformCardElement): string => {
  const fill = resolveElementFill(element);
  const stroke = resolveElementStroke(element);
  const strokeWidth = element.strokeWidth ?? cssNumber(element.borderWidth, 0);
  const common = `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"`;
  const transform = elementTransform(element);

  if (element.shapeKind === 'ellipse') {
    return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" ${common}${transform}/>`;
  }
  if (element.shapeKind === 'line') {
    return `<line x1="${element.x}" y1="${element.y}" x2="${element.x + element.width}" y2="${element.y + element.height}" stroke="${escapeXml(stroke || fill || DEFAULT_TEXT_COLOR)}" stroke-width="${Math.max(1, strokeWidth || 2)}"${transform}/>`;
  }
  if (element.shapeKind === 'diamond') {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const points = `${cx},${element.y} ${element.x + element.width},${cy} ${cx},${element.y + element.height} ${element.x},${cy}`;
    return `<polygon points="${points}" ${common}${transform}/>`;
  }
  if (element.shapeKind === 'hexagon') {
    const x = element.x;
    const y = element.y;
    const w = element.width;
    const h = element.height;
    const points = `${x + w * 0.25},${y} ${x + w * 0.75},${y} ${x + w},${y + h / 2} ${x + w * 0.75},${y + h} ${x + w * 0.25},${y + h} ${x},${y + h / 2}`;
    return `<polygon points="${points}" ${common}${transform}/>`;
  }

  return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${cssNumber(element.borderRadius, 0)}" ${common}${transform}/>`;
};

const renderText = (template: TCGCardTemplate, element: FreeformCardElement, data: CardData): string => {
  const text = resolveTextValue(template, element, data);
  const size = fontSizePx(element);
  const lineHeight = size * cssNumber(element.lineHeight, 1.2);
  const spans = parseRichText(text);
  const lines = layoutTextLines(spans, Math.max(10, element.width), size);
  const anchor = textAnchor(element.textAlign);
  const baseX = textX(element);
  const padding = cssNumber(element.padding, 0);
  const x = anchor === 'start' ? baseX + padding : anchor === 'end' ? baseX - padding : baseX;
  const y = element.y + padding + size;
  const transform = elementTransform(element);
  const background = element.backgroundColor
    ? `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${cssNumber(element.borderRadius, 0)}" fill="${escapeXml(element.backgroundColor)}" opacity="${element.opacity ?? 1}"${transform}/>`
    : '';
  const textRows = lines.map((line, lineIndex) => {
    const tspans = line.map((token) =>
      `<tspan ${renderSpanAttributes(token.span, element)}>${escapeXml(token.text)}</tspan>`
    ).join('');
    return `<text x="${x}" y="${y + lineIndex * lineHeight}" text-anchor="${anchor}" font-family="${escapeXml(fontFamily(element.fontFamily))}" font-size="${size}" fill="${escapeXml(element.textColor || template.baseTextColor || DEFAULT_TEXT_COLOR)}">${tspans}</text>`;
  }).join('');

  return `${background}<g${transform} opacity="${element.opacity ?? 1}">${textRows}</g>`;
};

async function renderImage(element: FreeformCardElement, data: CardData): Promise<string> {
  const href = await resolveImageHref(element.imageSource || element.iconImageSource || element.content, data);
  if (!href) return renderShape({ ...element, type: 'shape', shapeKind: 'rectangle', fillColor: '#111827', strokeColor: '#475569' });
  const preserveAspectRatio = element.imageObjectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
  return `<image href="${escapeXml(href)}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="${preserveAspectRatio}" opacity="${element.opacity ?? 1}"${elementTransform(element)}/>`;
}

export async function renderCardFaceToSvg(card: DisplayCard, face: CardFace): Promise<{ svg: string; width: number; height: number }> {
  const template = card.template;
  const canvas = resolveCanvas(template, face);
  const width = canvas.width || DEFAULT_CANVAS_WIDTH;
  const height = canvas.height || DEFAULT_CANVAS_HEIGHT;
  const elements = [...(canvas.elements || [])]
    .filter((element) => element.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);
  const renderedElements = await Promise.all(elements.map(async (element) => {
    if (element.type === 'text') return renderText(template, element, card.data);
    if (element.type === 'image' || element.type === 'icon') return renderImage(element, card.data);
    return renderShape(element);
  }));

  const svg = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${width}" height="${height}" fill="${escapeXml(resolveTemplateBackground(template))}"/>`,
    ...renderedElements,
    '</svg>',
  ].join('');

  return { svg, width, height };
}

export async function renderCardFaceToPng(card: DisplayCard, face: CardFace, dpi: number) {
  const { svg } = await renderCardFaceToSvg(card, face);
  const { widthPx, heightPx } = getCardExportDimensionsPx(card, dpi);
  return rasterizeSvgToPng(svg, widthPx, heightPx);
}
