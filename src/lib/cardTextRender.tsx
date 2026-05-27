"use client";

import type React from 'react';
import { createElement } from 'react';

import type { CardData, FreeformCardElement, TCGCardTemplate } from '@/types';
import {
  AutoFitRichTextContent,
  AutoFitRichTextSegmentsContent,
  RichTextContent,
  RichTextSegmentsContent,
  textFontSizePx,
} from '@/lib/textTools';
import {
  buildStaticSegmentFieldKey,
  buildScopedFieldDataKey,
  parseTemplateTextSegments,
  parseTextBinding,
  resolveTemplateTextSegments,
} from '@/lib/textBindings';
import {
  buildStructuredRowsDataKey,
  buildStructuredRowsText,
  parseStructuredRowsValue,
  structuredRowToCardData,
} from '@/lib/structuredRows';
import {
  getElementFieldContract,
  getPrimaryElementContract,
  type TextElementContentModel,
  inferTextElementContentModel,
  shouldAutoFitTextElement,
} from '@/lib/textElementContracts';
import { resolveFieldContractStyleOverrides } from '@/lib/fieldStyleOverrides';

const resolveRenderContentModel = (
  contentModel: TextElementContentModel,
  text: string,
  segments: Array<{ text: string }>
): 'plainText' | 'richText' | 'rulesBlocks' => {
  if (contentModel === 'structuredRows') return 'richText';
  return 'rulesBlocks';
};

const fontWeightToCss = (fontWeight?: FreeformCardElement['fontWeight']): React.CSSProperties['fontWeight'] | undefined => {
  if (fontWeight === 'font-medium') return 500;
  if (fontWeight === 'font-semibold') return 600;
  if (fontWeight === 'font-bold') return 700;
  if (fontWeight === 'font-normal') return 400;
  return undefined;
};

const fontFamilyToCss = (fontFamily?: string): React.CSSProperties['fontFamily'] | undefined => {
  if (fontFamily === 'font-sans') return 'system-ui, sans-serif';
  if (fontFamily === 'font-serif') return 'Georgia, "Times New Roman", serif';
  if (fontFamily === 'font-mono') return 'Menlo, Consolas, monospace';
  if (fontFamily === 'font-cinzel') return 'Cinzel, serif';
  if (fontFamily === 'font-lato') return 'Lato, sans-serif';
  if (fontFamily === 'font-trajan') return 'Cinzel, "Trajan Pro", "Palatino Linotype", serif';
  if (fontFamily === 'font-book') return '"Iowan Old Style", "Book Antiqua", "Palatino Linotype", Georgia, serif';
  if (fontFamily === 'font-humanist') return 'Optima, "Segoe UI", "Trebuchet MS", Arial, sans-serif';
  if (fontFamily === 'font-condensed') return '"Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  if (fontFamily === 'font-engraved') return 'Garamond, Baskerville, "Times New Roman", serif';
  return fontFamily || undefined;
};

export const applyContractRichTextStyle = (
  value: string,
  contract?: NonNullable<TCGCardTemplate['fieldContracts']>[number]
): string => {
  let next = value;
  if (!next || !contract) return next;
  if (contract.textColor && !next.includes('[color:')) next = `[color:${contract.textColor}]${next}[/color]`;
  if (contract.textDecoration === 'underline' && !/^__[\s\S]*__$/.test(next)) next = `__${next}__`;
  if (contract.fontStyle === 'italic' && !/^_[\s\S]*_$/.test(next)) next = `_${next}_`;
  if (contract.fontWeight === 'font-bold' && !/^\*\*[\s\S]*\*\*$/.test(next)) next = `**${next}**`;
  return next;
};

export const buildContractSegmentStyle = (
  contract: NonNullable<TCGCardTemplate['fieldContracts']>[number] | undefined,
  scale = 1
): React.CSSProperties | undefined => {
  if (!contract) return undefined;
  const style: React.CSSProperties = {};
  if (contract.textColor) style.color = contract.textColor;
  const fontFamily = fontFamilyToCss(contract.fontFamily);
  if (fontFamily) style.fontFamily = fontFamily;
  if (contract.fontSizePx) style.fontSize = `${contract.fontSizePx * scale}px`;
  const fontWeight = fontWeightToCss(contract.fontWeight);
  if (fontWeight) style.fontWeight = fontWeight;
  if (contract.fontStyle && contract.fontStyle !== 'normal') style.fontStyle = contract.fontStyle;
  if (contract.textDecoration && contract.textDecoration !== 'none') style.textDecoration = contract.textDecoration;
  if (contract.lineHeight) style.lineHeight = contract.lineHeight;
  if (contract.letterSpacing) style.letterSpacing = contract.letterSpacing;
  if (contract.textAlign) {
    style.display = 'inline-block';
    style.width = '100%';
    style.textAlign = contract.textAlign;
  }
  if (contract.writingMode && contract.writingMode !== 'horizontal-tb') {
    style.display = 'inline-block';
    style.writingMode = contract.writingMode;
    style.textOrientation = 'upright';
  }

  return Object.keys(style).length > 0 ? style : undefined;
};

