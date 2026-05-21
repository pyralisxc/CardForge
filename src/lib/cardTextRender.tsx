"use client";

import type React from 'react';
import { createElement } from 'react';

import type { CardData, CardFieldStyleOverrides, FreeformCardElement, TCGCardTemplate } from '@/types';
import {
  AutoFitRichTextContent,
  AutoFitRichTextSegmentsContent,
  RichTextContent,
  RichTextSegmentsContent,
  type RichTextSegment,
  textFontSizePx,
} from '@/lib/textTools';
import {
  buildStaticSegmentFieldKey,
  parseTemplateTextSegments,
  parseTextBinding,
  resolveTemplateTextSegments,
} from '@/lib/textBindings';
import {
  getElementFieldContract,
  getPrimaryElementContract,
  type TextElementContentModel,
  inferTextElementContentModel,
  shouldAutoFitTextElement,
} from '@/lib/textElementContracts';
import {
  buildStructuredListRowSeparatorText,
  DEFAULT_STRUCTURED_LIST_COLUMN_SEPARATOR,
  decodeStructuredListFormatText,
  formatStructuredListRows,
  normalizeStructuredListColumns,
  parseStructuredListValue,
} from '@/lib/structuredList';

const RICH_TEXT_MARKER_PATTERN = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|_[\s\S]+?_|==[\s\S]+?==|\[color:[^\]]+\][\s\S]+?\[\/color\])/;
type FieldContractStyle = Partial<NonNullable<TCGCardTemplate['fieldContracts']>[number]>;

const containsRichTextMarkers = (value: string): boolean => RICH_TEXT_MARKER_PATTERN.test(value);

const resolveRenderContentModel = (
  contentModel: TextElementContentModel,
  text: string,
  segments: Array<{ text: string }>
): TextElementContentModel => {
  if (contentModel !== 'plainText') return contentModel;
  return containsRichTextMarkers(text) || segments.some((segment) => containsRichTextMarkers(segment.text))
    ? 'richText'
    : 'plainText';
};

const fontWeightToCss = (fontWeight?: FreeformCardElement['fontWeight']): React.CSSProperties['fontWeight'] | undefined => {
  if (fontWeight === 'font-medium') return 500;
  if (fontWeight === 'font-semibold') return 600;
  if (fontWeight === 'font-bold') return 700;
  if (fontWeight === 'font-normal') return 400;
  return undefined;
};

export const applyContractRichTextStyle = (
  value: string,
  contract?: FieldContractStyle
): string => {
  if (!value || !contract) return value;
  // Contract typography is applied as CSS on the rendered segment so user-authored rich text stays parseable.
  return value;
};

