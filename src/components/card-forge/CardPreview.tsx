
"use client";

import type { CardFace, DisplayCard, TCGCardTemplate } from '@/types';
import { cn, replacePlaceholdersLocal } from '@/lib/utils';
import { appearanceToStyle, normalizeAppearanceForElement, normalizeTemplateAppearance } from '@/lib/appearance';
import { isDividerElement } from '@/lib/elementCapabilities';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import {
  buildTextElementStyle,
} from '@/lib/textTools';
import { useAppStore } from '@/store/appStore';
import * as LucideIcons from 'lucide-react';
import { CardTextContent } from '@/lib/cardTextRender';
import { borderWidthClassToPixels, radiusClassToCss, resolveFreeformImageUrl, shapeClipPath } from '@/lib/freeformElementRender';
import { measureRenderedTextFit, type RenderedTextFit } from '@/lib/textCapacity';

interface CardPreviewProps {
  card: DisplayCard;
  face?: CardFace;
  className?: string;
  isPrintMode?: boolean;
  showSizeInfo?: boolean;
  isEditorPreview?: boolean;
  onEdit?: (card: DisplayCard) => void;
  targetWidthPx?: number;
}

const PREVIEW_WIDTH_PX = 280;
const STANDARD_TCG_WIDTH_MM = 63;
const MM_TO_INCHES = 1 / 25.4;

interface MeasuredTextLayerProps {
  elementId: string;
  className?: string;
  style: React.CSSProperties;
  showOverflowBadge: boolean;
  children: React.ReactNode;
}

function MeasuredTextLayer({
  elementId,
  className,
  style,
  showOverflowBadge,
  children,
}: MeasuredTextLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<RenderedTextFit | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;

    const measure = () => {
      const contentNode = node.firstElementChild as HTMLElement | null;
      const nextFit = measureRenderedTextFit({
        clientWidth: node.clientWidth,
        clientHeight: node.clientHeight,
        scrollWidth: Math.max(node.scrollWidth, contentNode?.scrollWidth || 0),
        scrollHeight: Math.max(node.scrollHeight, contentNode?.scrollHeight || 0),
      });
      setFit((previous) => (
        previous
          && previous.fits === nextFit.fits
          && previous.overflowX === nextFit.overflowX
          && previous.overflowY === nextFit.overflowY
          ? previous
          : nextFit
      ));
    };

    frame = requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(node);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  });

  const status = fit && !fit.fits ? 'overflow' : 'fit';

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      data-freeform-element-id={elementId}
      data-text-fit-status={status}
      data-text-overflow-x={fit?.overflowsX ? 'true' : 'false'}
      data-text-overflow-y={fit?.overflowsY ? 'true' : 'false'}
    >
      {children}
      {showOverflowBadge && fit && !fit.fits && (
        <span className="pointer-events-none absolute right-1 top-1 z-[2] rounded-full border border-red-300/60 bg-red-950/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-red-100 shadow-sm">
          Text clipping
        </span>
      )}
    </div>
  );
}

const toRenderableBackground = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('linear-gradient') || value.startsWith('radial-gradient')) return value;
  if (value.startsWith('url(')) return value;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('/')) {
    return `url(${value})`;
  }
  return undefined;
};

