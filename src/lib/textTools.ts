"use client";

import { Fragment, createElement, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import type { FreeformCardElement } from '@/types';
import { cn, parseRichText } from '@/lib/utils';

const DEFAULT_HIGHLIGHT_COLOR = 'rgba(255,215,0,0.35)';

const fontSizeClassToPx = (value?: FreeformCardElement['fontSize']): number => {
  if (value === 'text-xs') return 12;
  if (value === 'text-sm') return 14;
  if (value === 'text-base') return 16;
  if (value === 'text-lg') return 18;
  if (value === 'text-xl') return 20;
  if (value === 'text-2xl') return 24;
  return 14;
};

export const textFontSizePx = (element: Pick<FreeformCardElement, 'fontSize' | 'fontSizePx'>): number =>
  Math.min(96, Math.max(6, Math.round(Number(element.fontSizePx) || fontSizeClassToPx(element.fontSize))));

export const scalePixelLength = (value: string | undefined, scale: number): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^(-?\d*\.?\d+)px$/);
  if (!match) return trimmed;

  const scaled = Number(match[1]) * scale;
  return `${Math.round(scaled * 1000) / 1000}px`;
};

const renderInlineRichText = (text: string, highlightColor = DEFAULT_HIGHLIGHT_COLOR, keyPrefix = ''): ReactNode[] => {
  const spans = parseRichText(text);

  return spans.map((span, index) => {
    const style: CSSProperties = {};
    if (span.bold) style.fontWeight = 'bold';
    if (span.italic) style.fontStyle = 'italic';
    if (span.underline) style.textDecoration = 'underline';
    if (span.highlight) style.backgroundColor = highlightColor;
    if (span.color) style.color = span.color;

    if (Object.keys(style).length === 0) {
      return createElement(Fragment, { key: `${keyPrefix}${index}` }, span.text);
    }

    return createElement('span', { key: `${keyPrefix}${index}`, style }, span.text);
  });
};

const renderInlineText = (text: string, highlightColor: string, parseInlineFormatting: boolean, keyPrefix = ''): ReactNode[] =>
  parseInlineFormatting ? renderInlineRichText(text, highlightColor, keyPrefix) : [text];

const renderInlineTextWithBreaks = (
  text: string,
  highlightColor: string,
  parseInlineFormatting: boolean
): ReactNode[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return lines.flatMap((line, index) => {
    const nodes = renderInlineText(line, highlightColor, parseInlineFormatting, `line-${index}-`);
    return index < lines.length - 1
      ? [...nodes, createElement('br', { key: `br-${index}` })]
      : nodes;
  });
};

const parseTextBlocks = (
  text: string,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  parseInlineFormatting = true
): ReactNode[] => {
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
        ...items.map((item, itemIndex) => createElement('li', { key: itemIndex }, ...renderInlineText(item, highlightColor, parseInlineFormatting))),
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
        ...items.map((item, itemIndex) => createElement('li', { key: itemIndex }, ...renderInlineText(item, highlightColor, parseInlineFormatting))),
      ));
      continue;
    }

    if (line === '') {
      nodes.push(createElement('span', { key: key++, style: { display: 'block', minHeight: '0.5em' }, 'aria-hidden': 'true' }));
      index++;
      continue;
    }

    nodes.push(createElement('p', { key: key++, className: 'm-0' }, ...renderInlineText(line, highlightColor, parseInlineFormatting)));
    index++;
  }

  return nodes;
};

type SemanticRulesBlockKind = 'ability' | 'effect' | 'reminder' | 'flavor' | 'subtitle' | 'subtext' | 'note';

interface SemanticRulesBlock {
  kind: SemanticRulesBlockKind;
  text: string;
}

const RULES_BLOCK_ALIASES: Record<string, SemanticRulesBlockKind> = {
  ability: 'ability',
  effect: 'effect',
  reminder: 'reminder',
  flavor: 'flavor',
  subtitle: 'subtitle',
  subtext: 'subtext',
  note: 'note',
};

