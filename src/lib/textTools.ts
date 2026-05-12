"use client";

import { Fragment, createElement } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import type { FreeformCardElement } from '@/types';
import { cn, parseRichText } from '@/lib/utils';

const DEFAULT_HIGHLIGHT_COLOR = 'rgba(255,215,0,0.35)';

const legacyFontSizeToPx = (value?: FreeformCardElement['fontSize']): number => {
  if (value === 'text-xs') return 12;
  if (value === 'text-sm') return 14;
  if (value === 'text-base') return 16;
  if (value === 'text-lg') return 18;
  if (value === 'text-xl') return 20;
  if (value === 'text-2xl') return 24;
  return 14;
};

export const textFontSizePx = (element: Pick<FreeformCardElement, 'fontSize' | 'fontSizePx'>): number =>
  Math.min(96, Math.max(6, Math.round(Number(element.fontSizePx) || legacyFontSizeToPx(element.fontSize))));

export const scalePixelLength = (value: string | undefined, scale: number): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^(-?\d*\.?\d+)px$/);
  if (!match) return trimmed;

  const scaled = Number(match[1]) * scale;
  return `${Math.round(scaled * 1000) / 1000}px`;
};

const renderInlineRichText = (text: string, highlightColor = DEFAULT_HIGHLIGHT_COLOR): ReactNode[] => {
  const spans = parseRichText(text);

  return spans.map((span, index) => {
    const style: CSSProperties = {};
    if (span.bold) style.fontWeight = 'bold';
    if (span.italic) style.fontStyle = 'italic';
    if (span.underline) style.textDecoration = 'underline';
    if (span.highlight) style.backgroundColor = highlightColor;
    if (span.color) style.color = span.color;

    if (Object.keys(style).length === 0) {
      return createElement(Fragment, { key: index }, span.text);
    }

    return createElement('span', { key: index, style }, span.text);
  });
};

const parseRichTextBlocks = (text: string, highlightColor = DEFAULT_HIGHLIGHT_COLOR): ReactNode[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (/^[-*\u2022]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*\u2022]\s/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*\u2022]\s/, ''));
        index++;
      }
      nodes.push(createElement(
        'ul',
        { key: key++, className: 'm-0 list-disc pl-5' },
        ...items.map((item, itemIndex) => createElement('li', { key: itemIndex }, ...renderInlineRichText(item, highlightColor))),
      ));
      continue;
    }

    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+[.)]\s/, ''));
        index++;
      }
      nodes.push(createElement(
        'ol',
        { key: key++, className: 'm-0 list-decimal pl-5' },
        ...items.map((item, itemIndex) => createElement('li', { key: itemIndex }, ...renderInlineRichText(item, highlightColor))),
      ));
      continue;
    }

    if (line === '') {
      nodes.push(createElement('span', { key: key++, style: { display: 'block', minHeight: '0.5em' }, 'aria-hidden': 'true' }));
      index++;
      continue;
    }

    nodes.push(createElement('p', { key: key++, className: 'm-0' }, ...renderInlineRichText(line, highlightColor)));
    index++;
  }

  return nodes;
};

export function RichTextContent({
  text,
  className,
  style,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  highlightColor?: string;
}) {
  return createElement(
    'div',
    { className: cn('h-full w-full overflow-hidden whitespace-pre-wrap break-words', className), style },
    ...parseRichTextBlocks(text, highlightColor),
  );
}

export const buildTextElementStyle = (
  element: Pick<FreeformCardElement, 'fontSize' | 'fontSizePx' | 'textAlign' | 'lineHeight' | 'letterSpacing' | 'textTransform' | 'textDecoration' | 'fontStyle' | 'writingMode'>,
  scale = 1,
): CSSProperties => {
  const hasVerticalWritingMode = !!element.writingMode && element.writingMode !== 'horizontal-tb';

  return {
    display: hasVerticalWritingMode ? 'block' : 'flex',
    alignItems: !hasVerticalWritingMode && element.textAlign === 'center' ? 'center' : undefined,
    justifyContent: !hasVerticalWritingMode
      ? element.textAlign === 'right'
        ? 'flex-end'
        : element.textAlign === 'center'
          ? 'center'
          : 'flex-start'
      : undefined,
    textAlign: element.textAlign || 'left',
    fontSize: `${textFontSizePx(element) * scale}px`,
    lineHeight: element.lineHeight || 1.4,
    letterSpacing: scalePixelLength(element.letterSpacing, scale),
    textTransform: element.textTransform || undefined,
    textDecoration: element.textDecoration || undefined,
    fontStyle: element.fontStyle || 'normal',
    writingMode: element.writingMode || 'horizontal-tb',
    textOrientation: hasVerticalWritingMode ? 'upright' : undefined,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  };
};