export function CardPreview({
  card,
  face = 'front',
  className,
  isPrintMode = false,
  showSizeInfo = false,
  isEditorPreview = false,
  onEdit,
  targetWidthPx,
}: CardPreviewProps) {
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);

  const templateToRender = card.template;
  const dataToRender = card.data;
  const canvasToRender = face === 'back'
    ? (templateToRender.backCanvas || templateToRender.freeformCanvas)
    : templateToRender.freeformCanvas;

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
  const templateAppearanceStyle = useMemo(
    () => appearanceToStyle(normalizeTemplateAppearance(tb)),
    [tb]
  );
  
  const resolvedCardContentBgUrl = tb.cardBackgroundImageUrl ? replacePlaceholdersLocal(tb.cardBackgroundImageUrl, dataToRender, isEditorPreview) : undefined;
  const resolvedCardBorderImageSource = tb.cardBorderImageSource ? replacePlaceholdersLocal(tb.cardBorderImageSource, dataToRender, isEditorPreview) : undefined;
  const resolvedCardContentBackground = toRenderableBackground(resolvedCardContentBgUrl);
  
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
    overflow: 'hidden',
    isolation: 'isolate',
    backgroundColor: templateAppearanceStyle.backgroundColor || tb.baseBackgroundColor || undefined,
    backgroundImage: [
      resolvedCardContentBackground,
      templateAppearanceStyle.backgroundImage,
    ].filter(Boolean).join(', ') || undefined,
    backgroundSize: templateAppearanceStyle.backgroundSize || undefined,
    backgroundRepeat: templateAppearanceStyle.backgroundRepeat || undefined,
    backgroundPosition: templateAppearanceStyle.backgroundPosition || undefined,
    backgroundBlendMode: templateAppearanceStyle.backgroundBlendMode || undefined,
    boxShadow: templateAppearanceStyle.boxShadow || undefined,
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
    if (tb.baseBackgroundColor) cardContainerStyle.backgroundColor = tb.baseBackgroundColor;
    if (tb.baseTextColor) cardContainerStyle.color = tb.baseTextColor;

    if (resolvedCardContentBackground) {
        // For non-multi-background cases, this content background is applied directly.
        // If a border image is active via CSS (e.g. classic-gold), this background needs to respect it.
        cardContainerStyle.backgroundImage = [
          resolvedCardContentBackground,
          templateAppearanceStyle.backgroundImage,
        ].filter(Boolean).join(', ');
        cardContainerStyle.backgroundSize = 'cover'; // Or tb.cardContentBackgroundSize
        cardContainerStyle.backgroundPosition = 'center';
        cardContainerStyle.backgroundClip = 'content-box'; // Ensures content bg is inside any border
        cardContainerStyle.backgroundOrigin = 'content-box';
    }
    
    if (isStandardOrCustomFrame && !isCSSDrivenBorderImage && numericBorderWidth > 0) {
        cardContainerStyle.boxShadow = [
          templateAppearanceStyle.boxShadow,
          `0 0 0 ${finalEffectiveBorderWidthWithUnit} ${tb.cardBorderColor || 'hsl(var(--border))'}`,
        ].filter(Boolean).join(', ');
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
    if (!canvasToRender) return null;
    const canvas = canvasToRender;
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
          borderColor: element.borderColor || templateToRender.defaultElementBorderColor || undefined,
          borderRadius: radiusClassToCss(element.borderRadius) || element.borderRadius || undefined,
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
          const imageUrl = resolveFreeformImageUrl(element, dataToRender, descriptiveArtworkText);
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

        const textStyle: React.CSSProperties = {
          ...baseStyle,
          ...buildTextElementStyle(element, scaleX),
        };
        const contentStyle: React.CSSProperties = { lineHeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textDecoration: 'inherit', fontStyle: 'inherit' };
        const textContainerStyle = { ...textStyle, fontSize: undefined as unknown as React.CSSProperties['fontSize'] };
        return (
          <MeasuredTextLayer
            key={element.id}
            className={cn(element.padding || 'p-1', element.fontWeight || 'font-normal', element.fontFamily || 'font-sans')}
            style={textContainerStyle}
            elementId={element.id}
            showOverflowBadge={!isPrintMode}
          >
            <CardTextContent
              template={templateToRender}
              element={element}
              data={dataToRender}
              scale={scaleX}
              className={cn(element.fontWeight || 'font-normal', element.fontFamily || 'font-sans')}
              style={contentStyle}
              highlightColor={richTextHighlightColor}
              styleOverrides={card.styleOverrides}
            />
          </MeasuredTextLayer>
        );
      });
  }, [canvasToRender, card.styleOverrides, cardPixelHeight, dataAiHintKeywords, dataToRender, descriptiveArtworkText, effectiveWidthPx, isEditorPreview, templateToRender]);

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
        {freeformElements}
      </div>
      {showSizeInfo && !isPrintMode && (
        <div className="text-xs text-muted-foreground mt-1">
          {calculatedPrintSize}
        </div>
      )}
    </div>
  );
}