export const buildContractSegmentStyle = (
  contract: FieldContractStyle | undefined,
  scale = 1
): React.CSSProperties | undefined => {
  if (!contract) return undefined;
  const style: React.CSSProperties = {};
  if (contract.textColor) style.color = contract.textColor;
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

const hasStructuredVisualStyle = (contract: FieldContractStyle): boolean =>
  Boolean(
    contract.structuredListColumnSeparator !== undefined
      || contract.structuredListColumnStyles
      || contract.structuredListRowSeparatorText !== undefined
      || contract.structuredListRowSeparatorStyle
  );

const buildContractSegment = (
  text: string,
  contract: FieldContractStyle,
  scale: number
): RichTextSegment => ({
  text: applyContractRichTextStyle(text, contract),
  className: contract.fontFamily,
  style: buildContractSegmentStyle(contract, scale),
});

const buildStructuredListSegments = (
  value: unknown,
  contract: FieldContractStyle,
  scale: number
): RichTextSegment[] => {
  if (!hasStructuredVisualStyle(contract)) {
    return [buildContractSegment(
      formatStructuredListRows(
        value,
        contract.structuredListColumns,
        contract.structuredListRowTemplate,
        contract.structuredListRowSeparator
      ),
      contract,
      scale
    )];
  }

  const columns = normalizeStructuredListColumns(contract.structuredListColumns);
  const rows = parseStructuredListValue(value, columns).filter((row) =>
    columns.some((column) => row.values[column.key]?.trim())
  );
  const columnSeparator = decodeStructuredListFormatText(
    contract.structuredListColumnSeparator,
    DEFAULT_STRUCTURED_LIST_COLUMN_SEPARATOR
  );
  const rowSeparator = buildStructuredListRowSeparatorText(
    contract.structuredListRowSeparatorText,
    contract.structuredListRowSeparator
  );
  const rowSeparatorContract: FieldContractStyle = {
    ...contract,
    ...(contract.structuredListRowSeparatorStyle || {}),
  };

  return rows.flatMap((row, rowIndex) => {
    const rowSegments = columns.flatMap((column, columnIndex): RichTextSegment[] => {
      const text = row.values[column.key]?.trim();
      if (!text) return [];
      const columnContract: FieldContractStyle = {
        ...contract,
        ...(contract.structuredListColumnStyles?.[column.key] || {}),
      };
      const segments: RichTextSegment[] = [];
      if (columnIndex > 0 && columnSeparator) {
        segments.push(buildContractSegment(columnSeparator, contract, scale));
      }
      segments.push(buildContractSegment(text, columnContract, scale));
      return segments;
    });

    if (rowIndex === rows.length - 1 || !rowSeparator) return rowSegments;
    return [
      ...rowSegments,
      buildContractSegment(rowSeparator, rowSeparatorContract, scale),
    ];
  });
};

export const buildResolvedTextSegments = (
  template: TCGCardTemplate,
  element: FreeformCardElement,
  data: CardData,
  scale = 1,
  styleOverrides?: CardFieldStyleOverrides
) => {
  const simple = parseTextBinding(element.content);
  if (simple.field) {
    const value = data[simple.field] ?? simple.fallback;
    const contract = {
      ...(getElementFieldContract(template, element, simple.field) || {}),
      ...(styleOverrides?.[simple.field] || {}),
    };
    if (contract.type === 'structuredList') {
      return buildStructuredListSegments(value ?? simple.fallback, contract, scale);
    }

    return [buildContractSegment(String(value ?? ''), contract, scale)];
  }

  return parseTemplateTextSegments(element.content).flatMap((segment, index) => {
    const key = segment.type === 'variable'
      ? segment.key
      : buildStaticSegmentFieldKey(element.id, index);
    const contract = {
      ...(getElementFieldContract(template, element, key) || {}),
      ...(key ? styleOverrides?.[key] || {} : {}),
    };
    const value = key ? data[key] : undefined;
    if (contract.type === 'structuredList') {
      return buildStructuredListSegments(value ?? segment.text ?? '', contract, scale);
    }

    return [buildContractSegment(String(value ?? segment.text ?? ''), contract, scale)];
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
    const value = data[simple.field] ?? simple.fallback;
    nextData[simple.field] = applyContractRichTextStyle(
      String(value ?? ''),
      getElementFieldContract(template, element, simple.field)
    );
    return nextData;
  }

  parseTemplateTextSegments(element.content).forEach((segment, index) => {
    if (segment.type === 'variable') {
      if (!segment.key) return;
      const value = data[segment.key] ?? segment.text;
      nextData[segment.key] = applyContractRichTextStyle(
        String(value ?? ''),
        getElementFieldContract(template, element, segment.key)
      );
      return;
    }

    const staticKey = buildStaticSegmentFieldKey(element.id, index);
    const value = data[staticKey] ?? segment.text;
    nextData[staticKey] = applyContractRichTextStyle(
      String(value ?? ''),
      getElementFieldContract(template, element, staticKey)
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
  styleOverrides?: CardFieldStyleOverrides;
}

export function CardTextContent({
  template,
  element,
  data,
  scale = 1,
  className,
  style,
  highlightColor,
  styleOverrides,
}: CardTextContentProps) {
  const processedText = resolveTemplateTextSegments(
    element.id,
    element.content,
    buildStyledSegmentData(template, element, data),
    true
  );
  const processedSegments = buildResolvedTextSegments(template, element, data, scale, styleOverrides);
  const contract = getPrimaryElementContract(template, element);
  const contentModel = inferTextElementContentModel(template, element);
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
  const singleSegmentStyle = processedSegments.length === 1 ? processedSegments[0]?.style : undefined;
  const singleSegmentClassName = processedSegments.length === 1 ? processedSegments[0]?.className : undefined;
  const singleSegmentText = processedSegments.length === 1 ? processedSegments[0]?.text ?? processedText : processedText;
  const singleContentStyle = singleSegmentStyle
    ? { ...contentStyle, ...singleSegmentStyle }
    : contentStyle;
  const singleContentClassName = [className, singleSegmentClassName].filter(Boolean).join(' ') || undefined;

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
          text: singleSegmentText,
          className: singleContentClassName,
          style: singleContentStyle,
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
        text: singleSegmentText,
        className: singleContentClassName,
        style: { fontSize: `${baseFontSizePx}px`, ...singleContentStyle },
        highlightColor,
        contentModel: renderContentModel,
      });
}