export const buildResolvedTextSegments = (
  template: TCGCardTemplate,
  element: FreeformCardElement,
  data: CardData,
  scale = 1
) => {
  const simple = parseTextBinding(element.content);
  if (simple.field) {
    const dataKey = buildScopedFieldDataKey(element.id, simple.field);
    const value = data[dataKey] ?? data[simple.field] ?? simple.fallback;
    const contract = resolveFieldContractStyleOverrides(
      getElementFieldContract(template, element, simple.field),
      data,
      data[dataKey] !== undefined ? dataKey : simple.field
    );
    return [{
      text: applyContractRichTextStyle(String(value ?? ''), contract),
      style: buildContractSegmentStyle(contract, scale),
    }];
  }

  return parseTemplateTextSegments(element.content).map((segment, index) => {
    const key = segment.type === 'variable'
      ? segment.key
      : buildStaticSegmentFieldKey(element.id, index);
    const dataKey = segment.type === 'variable' && key
      ? buildScopedFieldDataKey(element.id, key)
      : key;
    const contract = resolveFieldContractStyleOverrides(
      getElementFieldContract(template, element, key),
      data,
      dataKey && data[dataKey] !== undefined ? dataKey : key
    );
    const value = key ? data[dataKey ?? key] ?? data[key] : undefined;
    return {
      text: applyContractRichTextStyle(String(value ?? segment.text ?? ''), contract),
      style: buildContractSegmentStyle(contract, scale),
    };
  });
};

export const buildStyledSegmentData = (
  template: TCGCardTemplate,
  element: FreeformCardElement,
  data: CardData
): CardData => {
  const nextData: CardData = { ...data };
  const simple = parseTextBinding(element.content);

  if (simple.field) {
    const dataKey = buildScopedFieldDataKey(element.id, simple.field);
    const resolvedKey = data[dataKey] !== undefined ? dataKey : simple.field;
    const value = data[resolvedKey] ?? simple.fallback;
    nextData[resolvedKey] = applyContractRichTextStyle(
      String(value ?? ''),
      resolveFieldContractStyleOverrides(
        getElementFieldContract(template, element, simple.field),
        data,
        resolvedKey
      )
    );
    return nextData;
  }

  parseTemplateTextSegments(element.content).forEach((segment, index) => {
    if (segment.type === 'variable') {
      if (!segment.key) return;
      const dataKey = buildScopedFieldDataKey(element.id, segment.key);
      const resolvedKey = data[dataKey] !== undefined ? dataKey : segment.key;
      const value = data[resolvedKey] ?? segment.text;
      nextData[resolvedKey] = applyContractRichTextStyle(
        String(value ?? ''),
        resolveFieldContractStyleOverrides(
          getElementFieldContract(template, element, segment.key),
          data,
          resolvedKey
        )
      );
      return;
    }

    const staticKey = buildStaticSegmentFieldKey(element.id, index);
    const value = data[staticKey] ?? segment.text;
    nextData[staticKey] = applyContractRichTextStyle(
      String(value ?? ''),
      resolveFieldContractStyleOverrides(
        getElementFieldContract(template, element, staticKey),
        data,
        staticKey
      )
    );
  });

  return nextData;
};

interface CardTextContentProps {
  template: TCGCardTemplate;
  element: FreeformCardElement;
  data: CardData;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
  highlightColor?: string;
}

export function CardTextContent({
  template,
  element,
  data,
  scale = 1,
  className,
  style,
  highlightColor,
}: CardTextContentProps) {
  const contentModel = inferTextElementContentModel(template, element);
  const structuredRows = contentModel === 'structuredRows'
    ? parseStructuredRowsValue(data[buildStructuredRowsDataKey(element.id)])
    : [];
  const processedText = structuredRows.length > 0
    ? buildStructuredRowsText(element, structuredRows)
    : resolveTemplateTextSegments(
    element.id,
    element.content,
    buildStyledSegmentData(template, element, data),
    true
  );
  const processedSegments = structuredRows.length > 0
    ? structuredRows.flatMap((row, index) => {
        const segments = buildResolvedTextSegments(template, element, structuredRowToCardData(element.id, row), scale);
        return index < structuredRows.length - 1
          ? [...segments, { text: '\n' }]
          : segments;
      })
    : buildResolvedTextSegments(template, element, data, scale);
  const contract = getPrimaryElementContract(template, element);
  const renderContentModel = resolveRenderContentModel(contentModel, processedText, processedSegments);
  const autoFit = shouldAutoFitTextElement(template, element);
  const baseFontSizePx = textFontSizePx(element) * scale;
  const minFontSizePx = (contract?.minFontSizePx ?? element.textMinFontSizePx ?? 8) * scale;
  const contentStyle: React.CSSProperties = {
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    textDecoration: 'inherit',
    fontStyle: 'inherit',
    ...style,
  };

  if (autoFit) {
    return processedSegments.length > 1
      ? createElement(AutoFitRichTextSegmentsContent, {
          segments: processedSegments,
          className,
          style: contentStyle,
          highlightColor,
          contentModel: renderContentModel,
          enabled: true,
          baseFontSizePx,
          minFontSizePx,
        })
      : createElement(AutoFitRichTextContent, {
          text: processedText,
          className,
          style: contentStyle,
          highlightColor,
          contentModel: renderContentModel,
          enabled: true,
          baseFontSizePx,
          minFontSizePx,
        });
  }

  return processedSegments.length > 1
    ? createElement(RichTextSegmentsContent, {
        segments: processedSegments,
        className,
        style: { ...contentStyle, fontSize: `${baseFontSizePx}px` },
        highlightColor,
        contentModel: renderContentModel,
      })
    : createElement(RichTextContent, {
        text: processedText,
        className,
        style: { ...contentStyle, fontSize: `${baseFontSizePx}px` },
        highlightColor,
        contentModel: renderContentModel,
      });
}
