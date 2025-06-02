
"use client";

import type { DisplayCard, CardSection, CardData, CardRow, TCGCardTemplate } from '@/types'; // Ensure TCGCardTemplate is imported
import NextImage from 'next/image';
import { cn, replacePlaceholdersLocal } from '@/lib/utils'; // Removed simplifyRatio, gcd
import { useMemo } from 'react';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { Button } from '@/components/ui/button';

interface CardPreviewProps {
  card: DisplayCard; // This now refers to the simplified DisplayCard
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

  if (templateToRender.frameStyle === 'standard' || templateToRender.frameStyle === 'custom') {
    if (templateToRender.baseBackgroundColor) cardContainerStyle.backgroundColor = templateToRender.baseBackgroundColor;
    if (templateToRender.baseTextColor) cardContainerStyle.color = templateToRender.baseTextColor;
  }

  if (templateToRender.cardBackgroundImageUrl) {
    const resolvedCardBgUrl = replacePlaceholdersLocal(templateToRender.cardBackgroundImageUrl, dataToRender, isEditorPreview);
    if (resolvedCardBgUrl && (resolvedCardBgUrl.startsWith('http') || resolvedCardBgUrl.startsWith('data:'))) {
        cardContainerStyle.backgroundImage = `url(${resolvedCardBgUrl})`;
        cardContainerStyle.backgroundSize = 'cover';
        cardContainerStyle.backgroundPosition = 'center';
    }
  }

  if (templateToRender.cardBorderColor) cardContainerStyle.borderColor = templateToRender.cardBorderColor;
  if (templateToRender.cardBorderWidth) cardContainerStyle.borderWidth = templateToRender.cardBorderWidth;
  if (templateToRender.cardBorderStyle && templateToRender.cardBorderStyle !== '_default_' && templateToRender.cardBorderStyle !== 'none') {
    cardContainerStyle.borderStyle = templateToRender.cardBorderStyle as React.CSSProperties['borderStyle'];
  } else if (templateToRender.cardBorderStyle === 'none') {
     cardContainerStyle.borderStyle = 'none';
     cardContainerStyle.borderWidth = '0';
  }
  if (templateToRender.cardBorderRadius) cardContainerStyle.borderRadius = templateToRender.cardBorderRadius;

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
    let nameValue = 'Artwork'; // Default for placeholder image text
    if (dataToRender) {
      const nameKeys = ['cardName', 'title', 'name'];
      for (const key of nameKeys) {
        const value = dataToRender[key];
        if (value && typeof value === 'string' && value.trim()) {
          nameValue = value.trim(); // Use full name for descriptive placeholder text
          break;
        }
      }
    }
    return nameValue;
  }, [dataToRender]);

  const dataAiHintKeywords = useMemo(() => {
    let baseHint = 'card art'; // Default for data-ai-hint
    if (dataToRender) {
      const nameKeys = ['cardName', 'title', 'name'];
      for (const key of nameKeys) {
        const value = dataToRender[key];
        if (value && typeof value === 'string' && value.trim()) {
          baseHint = value.trim().toLowerCase().split(/\s+/).slice(0, 2).join(' ');
          if (baseHint) break; // Found a name, use its first 1-2 words
        }
      }
    }
    // Ensure if baseHint became empty (e.g. name was only punctuation), it defaults
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

