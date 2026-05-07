
"use client";

import type { DisplayCard, CardSection, CardData, CardRow, TCGCardTemplate, FreeformCardElement } from '@/types';
import { cn, replacePlaceholdersLocal, parseRichText } from '@/lib/utils';
import { appearanceToStyle, normalizeAppearanceForElement } from '@/lib/appearance';
import { isDividerElement } from '@/lib/elementCapabilities';
import { useMemo } from 'react';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import * as LucideIcons from 'lucide-react';

interface CardPreviewProps {
  card: DisplayCard;
  className?: string;
  isPrintMode?: boolean;
  showSizeInfo?: boolean;
  isEditorPreview?: boolean;
  hideEmptySections?: boolean;
  onSectionClick?: (sectionId: string) => void;
  onRowClick?: (rowId: string) => void;
  onEdit?: (card: DisplayCard) => void;
  targetWidthPx?: number;
}

const PREVIEW_WIDTH_PX = 280;
const STANDARD_TCG_WIDTH_MM = 63;
const MM_TO_INCHES = 1 / 25.4;

const parsePixelValue = (value: string | undefined, defaultValue = 0): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(String(value).replace(/px$/, ''), 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const borderWidthClassToPixels = (value?: string): number => {
  if (!value || value === '_none_') return 0;
  if (value === 'border') return 1;
  const match = value.match(/border-(\d+)/);
  return match ? Number(match[1]) : 1;
};

const radiusClassToPixels = (value?: string): string | undefined => {
  switch (value) {
    case 'rounded-sm': return '2px';
    case 'rounded-md': return '6px';
    case 'rounded-lg': return '8px';
    case 'rounded-xl': return '12px';
    case 'rounded-full': return '9999px';
    default: return undefined;
  }
};

const legacyFontSizeToPx = (value?: FreeformCardElement['fontSize']): number => {
  if (value === 'text-xs') return 12;
  if (value === 'text-sm') return 14;
  if (value === 'text-base') return 16;
  if (value === 'text-lg') return 18;
  if (value === 'text-xl') return 20;
  if (value === 'text-2xl') return 24;
  return 14;
};

const textFontSizePx = (element: Pick<FreeformCardElement, 'fontSize' | 'fontSizePx'>): number =>
  Math.min(96, Math.max(6, Math.round(Number(element.fontSizePx) || legacyFontSizeToPx(element.fontSize))));

const getFreeformImageUrl = (element: FreeformCardElement, data: CardData, fallbackText: string): string => {
  const source = replacePlaceholdersLocal(element.imageSource || element.content, data, false);
  if (source && (source.startsWith('http') || source.startsWith('data:'))) return source;
  const keyedValue = source ? data[source] : undefined;
  if (typeof keyedValue === 'string' && (keyedValue.startsWith('http') || keyedValue.startsWith('data:'))) return keyedValue;
  return `https://placehold.co/${Math.max(80, Math.round(element.width || 300))}x${Math.max(80, Math.round(element.height || 200))}.png?text=${encodeURIComponent(fallbackText || 'Artwork')}`;
};

const parseListText = (text: string): { type: 'plain'; text: string } | { type: 'ul' | 'ol'; items: string[] } => {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'plain', text };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { type: 'ul', items: parsed.map(item => String(item)) };
    }
  } catch {
    // Not JSON list content; fall through to line parsing.
  }

  const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every(line => /^[-*\u2022]\s+/.test(line))) {
    return { type: 'ul', items: lines.map(line => line.replace(/^[-*\u2022]\s+/, '')) };
  }
  if (lines.length > 1 && lines.every(line => /^\d+[.)]\s+/.test(line))) {
    return { type: 'ol', items: lines.map(line => line.replace(/^\d+[.)]\s+/, '')) };
  }
  return { type: 'plain', text };
};

const shapeClipPath = (shapeKind?: FreeformCardElement['shapeKind']): string | undefined => {
  if (shapeKind === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shapeKind === 'hexagon') return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
  if (shapeKind === 'banner') return 'polygon(0% 0%, 92% 0%, 100% 50%, 92% 100%, 0% 100%, 8% 50%)';
  if (shapeKind === 'notch-panel') return 'polygon(6% 0%, 94% 0%, 100% 14%, 100% 86%, 94% 100%, 6% 100%, 0% 86%, 0% 14%)';
  if (shapeKind === 'bracket-frame') return 'polygon(0% 0%, 18% 0%, 18% 8%, 8% 8%, 8% 92%, 18% 92%, 18% 100%, 0% 100%, 0% 0%, 82% 0%, 100% 0%, 100% 100%, 82% 100%, 82% 92%, 92% 92%, 92% 8%, 82% 8%)';
  if (shapeKind === 'corner-frame') return 'polygon(0% 0%, 28% 0%, 28% 6%, 6% 6%, 6% 28%, 0% 28%, 0% 0%, 72% 0%, 100% 0%, 100% 28%, 94% 28%, 94% 6%, 72% 6%, 72% 0%, 100% 72%, 100% 100%, 72% 100%, 72% 94%, 94% 94%, 94% 72%, 100% 72%, 28% 100%, 0% 100%, 0% 72%, 6% 72%, 6% 94%, 28% 94%)';
  return undefined;
};