const parseRulesBlockMarker = (line: string): { kind: SemanticRulesBlockKind; text: string } | null => {
  const bracketMatch = line.match(/^\[(ability|effect|reminder|flavor|subtitle|subtext|note)\]\s*(.*)$/i);
  if (bracketMatch) {
    return {
      kind: RULES_BLOCK_ALIASES[bracketMatch[1].toLowerCase()],
      text: bracketMatch[2] || '',
    };
  }

  const colonMatch = line.match(/^(ability|effect|reminder|flavor|subtitle|subtext|note)\s*:\s*(.*)$/i);
  if (colonMatch) {
    return {
      kind: RULES_BLOCK_ALIASES[colonMatch[1].toLowerCase()],
      text: colonMatch[2] || '',
    };
  }

  return null;
};

export const parseSemanticRulesBlocks = (text: string): SemanticRulesBlock[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: SemanticRulesBlock[] = [];
  let current: SemanticRulesBlock | null = null;

  const pushCurrent = () => {
    if (!current) return;
    blocks.push({
      kind: current.kind,
      text: current.text.trim(),
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const marker = parseRulesBlockMarker(line.trim());

    if (marker) {
      pushCurrent();
      current = {
        kind: marker.kind,
        text: marker.text,
      };
      continue;
    }

    if (!current) {
      current = {
        kind: 'effect',
        text: line,
      };
      continue;
    }

    current.text = current.text ? `${current.text}\n${line}` : line;
  }

  pushCurrent();
  return blocks.filter((block) => block.text.length > 0);
};

const rulesBlockStyle = (kind: SemanticRulesBlockKind): CSSProperties => {
  switch (kind) {
    case 'ability':
      return { fontWeight: 700 };
    case 'reminder':
      return { fontStyle: 'italic', opacity: 0.78, fontSize: '0.92em' };
    case 'flavor':
      return { fontStyle: 'italic', opacity: 0.88 };
    case 'subtitle':
      return { textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.86em', opacity: 0.86 };
    case 'subtext':
      return { fontSize: '0.9em', opacity: 0.84 };
    case 'note':
      return { fontSize: '0.88em', opacity: 0.8 };
    case 'effect':
    default:
      return {};
  }
};

const renderRulesBlocks = (text: string, highlightColor = DEFAULT_HIGHLIGHT_COLOR): ReactNode[] => {
  const blocks = parseSemanticRulesBlocks(text);
  if (blocks.length === 0) return parseTextBlocks(text, highlightColor, true);

  return blocks.map((block, index) =>
    createElement(
      'div',
      { key: index, className: 'm-0', style: rulesBlockStyle(block.kind) },
      ...parseTextBlocks(block.text, highlightColor, true)
    )
  );
};

export function RichTextContent({
  text,
  className,
  style,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  contentModel = 'richText',
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  highlightColor?: string;
  contentModel?: 'plainText' | 'richText' | 'rulesBlocks';
}) {
  return createElement(
    'div',
    { className: cn('h-full w-full overflow-hidden whitespace-pre-wrap break-words', className), style },
    ...(contentModel === 'rulesBlocks'
      ? renderRulesBlocks(text, highlightColor)
      : parseTextBlocks(text, highlightColor, contentModel !== 'plainText')),
  );
}

export interface RichTextSegment {
  text: string;
  className?: string;
  style?: CSSProperties;
}

export function RichTextSegmentsContent({
  segments,
  className,
  style,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  contentModel = 'richText',
}: {
  segments: RichTextSegment[];
  className?: string;
  style?: CSSProperties;
  highlightColor?: string;
  contentModel?: 'plainText' | 'richText' | 'rulesBlocks';
}) {
  return createElement(
    'div',
    { className: cn('h-full w-full overflow-hidden whitespace-pre-wrap break-words', className), style },
    ...segments.map((segment, index) =>
      createElement(
        'span',
        {
          key: index,
          className: segment.className,
          style: segment.style,
        },
        ...renderInlineTextWithBreaks(segment.text, highlightColor, contentModel !== 'plainText')
      )
    )
  );
}

export function AutoFitRichTextContent({
  text,
  className,
  style,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  contentModel = 'richText',
  enabled = false,
  baseFontSizePx,
  minFontSizePx = 8,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  highlightColor?: string;
  contentModel?: 'plainText' | 'richText' | 'rulesBlocks';
  enabled?: boolean;
  baseFontSizePx: number;
  minFontSizePx?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fontSizePx, setFontSizePx] = useState(baseFontSizePx);

  useEffect(() => {
    setFontSizePx(baseFontSizePx);
  }, [baseFontSizePx, text, contentModel, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const fit = () => {
      let nextFontSize = baseFontSizePx;
      container.style.fontSize = `${nextFontSize}px`;

      while (
        nextFontSize > minFontSizePx &&
        (container.scrollHeight > container.clientHeight + 1 || container.scrollWidth > container.clientWidth + 1)
      ) {
        nextFontSize = Math.max(minFontSizePx, Math.round((nextFontSize - 0.5) * 100) / 100);
        container.style.fontSize = `${nextFontSize}px`;
        if (nextFontSize === minFontSizePx) break;
      }

      setFontSizePx(nextFontSize);
    };

    const frame = requestAnimationFrame(fit);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => fit())
      : null;
    if (observer) observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [baseFontSizePx, contentModel, enabled, minFontSizePx, text]);

  return createElement(
    'div',
    {
      ref: containerRef,
      className: cn('h-full w-full overflow-hidden whitespace-pre-wrap break-words', className),
      style: { ...style, fontSize: `${fontSizePx}px` },
    },
    ...(contentModel === 'rulesBlocks'
      ? renderRulesBlocks(text, highlightColor)
      : parseTextBlocks(text, highlightColor, contentModel !== 'plainText'))
  );
}

export function AutoFitRichTextSegmentsContent({
  segments,
  className,
  style,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  contentModel = 'richText',
  enabled = false,
  baseFontSizePx,
  minFontSizePx = 8,
}: {
  segments: RichTextSegment[];
  className?: string;
  style?: CSSProperties;
  highlightColor?: string;
  contentModel?: 'plainText' | 'richText' | 'rulesBlocks';
  enabled?: boolean;
  baseFontSizePx: number;
  minFontSizePx?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fontSizePx, setFontSizePx] = useState(baseFontSizePx);
  const textFingerprint = segments.map((segment) => segment.text).join('\n');

  useEffect(() => {
    setFontSizePx(baseFontSizePx);
  }, [baseFontSizePx, textFingerprint, contentModel, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const fit = () => {
      let nextFontSize = baseFontSizePx;
      container.style.fontSize = `${nextFontSize}px`;

      while (
        nextFontSize > minFontSizePx &&
        (container.scrollHeight > container.clientHeight + 1 || container.scrollWidth > container.clientWidth + 1)
      ) {
        nextFontSize = Math.max(minFontSizePx, Math.round((nextFontSize - 0.5) * 100) / 100);
        container.style.fontSize = `${nextFontSize}px`;
        if (nextFontSize === minFontSizePx) break;
      }

      setFontSizePx(nextFontSize);
    };

    const frame = requestAnimationFrame(fit);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => fit())
      : null;
    if (observer) observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [baseFontSizePx, contentModel, enabled, minFontSizePx, textFingerprint]);

  return createElement(
    'div',
    {
      ref: containerRef,
      className: cn('h-full w-full overflow-hidden whitespace-pre-wrap break-words', className),
      style: { ...style, fontSize: `${fontSizePx}px` },
    },
    ...segments.map((segment, index) =>
      createElement(
        'span',
        {
          key: index,
          className: segment.className,
          style: segment.style,
        },
        ...renderInlineTextWithBreaks(segment.text, highlightColor, contentModel !== 'plainText')
      )
    )
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
