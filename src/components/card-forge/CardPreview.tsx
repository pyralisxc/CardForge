
"use client";

import type { DisplayCard, CardSection, CardData, CardRow, TCGCardTemplate } from '@/types'; 
import NextImage from 'next/image';
import { cn, replacePlaceholdersLocal } from '@/lib/utils'; 
import { useMemo } from 'react';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { Button } from '@/components/ui/button';

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

// Helper to parse simple pixel values from strings like "10px" or "10"
const parsePixelValue = (value: string | undefined, defaultValue = 0): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(String(value).replace(/px$/, ''), 10);
  return isNaN(parsed) ? defaultValue : parsed;
};


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

  if (!templateToRender) {
    return <div className="text-destructive p-4 text-center">Error: Template not provided for rendering. Card ID: {card.uniqueId}</div>;
  }

  const effectiveWidthPx = targetWidthPx || PREVIEW_WIDTH_PX;
  const [aspectW, aspectH] = (templateToRender.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
  const cardPixelHeight = (aspectW > 0 && aspectH > 0) ? (effectiveWidthPx / aspectW) * aspectH : (effectiveWidthPx / (63 / 88));

  const cardContainerStyle: React.CSSProperties = {
    aspectRatio: (aspectW > 0 && aspectH > 0) ? `${aspectW} / ${aspectH}` : undefined,
    width: `${effectiveWidthPx}px`,
    height: (aspectW > 0 && aspectH > 0 ? 'auto' : `${cardPixelHeight}px`),
    boxSizing: 'border-box',
  };

  const tb = templateToRender; 
  const isStandardOrCustomFrame = tb.frameStyle === 'standard' || tb.frameStyle === 'custom';
  
  const resolvedCardBorderImageSource = tb.cardBorderImageSource ? replacePlaceholdersLocal(tb.cardBorderImageSource, dataToRender, isEditorPreview) : undefined;
  const useBorderImageMask = isStandardOrCustomFrame && resolvedCardBorderImageSource && 
                             !resolvedCardBorderImageSource.toLowerCase().includes('gradient(') && 
                             !resolvedCardBorderImageSource.startsWith("CSS:");

  if (useBorderImageMask) {
    const borderWidthNum = parsePixelValue(tb.cardBorderWidth, 0);
    // For SVG rx/ry, we need to parse radius. This is a simplification.
    // A robust solution would handle 'rem', '%', etc., possibly with getComputedStyle.
    const borderRadiusNum = parsePixelValue(tb.cardBorderRadius, 0);

    // viewBox will be the size of the card for simplicity in mask coordinates
    const svgViewBoxWidth = 100; // Using a percentage-like viewBox
    const svgViewBoxHeight = 100;
    
    // Convert CSS radius and width to SVG viewport units
    // This scaling is approximate and assumes radius/width are relative to card size
    // A more accurate scaling would involve the actual card pixel dimensions.
    const svgRx = (borderRadiusNum / effectiveWidthPx) * svgViewBoxWidth;
    const svgRy = (borderRadiusNum / cardPixelHeight) * svgViewBoxHeight; // Approximate
    const svgStrokeWidth = (borderWidthNum / effectiveWidthPx) * svgViewBoxWidth; // Approximate


    // Create an SVG mask: a white border on a black background (for luminance mask)
    // or a path that only draws the border (for alpha mask)
    // Using alpha mask for simplicity: draw a hollow rounded rectangle.
    const svgMaskString = `
      <svg width="${svgViewBoxWidth}" height="${svgViewBoxHeight}" viewBox="0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="borderMask-${card.uniqueId}">
            <rect width="100%" height="100%" fill="white" rx="${svgRx}" ry="${svgRy}"/>
            <rect 
              x="${svgStrokeWidth / 2}" 
              y="${svgStrokeWidth / 2}" 
              width="${svgViewBoxWidth - svgStrokeWidth}" 
              height="${svgViewBoxHeight - svgStrokeWidth}" 
              fill="black" 
              rx="${Math.max(0, svgRx - svgStrokeWidth / 2)}" 
              ry="${Math.max(0, svgRy - svgStrokeWidth / 2)}"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="white" mask="url(#borderMask-${card.uniqueId})"/>
      </svg>
    `.replace(/\s\s+/g, ' ').trim(); // Minify SVG string slightly

    const svgDataUri = `data:image/svg+xml;base64,${btoa(svgMaskString)}`;

    cardContainerStyle.backgroundImage = `url(${resolvedCardBorderImageSource})`;
    cardContainerStyle.backgroundSize = 'cover'; // Or other desired size
    cardContainerStyle.backgroundPosition = 'center';
    cardContainerStyle.maskImage = `url("${svgDataUri}")`;
    cardContainerStyle.WebkitMaskImage = `url("${svgDataUri}")`; // For Safari/older Chrome
    cardContainerStyle.maskSize = '100% 100%';
    cardContainerStyle.maskRepeat = 'no-repeat';
    // cardContainerStyle.maskMode = 'alpha'; // Not always needed if SVG mask is drawn correctly for alpha
    
    // No actual CSS border needed when using this mask technique for the border visual
    cardContainerStyle.border = 'none';
    // Radius is handled by the mask's shape and the clipping of the element itself
    if (tb.cardBorderRadius) cardContainerStyle.borderRadius = tb.cardBorderRadius;


  } else { // Original border logic
    const userHasProvidedBorderImageCSSOrURL = resolvedCardBorderImageSource && !resolvedCardBorderImageSource.startsWith("CSS:");
    const isCSSDrivenBorderImage = resolvedCardBorderImageSource && resolvedCardBorderImageSource.startsWith("CSS:");

    const effectiveBorderWidthStr = tb.cardBorderWidth || '0px';
    const borderWidthMatch = effectiveBorderWidthStr.match(/^(\d+(\.\d+)?)/);
    const effectiveBorderWidthNum = borderWidthMatch ? parseFloat(borderWidthMatch[1]) : 0;
    const unitMatch = effectiveBorderWidthStr.match(/[a-zA-Z%]+$/);
    const effectiveBorderWidthUnit = unitMatch ? unitMatch[0] : 'px';
    const finalEffectiveBorderWidthForShadow = `${effectiveBorderWidthNum}${effectiveBorderWidthUnit}`;
    const solidBorderColorForShadow = tb.cardBorderColor || 'hsl(var(--border))';

    if (isStandardOrCustomFrame && !userHasProvidedBorderImageCSSOrURL && !isCSSDrivenBorderImage && effectiveBorderWidthNum > 0) {
        cardContainerStyle.boxShadow = `0 0 0 ${finalEffectiveBorderWidthForShadow} ${solidBorderColorForShadow}`;
        cardContainerStyle.borderWidth = tb.cardBorderWidth; 
        cardContainerStyle.borderStyle = (tb.cardBorderStyle && tb.cardBorderStyle !== '_default_' && tb.cardBorderStyle !== 'none')
                                          ? tb.cardBorderStyle as React.CSSProperties['borderStyle']
                                          : 'solid';
        cardContainerStyle.borderColor = 'transparent';
    } else if (userHasProvidedBorderImageCSSOrURL && !isCSSDrivenBorderImage) {
        cardContainerStyle.borderImageSource = String(resolvedCardBorderImageSource).toLowerCase().includes('gradient(')
          ? resolvedCardBorderImageSource
          : `url(${resolvedCardBorderImageSource})`;
        
        const parsedBorderWidthForSlice = parsePixelValue(String(tb.cardBorderWidth || '4px'), 1);
        cardContainerStyle.borderImageSlice = parsedBorderWidthForSlice > 0 ? parsedBorderWidthForSlice : 1;

        cardContainerStyle.borderColor = 'transparent'; 
        cardContainerStyle.borderWidth = tb.cardBorderWidth || '4px';
        cardContainerStyle.borderStyle = (tb.cardBorderStyle && tb.cardBorderStyle !== '_default_' && tb.cardBorderStyle !== 'none')
                                          ? tb.cardBorderStyle as React.CSSProperties['borderStyle']
                                          : 'solid';
    } else {
        // Predefined CSS frames OR Standard/Custom with no border width/image, or CSS-driven image.
        if (tb.cardBorderColor) cardContainerStyle.borderColor = tb.cardBorderColor;
        if (tb.cardBorderWidth) cardContainerStyle.borderWidth = tb.cardBorderWidth;

        if (tb.cardBorderStyle && tb.cardBorderStyle !== '_default_' && tb.cardBorderStyle !== 'none') {
            cardContainerStyle.borderStyle = tb.cardBorderStyle as React.CSSProperties['borderStyle'];
        } else if (tb.cardBorderStyle === 'none' || effectiveBorderWidthNum === 0) {
            cardContainerStyle.borderStyle = 'none';
            cardContainerStyle.borderWidth = '0';
        } else {
            cardContainerStyle.borderStyle = 'solid'; 
        }
    }
    if (tb.cardBorderRadius) cardContainerStyle.borderRadius = tb.cardBorderRadius;
  }
  
  // Background color and non-border-image background image logic
  if (isStandardOrCustomFrame) { // Apply base colors only if not using the mask for border image
    if (tb.baseBackgroundColor && !useBorderImageMask) cardContainerStyle.backgroundColor = tb.baseBackgroundColor;
    // Text color is always applied if set
    if (tb.baseTextColor) cardContainerStyle.color = tb.baseTextColor;
  }
  
  // Apply card's own background image if not using masking for border, or if it's a different image
  if (tb.cardBackgroundImageUrl && !useBorderImageMask) {
    const resolvedCardBgUrl = replacePlaceholdersLocal(tb.cardBackgroundImageUrl, dataToRender, isEditorPreview);
    if (resolvedCardBgUrl && (resolvedCardBgUrl.startsWith('http') || resolvedCardBgUrl.startsWith('data:'))) {
        cardContainerStyle.backgroundImage = `url(${resolvedCardBgUrl})`;
        // Keep existing backgroundSize and backgroundPosition if mask is used for border and source is same
        if (!(useBorderImageMask && resolvedCardBgUrl === resolvedCardBorderImageSource)) {
            cardContainerStyle.backgroundSize = 'cover';
            cardContainerStyle.backgroundPosition = 'center';
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

    const calculatedHeightMm = (STANDARD_TCG_WIDTH_MM / ratioW) * ratioH;
    const widthInches = (STANDARD_TCG_WIDTH_MM * MM_TO_INCHES).toFixed(1);
    const heightInches = (calculatedHeightMm * MM_TO_INCHES).toFixed(1);
    return `Approx. Print Size: ${widthInches}in x ${heightInches}in`;
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
        {(templateToRender.rows || []).map((row, rowIndex) => {
          const handlePreviewRowClick = (e: React.MouseEvent) => {
            if (isEditorPreview && onRowClick) {
              e.stopPropagation();
              onRowClick(row.id);
            }
          };

          let rowEffectiveHeight: string | undefined = row.customHeight || undefined;
          if (row.customHeight && row.customHeight.includes('%') && !isPrintMode && cardPixelHeight > 0 && isFinite(cardPixelHeight)) {
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
            zIndex: 1 // Ensure rows are above the card's masked background
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
                  sectionStyle.width = section.customWidth;
                  sectionStyle.flexBasis = section.customWidth;
                  sectionStyle.flexShrink = 0;
                } else {
                  sectionStyle.flexBasis = (section.flexGrow && section.flexGrow > 0) ? '0%' : 'auto';
                  sectionStyle.flexShrink = (section.flexGrow && section.flexGrow > 0) ? 1 : 0;
                }
                sectionStyle.flexGrow = section.flexGrow || 0;


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
                   (!section.customWidth && ((section.flexGrow && section.flexGrow > 0) || (row.columns || []).length === 1 )) ? 'w-full' : ''
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
                    const displayWidth = parseInt(section.imageWidthPx || '100', 10);
                    const displayHeight = parseInt(section.imageHeightPx || '100', 10);

                    if (isEditorPreview) {
                        return (
                            <div
                                key={section.id}
                                className={cn(sectionClasses, "flex items-center justify-center bg-muted/50 border-dashed border-border overflow-hidden")}
                                style={{
                                    ...sectionStyle,
                                    width: section.imageWidthPx ? `${displayWidth}px` : (section.customWidth || '100%'),
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
                                width: section.imageWidthPx ? `${displayWidth}px` : (section.customWidth || '100%'),
                                height: section.imageHeightPx ? `${displayHeight}px` : (section.customHeight || 'auto'),
                                overflow: 'hidden',
                                borderRadius: section.borderRadius || undefined,
                            }}
                            onClick={handlePreviewSectionClick}
                            data-section-id={section.id}
                        >
                            <NextImage
                                src={imageUrl}
                                alt={`Image for ${section.contentPlaceholder}`}
                                width={displayWidth > 0 ? displayWidth : 300}
                                height={displayHeight > 0 ? displayHeight : 200}
                                style={{
                                  objectFit: 'contain',
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: section.borderRadius || undefined,
                                }}
                                data-ai-hint={dataAiHintKeywords}
                                priority={rowIndex === 0 && sectionIndex === 0}
                            />
                        </div>
                    );

                } else {
                    const Tag = (processedContentForDisplay.includes('\n') && !isEditorPreview) ? 'pre' : 'div';
                    return (
                      <Tag
                        key={section.id}
                        className={sectionClasses}
                        style={sectionStyle}
                        onClick={handlePreviewSectionClick}
                        data-section-id={section.id}
                      >
                        {processedContentForDisplay}
                      </Tag>
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
