"use client";

import type { CardFace } from '@/domain/cards';
import { cn } from '@/shared/classNames';
import {
  canRenderVectorShape,
  getCardFaceCanvas,
  getCardFaceData,
  getCardFaceTemplate,
  getCardPreviewLayout,
  getImageFieldKeyForElement,
  replacePlaceholdersLocal,
  resolveImageElementOverrides,
  TCG_ASPECT_RATIO,
} from '@/domain/rendering';
import { isDividerElement } from '@/domain/templates';
import { useMemo, type ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import { normalizeAppearanceForElement, normalizeTemplateAppearance } from '@/domain/templates';
import { appearanceToStyle } from '../model/appearance';
import { borderWidthClassToPixels, borderWidthClassToStyle, radiusClassToCss, resolveFreeformImageUrl } from '../model/elementStyles';
import { buildTextElementStyle, DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR } from './RichTextContent';
import { CardTextContent } from './CardTextContent';
import { VectorShapeElement } from './VectorShapeElement';
import type { DisplayCard } from '@/domain/rendering';

interface CardPreviewProps {
  card: DisplayCard;
  face?: CardFace;
  className?: string;
  isPrintMode?: boolean;
  showSizeInfo?: boolean;
  isEditorPreview?: boolean;
  interactionOverlay?: ReactNode;
  highlightColor?: string;
  onSelect?: (card: DisplayCard) => void;
  onEdit?: (card: DisplayCard) => void;
  targetWidthPx?: number;
}

const PREVIEW_WIDTH_PX = 280;
const STANDARD_TCG_WIDTH_MM = 63;
const MM_TO_INCHES = 1 / 25.4;

const toRenderableBackground = (value?: unknown): string | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
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
  interactionOverlay,
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  onSelect,
  onEdit,
  targetWidthPx,
}: CardPreviewProps) {
  const templateToRender = getCardFaceTemplate(card, face);
  const dataToRender = getCardFaceData(card, face);
  const canvasToRender = getCardFaceCanvas(card, face);

  const effectiveWidthPx = targetWidthPx || PREVIEW_WIDTH_PX;
  const previewLayout = getCardPreviewLayout({
    targetWidthPx: effectiveWidthPx,
    aspectRatio: templateToRender.aspectRatio,
    canvas: canvasToRender,
    isPrintMode,
  });
  const { renderWidthPx, visualScale } = previewLayout;
  const cardPixelHeight = previewLayout.renderHeightPx;

  const tb = templateToRender;
  const templateAppearanceStyle = useMemo(
    () => appearanceToStyle(normalizeTemplateAppearance(tb)),
    [tb]
  );

  const resolvedCardContentBgUrl = tb.cardBackgroundImageUrl ? replacePlaceholdersLocal(tb.cardBackgroundImageUrl, dataToRender, isEditorPreview) : undefined;
  const resolvedCardBorderImageSource = tb.cardBorderImageSource ? replacePlaceholdersLocal(tb.cardBorderImageSource, dataToRender, isEditorPreview) : undefined;
  const resolvedCardContentBackground = toRenderableBackground(resolvedCardContentBgUrl);
  const resolvedBorderVisual = toRenderableBackground(resolvedCardBorderImageSource);
  const borderVisualIsGradient = Boolean(
    resolvedCardBorderImageSource?.startsWith('linear-gradient')
    || resolvedCardBorderImageSource?.startsWith('radial-gradient'),
  );
  const borderOverlayBackground = resolvedBorderVisual && !borderVisualIsGradient
    ? resolvedBorderVisual
    : undefined;

  const rawCardBorderWidth = tb.cardBorderWidth as unknown;
  const effectiveBorderWidthStr = typeof rawCardBorderWidth === 'string'
    ? rawCardBorderWidth
    : typeof rawCardBorderWidth === 'number'
      ? `${rawCardBorderWidth}px`
      : '0px';
  const borderWidthMatch = effectiveBorderWidthStr.match(/^(\d+(\.\d+)?)/);
  const numericBorderWidth = borderWidthMatch ? parseFloat(borderWidthMatch[1]) : 0;
  const unitMatch = effectiveBorderWidthStr.match(/[a-zA-Z%]+$/);
  const effectiveBorderWidthUnit = unitMatch ? unitMatch[0] : 'px';
  const finalEffectiveBorderWidthWithUnit = `${numericBorderWidth}${effectiveBorderWidthUnit}`;
  const structuralBorderStyle = tb.cardBorderStyle && tb.cardBorderStyle !== '_default_'
    ? tb.cardBorderStyle
    : 'solid';

  const cardContainerStyle: React.CSSProperties = {
    width: `${renderWidthPx}px`,
    height: `${cardPixelHeight}px`,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    color: tb.baseTextColor || undefined,
    backgroundColor: templateAppearanceStyle.backgroundColor || tb.baseBackgroundColor || undefined,
    backgroundImage: [
      resolvedCardContentBackground,
      templateAppearanceStyle.backgroundImage,
    ].filter(Boolean).join(', ') || undefined,
    backgroundSize: resolvedCardContentBackground ? 'cover' : templateAppearanceStyle.backgroundSize || undefined,
    backgroundRepeat: resolvedCardContentBackground ? 'no-repeat' : templateAppearanceStyle.backgroundRepeat || undefined,
    backgroundPosition: resolvedCardContentBackground ? 'center' : templateAppearanceStyle.backgroundPosition || undefined,
    backgroundBlendMode: templateAppearanceStyle.backgroundBlendMode || undefined,
    boxShadow: templateAppearanceStyle.boxShadow || undefined,
  };

  if (tb.cardBorderRadius) cardContainerStyle.borderRadius = tb.cardBorderRadius;

  if (numericBorderWidth > 0 && structuralBorderStyle !== 'none') {
    cardContainerStyle.borderWidth = finalEffectiveBorderWidthWithUnit;
    cardContainerStyle.borderStyle = structuralBorderStyle as React.CSSProperties['borderStyle'];
    cardContainerStyle.borderColor = tb.cardBorderColor || 'hsl(var(--border))';
    if (borderVisualIsGradient && resolvedCardBorderImageSource) {
      cardContainerStyle.borderImageSource = resolvedCardBorderImageSource;
      cardContainerStyle.borderImageSlice = 1;
      cardContainerStyle.borderColor = 'transparent';
    }
  } else {
    cardContainerStyle.borderWidth = 0;
    cardContainerStyle.borderStyle = 'none';
  }

  const borderOverlayStyle: React.CSSProperties | null = borderOverlayBackground ? {
    position: 'absolute',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    backgroundImage: borderOverlayBackground,
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : null;

  const calculatedPrintSize = useMemo(() => {
    if (!showSizeInfo) return '';
    const [ratioW, ratioH] = (templateToRender.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
    if (isNaN(ratioW) || isNaN(ratioH) || ratioW <= 0 || ratioH <= 0) {
      const defaultWidthIn = (STANDARD_TCG_WIDTH_MM * MM_TO_INCHES).toFixed(1);
      const defaultHeightIn = (88 * MM_TO_INCHES).toFixed(1);
      return `Approx. Print Size: ${defaultWidthIn}in x ${defaultHeightIn}in`;
    }

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
    const scaleX = renderWidthPx / Math.max(1, canvas.width);
    const scaleY = cardPixelHeight / Math.max(1, canvas.height);
    const elementById = new Map((canvas.elements || []).map(el => [el.id, el]));
    return [...(canvas.elements || [])]
      .sort((a, b) => a.zIndex - b.zIndex)
      .filter((element) => {
        if (element.visible === false) return false;
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
        const imageResolution = element.type === 'image'
          ? resolveImageElementOverrides(element, dataToRender, getImageFieldKeyForElement(element))
          : null;
        const renderElement = imageResolution?.element ?? element;
        const borderWidth = borderWidthClassToPixels(renderElement.borderWidth);
        const resolvedBgUrl = renderElement.backgroundImageUrl ? replacePlaceholdersLocal(renderElement.backgroundImageUrl, dataToRender, isEditorPreview) : '';
        const structuredAppearanceStyle = appearanceToStyle(normalizeAppearanceForElement(renderElement));
        const layerTransform = [
          `rotate(${renderElement.rotation || 0}deg)`,
          renderElement.flipX ? 'scaleX(-1)' : null,
          renderElement.flipY ? 'scaleY(-1)' : null,
        ].filter(Boolean).join(' ');
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: renderElement.x * scaleX,
          top: renderElement.y * scaleY,
          width: renderElement.width * scaleX,
          height: renderElement.height * scaleY,
          transform: layerTransform,
          transformOrigin: 'center',
          opacity: renderElement.opacity ?? 1,
          zIndex: renderElement.zIndex,
          overflow: 'hidden',
          boxSizing: 'border-box',
          color: renderElement.textColor || templateToRender.baseTextColor || undefined,
          backgroundColor: renderElement.backgroundColor || 'transparent',
          borderStyle: borderWidth > 0 ? 'solid' : undefined,
          borderColor: renderElement.borderColor || templateToRender.defaultElementBorderColor || undefined,
          borderRadius: radiusClassToCss(renderElement.borderRadius) || renderElement.borderRadius || undefined,
          ...borderWidthClassToStyle(renderElement.borderWidth),
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

        if (renderElement.type === 'image') {
          const imageUrl = resolveFreeformImageUrl(renderElement, dataToRender, descriptiveArtworkText);
          return (
            <div key={renderElement.id} style={baseStyle} data-freeform-element-id={renderElement.id}>
              <img
                src={imageUrl}
                alt={`Image for ${renderElement.name}`}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  minWidth: 0,
                  minHeight: 0,
                  objectFit: imageResolution?.imageStyle.objectFit || renderElement.imageObjectFit || 'cover',
                  objectPosition: imageResolution?.imageStyle.objectPosition || `${renderElement.imageObjectPositionX || 'center'} ${renderElement.imageObjectPositionY || 'center'}`,
                  transform: imageResolution?.imageStyle.transform,
                  transformOrigin: 'center',
                  borderRadius: 'inherit',
                  display: 'block',
                }}
                data-ai-hint={dataAiHintKeywords}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://placehold.co/${Math.max(80, Math.round(renderElement.width || 300))}x${Math.max(80, Math.round(renderElement.height || 200))}.png?text=${encodeURIComponent(descriptiveArtworkText || 'Image')}`;
                }}
              />
            </div>
          );
        }

        if (element.type === 'icon') {
          const iconImageUrl = element.iconImageSource ? replacePlaceholdersLocal(element.iconImageSource, dataToRender, isEditorPreview) : '';
          if (iconImageUrl && (iconImageUrl.startsWith('http') || iconImageUrl.startsWith('data:') || iconImageUrl.startsWith('/'))) {
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
            ...structuredAppearanceStyle,
          };
          if (elementIsDivider) {
            Object.assign(shapeStyle, {
              backgroundColor: element.fillColor || element.backgroundColor || 'transparent',
              borderColor: element.strokeColor || element.borderColor || undefined,
              borderWidth: element.strokeWidth !== undefined ? element.strokeWidth : baseStyle.borderWidth,
              borderRadius: element.shapeKind === 'capsule' ? '9999px' : baseStyle.borderRadius,
              height: Math.max(1, Number(baseStyle.height) || 0, (element.strokeWidth || 2) * scaleY),
            });
          } else if (canRenderVectorShape(element)) {
            const vectorShapeStyle: React.CSSProperties = {
              ...structuredAppearanceStyle,
              backgroundColor: structuredAppearanceStyle.backgroundColor || element.fillColor || element.backgroundColor || baseStyle.backgroundColor,
              backgroundImage: structuredAppearanceStyle.backgroundImage || baseStyle.backgroundImage,
              backgroundSize: structuredAppearanceStyle.backgroundSize || baseStyle.backgroundSize,
              backgroundRepeat: structuredAppearanceStyle.backgroundRepeat || baseStyle.backgroundRepeat,
              backgroundPosition: structuredAppearanceStyle.backgroundPosition || baseStyle.backgroundPosition,
              backgroundBlendMode: structuredAppearanceStyle.backgroundBlendMode || baseStyle.backgroundBlendMode,
              borderColor: structuredAppearanceStyle.borderColor || element.strokeColor || element.borderColor || baseStyle.borderColor,
              borderWidth: element.strokeWidth !== undefined ? element.strokeWidth : structuredAppearanceStyle.borderWidth || baseStyle.borderWidth,
            };
            Object.assign(shapeStyle, {
              backgroundColor: 'transparent',
              backgroundImage: undefined,
              borderColor: undefined,
              borderWidth: 0,
              borderStyle: 'none',
              borderRadius: undefined,
              boxShadow: undefined,
              overflow: 'visible',
            });
            return (
              <div key={element.id} style={shapeStyle} data-freeform-element-id={element.id}>
                <VectorShapeElement element={element} style={vectorShapeStyle} strokeScale={Math.min(scaleX, scaleY)} />
              </div>
            );
          }
          return <div key={element.id} style={shapeStyle} data-freeform-element-id={element.id} />;
        }

        const textStyle: React.CSSProperties = {
          ...baseStyle,
          ...buildTextElementStyle(element, scaleX),
        };
        const contentStyle: React.CSSProperties = { lineHeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textDecoration: 'inherit', fontStyle: 'inherit' };
        const textContainerStyle = { ...textStyle, fontSize: undefined as unknown as React.CSSProperties['fontSize'] };
        return (
          <div
            key={element.id}
            className={cn(element.padding || 'p-1', element.fontWeight || 'font-normal', element.fontFamily || 'font-sans')}
            style={textContainerStyle}
            data-freeform-element-id={element.id}
          >
            <CardTextContent
              template={templateToRender}
              element={element}
              data={dataToRender}
              scale={scaleX}
              className={cn(element.fontWeight || 'font-normal', element.fontFamily || 'font-sans')}
              style={contentStyle}
              highlightColor={highlightColor}
            />
          </div>
        );
      });
  }, [canvasToRender, cardPixelHeight, dataAiHintKeywords, dataToRender, descriptiveArtworkText, highlightColor, renderWidthPx, isEditorPreview, templateToRender]);

  const isInteractive = !isEditorPreview && (onSelect || onEdit);

  const handleCardClick = () => {
    if (onSelect && !isEditorPreview) {
      onSelect(card);
    }
  };

  const handleCardDoubleClick = () => {
    if (onEdit && !isEditorPreview) {
      onEdit(card);
    }
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  };

  const elementIdSuffix = card.uniqueId;

  return (
    <div
      id={`card-preview-${elementIdSuffix}`}
      className={cn("flex flex-col items-center group relative", className)}
    >
      <div
        style={{
          width: `${effectiveWidthPx}px`,
          height: `${previewLayout.visualHeightPx}px`,
          position: 'relative',
        }}
      >
        <div
          className={cn(
            "tcg-card-preview shadow-lg flex flex-col relative overflow-hidden",
            isInteractive ? 'cursor-pointer hover:shadow-primary/50 hover:shadow-md transition-shadow duration-150' : '',
            `frame-${templateToRender.frameStyle || 'standard'}`
          )}
          style={{
            ...cardContainerStyle,
            transform: visualScale === 1 ? cardContainerStyle.transform : `scale(${visualScale})`,
            transformOrigin: 'top left',
          }}
          data-ai-hint="tcg card custom"
          onClick={handleCardClick}
          onDoubleClick={handleCardDoubleClick}
          onKeyDown={handleCardKeyDown}
          role={isInteractive ? 'button' : undefined}
          tabIndex={isInteractive ? 0 : undefined}
          aria-label={isInteractive ? 'Select generated output. Double-click to edit.' : undefined}
        >
          {freeformElements}
          {borderOverlayStyle ? <div aria-hidden="true" data-card-border-overlay style={borderOverlayStyle} /> : null}
          {interactionOverlay}
        </div>
      </div>
      {showSizeInfo && !isPrintMode && (
        <div className="text-xs text-muted-foreground mt-1">
          {calculatedPrintSize}
        </div>
      )}
    </div>
  );
}