function FormattedText({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const parsedText = useMemo(() => parseListText(text), [text]);
  const richSpans = useMemo(() => {
    if (parsedText.type !== 'plain') return null;
    return parseRichText(parsedText.text);
  }, [parsedText]);

  const content = parsedText.type === 'ol'
    ? (
      <ol className="m-0 list-decimal space-y-0.5 pl-4">
        {parsedText.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ol>
    )
    : parsedText.type === 'ul'
      ? (
        <ul className="m-0 list-disc space-y-0.5 pl-4">
          {parsedText.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      )
      : richSpans
        ? (
          <>
            {richSpans.map((span, i) => {
              const spanStyle: React.CSSProperties = {};
              if (span.bold) spanStyle.fontWeight = 'bold';
              if (span.italic) spanStyle.fontStyle = 'italic';
              if (span.underline) spanStyle.textDecoration = 'underline';
              if (span.highlight) spanStyle.backgroundColor = span.highlight;
              if (span.color) spanStyle.color = span.color;
              const hasStyle = Object.keys(spanStyle).length > 0;
              return hasStyle
                ? <span key={i} style={spanStyle}>{span.text}</span>
                : span.text;
            })}
          </>
        )
        : 'text' in parsedText ? parsedText.text : '';

  return (
    <div className={cn('h-full w-full overflow-hidden leading-[1.18]', parsedText.type === 'plain' && 'whitespace-pre-wrap break-words', className)} style={style}>
      {content}
    </div>
  );
}


export function CardPreview({
  card,
  className,
  isPrintMode = false,
  showSizeInfo = false,
  isEditorPreview = false,
  hideEmptySections = true,
  onSectionClick,
  onRowClick,
  onEdit,
  targetWidthPx,
}: CardPreviewProps) {

  const templateToRender = card.template;
  const dataToRender = card.data;

  const effectiveWidthPx = targetWidthPx || PREVIEW_WIDTH_PX;
  const [aspectW, aspectH] = (templateToRender.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);

  let cardPixelHeight: number;
  if (aspectW > 0 && aspectH > 0 && effectiveWidthPx > 0 && isFinite(effectiveWidthPx) && isFinite(aspectW) && isFinite(aspectH)) {
    cardPixelHeight = (effectiveWidthPx / aspectW) * aspectH;
  } else {
    const defaultRatioParts = TCG_ASPECT_RATIO.split(':').map(Number);
    cardPixelHeight = (effectiveWidthPx / (defaultRatioParts[0] || 63)) * (defaultRatioParts[1] || 88);
  }
  if (!isFinite(cardPixelHeight)) { 
      cardPixelHeight = (effectiveWidthPx / (63/88));
  }

  const tb = templateToRender;
  
  const resolvedCardContentBgUrl = tb.cardBackgroundImageUrl ? replacePlaceholdersLocal(tb.cardBackgroundImageUrl, dataToRender, isEditorPreview) : undefined;
  const resolvedCardBorderImageSource = tb.cardBorderImageSource ? replacePlaceholdersLocal(tb.cardBorderImageSource, dataToRender, isEditorPreview) : undefined;
  
  const effectiveBorderWidthStr = tb.cardBorderWidth || '0px';
  const borderWidthMatch = effectiveBorderWidthStr.match(/^(\d+(\.\d+)?)/);
  const numericBorderWidth = borderWidthMatch ? parseFloat(borderWidthMatch[1]) : 0;
  const unitMatch = effectiveBorderWidthStr.match(/[a-zA-Z%]+$/);
  const effectiveBorderWidthUnit = unitMatch ? unitMatch[0] : 'px';
  const finalEffectiveBorderWidthWithUnit = `${numericBorderWidth}${effectiveBorderWidthUnit}`;

  const cardContainerStyle: React.CSSProperties = {
    width: `${effectiveWidthPx}px`,
    height: `${cardPixelHeight}px`,
    boxSizing: 'border-box',
    position: 'relative', 
  };

  if (tb.cardBorderRadius) cardContainerStyle.borderRadius = tb.cardBorderRadius;

  const isStandardOrCustomFrame = tb.frameStyle === 'standard' || tb.frameStyle === 'custom';
  const isCSSDrivenBorderImage = resolvedCardBorderImageSource && resolvedCardBorderImageSource.startsWith("CSS:");
  
  const useImageBorderViaMultiBackground = 
    isStandardOrCustomFrame &&
    resolvedCardBorderImageSource &&
    !isCSSDrivenBorderImage &&
    !resolvedCardBorderImageSource.startsWith("linear-gradient") &&
    !resolvedCardBorderImageSource.startsWith("radial-gradient") &&
    numericBorderWidth > 0;

  if (useImageBorderViaMultiBackground) {
    cardContainerStyle.padding = finalEffectiveBorderWidthWithUnit;
    cardContainerStyle.border = 'none'; 
    cardContainerStyle.backgroundColor = 'transparent'; // Base element transparent, layers define appearance

    const finalBgImages = [];
    const finalBgSizes = [];
    const finalBgClips = [];
    const finalBgOrigins = [];
    const finalBgPositions = [];
    const finalBgRepeats = [];

    // Layer 2: Content Background Image (Optional, Topmost)
    if (resolvedCardContentBgUrl && (resolvedCardContentBgUrl.startsWith('http') || resolvedCardContentBgUrl.startsWith('data:'))) {
        finalBgImages.push(`url(${resolvedCardContentBgUrl})`);
        finalBgSizes.push('cover'); // Or tb.cardContentBackgroundSize if implemented
        finalBgClips.push('content-box');
        finalBgOrigins.push('content-box');
        finalBgPositions.push('center center');
        finalBgRepeats.push('no-repeat');
    }

    // Layer 1: Base Background Color for Content Area (Middle)
    const baseBgForContent = tb.baseBackgroundColor && tb.baseBackgroundColor !== 'transparent' ? tb.baseBackgroundColor : null;
    if (baseBgForContent) {
        finalBgImages.push(`linear-gradient(${baseBgForContent}, ${baseBgForContent})`);
        finalBgSizes.push('auto'); 
        finalBgClips.push('content-box');
        finalBgOrigins.push('content-box');
        finalBgPositions.push('center center');
        finalBgRepeats.push('no-repeat');
    }
    
    // Layer 0: Border Image (Bottommost, fills padding-box)
    finalBgImages.push(`url(${resolvedCardBorderImageSource})`);
    finalBgSizes.push('cover'); 
    finalBgClips.push('padding-box');
    finalBgOrigins.push('padding-box');
    finalBgPositions.push('center center');
    finalBgRepeats.push('no-repeat');
    
    cardContainerStyle.backgroundImage = finalBgImages.join(', ');
    cardContainerStyle.backgroundSize = finalBgSizes.join(', ');
    cardContainerStyle.backgroundClip = finalBgClips.join(', ');
    cardContainerStyle.backgroundOrigin = finalBgOrigins.join(', ');
    cardContainerStyle.backgroundPosition = finalBgPositions.join(', ');
    cardContainerStyle.backgroundRepeat = finalBgRepeats.join(', ');

  } else {
    // Fallback to Original Border Logic (Solid color with box-shadow, CSS border-image, or predefined frame)
    cardContainerStyle.backgroundColor = tb.baseBackgroundColor || undefined;
    if (tb.baseTextColor) cardContainerStyle.color = tb.baseTextColor;

    if (resolvedCardContentBgUrl && (resolvedCardContentBgUrl.startsWith('http') || resolvedCardContentBgUrl.startsWith('data:'))) {
        // For non-multi-background cases, this content background is applied directly.
        // If a border image is active via CSS (e.g. classic-gold), this background needs to respect it.
        cardContainerStyle.backgroundImage = `url(${resolvedCardContentBgUrl})`;
        cardContainerStyle.backgroundSize = 'cover'; // Or tb.cardContentBackgroundSize
        cardContainerStyle.backgroundPosition = 'center';
        cardContainerStyle.backgroundClip = 'content-box'; // Ensures content bg is inside any border
        cardContainerStyle.backgroundOrigin = 'content-box';
    }
    
    if (isStandardOrCustomFrame && !isCSSDrivenBorderImage && numericBorderWidth > 0) {
        cardContainerStyle.boxShadow = `0 0 0 ${finalEffectiveBorderWidthWithUnit} ${tb.cardBorderColor || 'hsl(var(--border))'}`;
        cardContainerStyle.borderColor = 'transparent';
        cardContainerStyle.borderWidth = finalEffectiveBorderWidthWithUnit; 
        cardContainerStyle.borderStyle = (tb.cardBorderStyle && tb.cardBorderStyle !== '_default_' && tb.cardBorderStyle !== 'none')
                                          ? tb.cardBorderStyle as React.CSSProperties['borderStyle']
                                          : 'solid';
    } else if (isStandardOrCustomFrame && isCSSDrivenBorderImage && numericBorderWidth > 0) {
        cardContainerStyle.borderImageSource = resolvedCardBorderImageSource; 
        const parsedBorderWidthForSlice = numericBorderWidth > 0 ? numericBorderWidth : 1;
        cardContainerStyle.borderImageSlice = parsedBorderWidthForSlice; 
        cardContainerStyle.borderColor = 'transparent'; 
        cardContainerStyle.borderWidth = finalEffectiveBorderWidthWithUnit;
        cardContainerStyle.borderStyle = (tb.cardBorderStyle && tb.cardBorderStyle !== '_default_' && tb.cardBorderStyle !== 'none')
                                          ? tb.cardBorderStyle as React.CSSProperties['borderStyle']
                                          : 'solid';
    } else if (!isStandardOrCustomFrame) { 
        if (tb.cardBorderColor) cardContainerStyle.borderColor = tb.cardBorderColor;
        if (tb.cardBorderWidth) cardContainerStyle.borderWidth = tb.cardBorderWidth;
        if (tb.cardBorderStyle && tb.cardBorderStyle !== '_default_' && tb.cardBorderStyle !== 'none') {
            cardContainerStyle.borderStyle = tb.cardBorderStyle as React.CSSProperties['borderStyle'];
        } else if (tb.cardBorderStyle === 'none' || numericBorderWidth === 0) {
            cardContainerStyle.borderStyle = 'none';
            cardContainerStyle.borderWidth = '0';
        } else {
            cardContainerStyle.borderStyle = 'solid';
        }
    }
  }


  const calculatedPrintSize = useMemo(() => {
    if (!showSizeInfo) return '';
    const [ratioW, ratioH] = (templateToRender.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
    if (isNaN(ratioW) || isNaN(ratioH) || ratioW <= 0 || ratioH <= 0) {
        const defaultWidthIn = (STANDARD_TCG_WIDTH_MM * MM_TO_INCHES).toFixed(1);
        const defaultHeightIn = (88 * MM_TO_INCHES).toFixed(1);
        return `Approx. Print Size: ${defaultWidthIn}in x ${defaultHeightIn}in`;
    }

    // If both ratio values are >= 20 they represent actual mm dimensions.
    // Otherwise treat as a pure proportion and normalise to standard 88mm height.
    let widthMm: number, heightMm: number;
    if (ratioW >= 20 && ratioH >= 20) {
      widthMm = ratioW;
      heightMm = ratioH;
    } else {
      heightMm = 88;
      widthMm = (ratioW / ratioH) * 88;
    }
    const widthInches = (widthMm * MM_TO_INCHES).toFixed(1);
    const heightInches = (heightMm * MM_TO_INCHES).toFixed(1);
    return `Approx. Print Size: ${widthInches}in x ${heightInches}in (${Math.round(widthMm)}mm × ${Math.round(heightMm)}mm)`;
  }, [templateToRender.aspectRatio, showSizeInfo]);

  const descriptiveArtworkText = useMemo(() => {
    let nameValue = 'Artwork';
    if (dataToRender) {
      const nameKeys = ['cardName', 'title', 'name'];
      for (const key of nameKeys) {
        const value = dataToRender[key];
        if (value && typeof value === 'string' && value.trim()) {
          nameValue = value.trim();
          break;
        }
      }
    }
    return nameValue;
  }, [dataToRender]);

  const dataAiHintKeywords = useMemo(() => {
    let baseHint = 'card art';
    if (dataToRender) {
      const nameKeys = ['cardName', 'title', 'name'];
      for (const key of nameKeys) {
        const value = dataToRender[key];
        if (value && typeof value === 'string' && value.trim()) {
          const words = value.trim().toLowerCase().split(/\s+/);
          baseHint = words.slice(0, 2).join(' ');
          if (baseHint) break;
        }
      }
    }
    return baseHint || 'card art';
  }, [dataToRender]);

  const freeformElements = useMemo(() => {
    if (templateToRender.layoutMode !== 'freeform' || !templateToRender.freeformCanvas) return null;
    const canvas = templateToRender.freeformCanvas;
    const scaleX = effectiveWidthPx / Math.max(1, canvas.width);
    const scaleY = cardPixelHeight / Math.max(1, canvas.height);
    const elementById = new Map((canvas.elements || []).map(el => [el.id, el]));
    return [...(canvas.elements || [])]
      .sort((a, b) => a.zIndex - b.zIndex)
      .filter((element) => {
        if (element.visible === false) return false;
        // Hide if any ancestor is hidden
        let pid = element.parentId;
        while (pid) {
          const parent = elementById.get(pid);
          if (!parent) break;
          if (parent.visible === false) return false;
          pid = parent.parentId;
        }
        return true;
      })
      .map((element) => {
        const borderWidth = borderWidthClassToPixels(element.borderWidth);
        const resolvedBgUrl = element.backgroundImageUrl ? replacePlaceholdersLocal(element.backgroundImageUrl, dataToRender, isEditorPreview) : '';
        const structuredAppearanceStyle = appearanceToStyle(normalizeAppearanceForElement(element));
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: element.x * scaleX,
          top: element.y * scaleY,
          width: element.width * scaleX,
          height: element.height * scaleY,
          transform: `rotate(${element.rotation || 0}deg)${element.appearance?.assetFlipX ? ' scaleX(-1)' : ''}`,
          transformOrigin: 'center',
          opacity: element.opacity ?? 1,
          zIndex: element.zIndex,
          overflow: 'hidden',
          boxSizing: 'border-box',
          color: element.textColor || templateToRender.baseTextColor || undefined,
          backgroundColor: element.backgroundColor || 'transparent',
          borderStyle: borderWidth > 0 ? 'solid' : undefined,
          borderWidth: borderWidth > 0 ? borderWidth : undefined,
          borderColor: element.borderColor || templateToRender.defaultSectionBorderColor || undefined,
          borderRadius: radiusClassToPixels(element.borderRadius) || element.borderRadius || undefined,
          backgroundImage: resolvedBgUrl && (resolvedBgUrl.startsWith('linear-gradient') || resolvedBgUrl.startsWith('radial-gradient'))
            ? resolvedBgUrl
            : resolvedBgUrl && (resolvedBgUrl.startsWith('http') || resolvedBgUrl.startsWith('data:'))
              ? `url(${resolvedBgUrl})`
              : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          pointerEvents: isEditorPreview ? 'auto' : 'none',
          ...structuredAppearanceStyle,
        };

        if (element.type === 'image') {
          const imageUrl = getFreeformImageUrl(element, dataToRender, descriptiveArtworkText);
          return (
            <div key={element.id} style={baseStyle} data-freeform-element-id={element.id}>
              <img
                src={imageUrl}
                alt={`Image for ${element.name}`}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  minWidth: 0,
                  minHeight: 0,
                  objectFit: element.imageObjectFit || 'cover',
                  objectPosition: 'center',
                  borderRadius: 'inherit',
                  display: 'block',
                }}
                data-ai-hint={dataAiHintKeywords}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://placehold.co/${Math.max(80, Math.round(element.width || 300))}x${Math.max(80, Math.round(element.height || 200))}.png?text=${encodeURIComponent(descriptiveArtworkText || 'Image')}`;
                }}
              />
            </div>
          );
        }

        if (element.type === 'icon') {
          const iconImageUrl = element.iconImageSource ? replacePlaceholdersLocal(element.iconImageSource, dataToRender, isEditorPreview) : '';
          if (iconImageUrl && (iconImageUrl.startsWith('http') || iconImageUrl.startsWith('data:'))) {
            return (
              <div key={element.id} style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-freeform-element-id={element.id}>
                <img
                  src={iconImageUrl}
                  alt={`Icon for ${element.name}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    objectFit: 'contain',
                    objectPosition: 'center',
                    borderRadius: 'inherit',
                    display: 'block',
                  }}
                />
              </div>
            );
          }
          const IconComponent = (LucideIcons as unknown as Record<string, React.ElementType>)[element.iconName || 'Sparkles'] || LucideIcons.Sparkles;
          return (
            <div key={element.id} style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-freeform-element-id={element.id}>
              <IconComponent
                size="80%"
                color={element.strokeColor || element.textColor || 'currentColor'}
                fill={element.fillColor || 'none'}
                strokeWidth={element.strokeWidth || 2}
                aria-hidden="true"
              />
            </div>
          );
        }

        if (element.type === 'shape') {
          const elementIsDivider = isDividerElement(element);
          const shapeStyle: React.CSSProperties = {
            ...baseStyle,
            backgroundColor: element.fillColor || element.backgroundColor || 'transparent',
            borderColor: element.strokeColor || element.borderColor || undefined,
            borderWidth: element.strokeWidth !== undefined ? element.strokeWidth : baseStyle.borderWidth,
            borderRadius: element.shapeKind === 'ellipse' ? '9999px' : baseStyle.borderRadius,
            clipPath: elementIsDivider ? undefined : shapeClipPath(element.shapeKind),
            height: elementIsDivider ? Math.max(1, Number(baseStyle.height) || 0, (element.strokeWidth || 2) * scaleY) : baseStyle.height,
            ...structuredAppearanceStyle,
          };
          return <div key={element.id} style={shapeStyle} data-freeform-element-id={element.id} />;
        }

        const processedText = replacePlaceholdersLocal(element.content, dataToRender, true);
        const textStyle: React.CSSProperties = {
          ...baseStyle,
          display: 'flex',
          alignItems: element.textAlign === 'center' ? 'center' : 'flex-start',
          justifyContent: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start',
          textAlign: element.textAlign || 'left',
          fontSize: `${textFontSizePx(element) * scaleX}px`,
          lineHeight: 1.18,
          fontStyle: element.fontStyle || 'normal',
          writingMode: element.writingMode || 'horizontal-tb',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        };
        return (
          <div
            key={element.id}
            className={cn(element.padding || 'p-1', element.fontWeight || 'font-normal', element.fontFamily || 'font-sans')}
            style={textStyle}
            data-freeform-element-id={element.id}
          >
            <FormattedText
              text={processedText}
              className={cn(element.fontWeight || 'font-normal', element.fontFamily || 'font-sans')}
            />
          </div>
        );
      });
  }, [cardPixelHeight, dataAiHintKeywords, dataToRender, descriptiveArtworkText, effectiveWidthPx, isEditorPreview, templateToRender]);


  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) return false;
    if (hideEmptySections) {
      if (section.sectionContentType === 'image') {
        const imageKey = section.contentPlaceholder;
        const imageUrl = dataToRender && imageKey ? (dataToRender[imageKey] as string || '') : '';
        return !imageUrl || !(imageUrl.startsWith('http') || imageUrl.startsWith('data:'));
      }
      const hasTextContent = processedContent.trim() !== '';
      const resolvedBgUrl = section.backgroundImageUrl ? replacePlaceholdersLocal(section.backgroundImageUrl, dataToRender, false) : '';
      const hasValidBgImage = !!resolvedBgUrl && (resolvedBgUrl.startsWith('http') || resolvedBgUrl.startsWith('data:'));
      return !hasTextContent && !hasValidBgImage;
    }
    return false;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onEdit && !isEditorPreview) {
      onEdit(card);
    }
  };

  const elementIdSuffix = card.uniqueId;

  return (
    <div
      id={`card-preview-${elementIdSuffix}`}
      className={cn("flex flex-col items-center group relative", className)}
    >
      <div
        className={cn(
          "tcg-card-preview shadow-lg flex flex-col relative overflow-hidden",
          onEdit && !isEditorPreview ? 'cursor-pointer hover:shadow-primary/50 hover:shadow-md transition-shadow duration-150' : '',
          `frame-${templateToRender.frameStyle || 'standard'}`
        )}
        style={cardContainerStyle}
        data-ai-hint="tcg card custom"
        onClick={handleCardClick}
      >
        {templateToRender.layoutMode === 'freeform' ? freeformElements : (templateToRender.rows || []).map((row, rowIndex) => {
          const handlePreviewRowClick = (e: React.MouseEvent) => {
            if (isEditorPreview && onRowClick) {
              e.stopPropagation();
              onRowClick(row.id);
            }
          };

          let rowEffectiveHeight: string | undefined = row.customHeight || undefined;
          if (row.customHeight && row.customHeight.includes('%') && cardPixelHeight > 0 && isFinite(cardPixelHeight)) {
            const percentageValue = parseFloat(row.customHeight.replace('%', ''));
            if (!isNaN(percentageValue) && isFinite(percentageValue)) {
              rowEffectiveHeight = `${cardPixelHeight * (percentageValue / 100)}px`;
            }
          }

          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: row.alignItems || 'flex-start',
            height: rowEffectiveHeight,
            flexShrink: 0,
            zIndex: 1, 
            position: 'relative', 
          };

          const allColumnsInRowEffectivelyHidden = (row.columns || []).every(col => {
            let colContent = '';
            if (col.sectionContentType === 'image') {
                const imageKey = col.contentPlaceholder;
                colContent = dataToRender && imageKey ? (dataToRender[imageKey] as string || '') : '';
            } else {
                colContent = replacePlaceholdersLocal(col.contentPlaceholder, dataToRender, true);
            }
            return shouldHideSection(col, colContent);
          });

          if (allColumnsInRowEffectivelyHidden && !isEditorPreview) {
            return null;
          }

          return (
            <div
              key={row.id}
              className={cn(
                "flex w-full",
                isEditorPreview && onRowClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-500/70' : ''
              )}
              style={rowStyle}
              onClick={handlePreviewRowClick}
              data-row-id={row.id}
            >
              {(row.columns || []).map((section, sectionIndex) => {
                const sectionStyle: React.CSSProperties = {
                  position: 'relative',
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  borderColor: section.borderColor || templateToRender.defaultSectionBorderColor || undefined,
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  borderRadius: section.borderRadius || undefined,
                  height: section.customHeight || undefined,
                  width: section.customWidth || undefined,
                  overflowWrap: 'break-word',
                };

                if (section.backgroundImageUrl) {
                    const resolvedBgUrl = replacePlaceholdersLocal(section.backgroundImageUrl, dataToRender, isEditorPreview);
                    if (resolvedBgUrl && (resolvedBgUrl.startsWith('http') || resolvedBgUrl.startsWith('data:'))) {
                        sectionStyle.backgroundImage = `url(${resolvedBgUrl})`;
                        sectionStyle.backgroundSize = 'cover';
                        sectionStyle.backgroundPosition = 'center';
                    }
                }

                if (section.customWidth) {
                  // User set an explicit CSS width — pin to it.
                  sectionStyle.width = section.customWidth;
                  sectionStyle.flexBasis = section.customWidth;
                  sectionStyle.flexShrink = 0;
                  sectionStyle.flexGrow = section.flexGrow || 0;
                } else if (section.sectionContentType === 'image' && !section.imageWidthPx) {
                  // Image with no explicit pixel width: grow to fill available row space.
                  // flexBasis:0% + flexGrow:1+ prevents the width:100% overflow that
                  // would otherwise occur in multi-column rows.
                  sectionStyle.flexGrow = section.flexGrow || 1;
                  sectionStyle.flexShrink = 1;
                  sectionStyle.flexBasis = '0%';
                  sectionStyle.minWidth = '0';
                } else {
                  sectionStyle.flexBasis = (section.flexGrow && section.flexGrow > 0) ? '0%' : 'auto';
                  sectionStyle.flexShrink = (section.flexGrow && section.flexGrow > 0) ? 1 : 0;
                  sectionStyle.flexGrow = section.flexGrow || 0;
                }


                if (section.sectionContentType !== 'image') {
                  sectionStyle.overflowWrap = 'break-word';
                  if (section.flexGrow && section.flexGrow > 0) {
                    sectionStyle.minWidth = 0;
                    sectionStyle.minHeight = 0;
                    sectionStyle.overflowY = 'auto';
                  }
                }

                let sectionBorderClass = '';
                if (section.borderWidth && section.borderWidth !== '_none_') {
                    sectionBorderClass = section.borderWidth;
                }

                const sectionClasses = cn(
                  'relative',
                  section.padding || 'p-1',
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  section.minHeight && section.minHeight !== '_auto_' && !section.customHeight ? section.minHeight : '',
                  sectionBorderClass,
                  section.sectionContentType !== 'image' ? 'whitespace-pre-wrap break-words' : '',
                  isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : '',
                  isEditorPreview && 'border-l border-r border-border/10',
                  // w-full only applies to text sections: image sections are sized by flex layout.
                  // Applying w-full (width:100%) to an image in a multi-column row causes it to
                  // override flex distribution and consume the entire row width.
                  (section.sectionContentType !== 'image' && !section.customWidth && ((section.flexGrow && section.flexGrow > 0) || (row.columns || []).length === 1)) ? 'w-full' : ''
                );

                const handlePreviewSectionClick = (e: React.MouseEvent) => {
                  if (isEditorPreview && onSectionClick) {
                    e.stopPropagation();
                    onSectionClick(section.id);
                  }
                };

                let processedContentForDisplay = isEditorPreview && section.sectionContentType === 'placeholder'
                    ? section.contentPlaceholder.replace(/\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g, (match, key) => key)
                    : replacePlaceholdersLocal(section.contentPlaceholder, dataToRender, true);

                if (shouldHideSection(section, processedContentForDisplay) && !isEditorPreview && section.sectionContentType !== 'image') {
                  return null;
                }

                if (section.sectionContentType === 'image') {
                    const imageKey = section.contentPlaceholder;
                    // displayWidth/Height are only used for the placeholder image URL dimensions.
                    // The container's CSS size is controlled by imageWidthPx/customWidth/customHeight.
                    // Use large fallbacks so placeholder images aren't tiny 100×100 thumbnails.
                    const displayWidth = parseInt(section.imageWidthPx || '0', 10);
                    const displayHeight = parseInt(section.imageHeightPx || '0', 10);

                    if (isEditorPreview) {
                        return (
                            <div
                                key={section.id}
                                className={cn(sectionClasses, "flex items-center justify-center bg-muted/50 border-dashed border-border overflow-hidden")}
                                style={{
                                    ...sectionStyle,
                                    // Only set explicit width when imageWidthPx is specified.
                                    // customWidth is already in sectionStyle; no-explicit-width uses flex layout.
                                    ...(section.imageWidthPx ? { width: `${displayWidth}px`, flexBasis: `${displayWidth}px`, flexShrink: 0, flexGrow: 0 } : {}),
                                    height: section.imageHeightPx ? `${displayHeight}px` : (section.customHeight || '120px'),
                                    borderRadius: section.borderRadius || undefined,
                                }}
                                onClick={handlePreviewSectionClick}
                                data-section-id={section.id}
                            >
                                <div className="text-center text-muted-foreground text-xs p-1">
                                    <div>Image Key: {section.contentPlaceholder || "not_set"}</div>
                                    <div>Size: {section.imageWidthPx || 'auto'}px x {section.imageHeightPx || 'auto'}px</div>
                                </div>
                            </div>
                        );
                    }

                    let imageUrl = dataToRender && imageKey ? (dataToRender[imageKey] as string || '') : '';
                    const isValidUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:'));

                    if (!isValidUrl) {
                        const placeholderTextForUrl = descriptiveArtworkText || "Artwork";
                        imageUrl = `https://placehold.co/${displayWidth > 0 ? displayWidth : 600}x${displayHeight > 0 ? displayHeight : 400}.png?text=${encodeURIComponent(placeholderTextForUrl)}`;
                    }

                    if (shouldHideSection(section, imageUrl) && !isEditorPreview) {
                        return null;
                    }

                    return (
                        <div
                            key={section.id}
                            className={cn(sectionClasses, section.padding || 'p-0')}
                            style={{
                                ...sectionStyle,
                                // Only set explicit width when imageWidthPx is specified.
                                // customWidth is already in sectionStyle; no-explicit-width uses flex layout.
                                ...(section.imageWidthPx ? { width: `${displayWidth}px`, flexBasis: `${displayWidth}px`, flexShrink: 0, flexGrow: 0 } : {}),
                                height: section.imageHeightPx
                                    ? `${displayHeight}px`
                                    : (section.customHeight || (row.customHeight ? '100%' : 'auto')),
                                maxWidth: '100%',
                                overflow: 'hidden',
                                borderRadius: section.borderRadius || undefined,
                            }}
                            onClick={handlePreviewSectionClick}
                            data-section-id={section.id}
                        >
                            <img
                                src={imageUrl}
                                alt={`Image for ${section.contentPlaceholder}`}
                                style={{
                                  objectFit: section.imageObjectFit || 'cover',
                                  width: '100%',
                                  // height:100% only works when the container has a defined height.
                                  // When container is height:auto (no explicit heights on section or row),
                                  // use height:auto so the image renders at its natural aspect ratio.
                                  height: (section.imageHeightPx || section.customHeight || row.customHeight) ? '100%' : 'auto',
                                  borderRadius: section.borderRadius || undefined,
                                  display: 'block',
                                }}
                                data-ai-hint={dataAiHintKeywords}
                                onError={(e) => {
                                  const placeholderText = descriptiveArtworkText || 'Image';
                                  (e.currentTarget as HTMLImageElement).src = `https://placehold.co/${displayWidth > 0 ? displayWidth : 300}x${displayHeight > 0 ? displayHeight : 200}.png?text=${encodeURIComponent(placeholderText)}`;
                                }}
                            />
                        </div>
                    );

                } else {
                    return (
                      <div
                        key={section.id}
                        className={sectionClasses}
                        style={sectionStyle}
                        onClick={handlePreviewSectionClick}
                        data-section-id={section.id}
                      >
                        <FormattedText
                          text={processedContentForDisplay}
                          className={cn(section.fontSize || 'text-sm', section.fontWeight || 'font-normal', section.fontFamily || 'font-sans')}
                          style={{
                            textAlign: section.textAlign || 'left',
                            fontStyle: section.fontStyle || 'normal',
                          }}
                        />
                      </div>
                    );
                }
              })}
            </div>
          );
        })}
      </div>
      {showSizeInfo && !isPrintMode && (
        <div className="text-xs text-muted-foreground mt-1" data-html2canvas-ignore="true">
          {calculatedPrintSize}
        </div>
      )}
    </div>
  );
}

