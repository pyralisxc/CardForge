
"use client";

import type { DisplayCard, CardSection, CardData, CardRow } from '@/types';
import NextImage from 'next/image';
import { cn, replacePlaceholdersLocal } from '@/lib/utils';
import { useMemo } from 'react';

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

const PREVIEW_WIDTH_PX = 280; // Default preview width in editor
const PLACEHOLDER_REGEX_EDITOR_PREVIEW_KEY_EXTRACT = /{{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*}}/g;


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
  const { template, data } = card;

  if (!template) return <div className="text-destructive">Error: Template not provided.</div>;
  if (!template.rows) return <div className="text-destructive">Error: Template has no rows.</div>;

  const effectiveWidthPx = targetWidthPx || PREVIEW_WIDTH_PX;
  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);
  const cardPixelHeight = (aspectW > 0 && aspectH > 0) ? (effectiveWidthPx / aspectW) * aspectH : (effectiveWidthPx / (63/88));

  const cardContainerStyle: React.CSSProperties = {
    aspectRatio: (aspectW > 0 && aspectH > 0) ? `${aspectW} / ${aspectH}` : undefined,
    width: isPrintMode ? '100%' : `${effectiveWidthPx}px`,
    height: isPrintMode ? '100%' : (aspectW > 0 && aspectH > 0 ? 'auto' : `${cardPixelHeight}px`),
    boxSizing: 'border-box',
  };

  if (template.frameStyle === 'standard' || template.frameStyle === 'custom') {
    if (template.baseBackgroundColor) cardContainerStyle.backgroundColor = template.baseBackgroundColor;
    if (template.baseTextColor) cardContainerStyle.color = template.baseTextColor;
  }
  if (template.cardBorderColor) cardContainerStyle.borderColor = template.cardBorderColor;
  if (template.cardBorderWidth) cardContainerStyle.borderWidth = template.cardBorderWidth;
  if (template.cardBorderStyle && template.cardBorderStyle !== '_default_' && template.cardBorderStyle !== 'none') {
    cardContainerStyle.borderStyle = template.cardBorderStyle as React.CSSProperties['borderStyle'];
  } else if (template.cardBorderStyle === 'none') {
     cardContainerStyle.borderStyle = 'none';
     cardContainerStyle.borderWidth = '0';
  }
  if (template.cardBorderRadius) cardContainerStyle.borderRadius = template.cardBorderRadius;


  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  const artworkHintValue = useMemo(() => {
    // Try to find a 'TypeLine' or similar section for a hint
    const typeLineSection = template.rows?.flatMap(r => r.columns).find(s => (s.contentPlaceholder || '').toLowerCase().includes('type'));
    if (typeLineSection && data) {
        const resolvedTypeLine = replacePlaceholdersLocal(typeLineSection.contentPlaceholder, data, true);
        if (resolvedTypeLine.trim()) return resolvedTypeLine.trim().split('—')[0].trim().toLowerCase(); // Get first part of type
    }
    return "card art";
  }, [template, data]);

  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) return false; // Always show all sections in editor preview
    if (hideEmptySections) {
      const hasContent = processedContent.trim() !== '';
      const hasBgImage = !!section.backgroundImageUrl;
      return !hasContent && !hasBgImage;
    }
    return false;
  };

  const handleCardClick = () => {
    if (onEdit && !isEditorPreview) {
      onEdit(card);
    }
  };

  return (
    <div className={cn("flex flex-col items-center group", className)}>
      <div
        className={cn(
          "tcg-card-preview shadow-lg flex flex-col relative overflow-hidden",
          isPrintMode ? "card-preview-print" : "",
          `frame-${template.frameStyle || 'standard'}`,
          onEdit && !isEditorPreview ? 'cursor-pointer hover:shadow-primary/50 hover:shadow-md transition-shadow duration-150' : ''
        )}
        style={cardContainerStyle}
        data-ai-hint="tcg card custom"
        onClick={handleCardClick}
      >
        {(template.rows || []).map((row, rowIndex) => {
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

          const allColumnsInRowEffectivelyHidden = row.columns.every(col => {
            const colContent = isEditorPreview
              ? col.contentPlaceholder
              : replacePlaceholdersLocal(col.contentPlaceholder, data, true);
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
              {row.columns.map((section, sectionIndex) => {
                let processedContentForDisplay: string;
                 if (isEditorPreview) {
                    processedContentForDisplay = (section.contentPlaceholder || '').replace(PLACEHOLDER_REGEX_EDITOR_PREVIEW_KEY_EXTRACT, (match, key) => key);
                 } else {
                    processedContentForDisplay = replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                 }

                if (shouldHideSection(section, processedContentForDisplay) && !isEditorPreview) {
                  return null;
                }

                const sectionStyle: React.CSSProperties = {
                  position: 'relative', // Needed for absolute positioning of children or NextImage fill
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  borderColor: section.borderColor || template.defaultSectionBorderColor || undefined,
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word', // Added for aggressive breaking
                };

                if (section.customHeight) sectionStyle.height = section.customHeight;
                if (section.customWidth) {
                    sectionStyle.width = section.customWidth;
                    sectionStyle.flexBasis = section.customWidth;
                    sectionStyle.flexShrink = 0;
                } else {
                    sectionStyle.flexBasis = (section.flexGrow && section.flexGrow > 0) ? '0%' : 'auto';
                    sectionStyle.flexShrink = (section.flexGrow && section.flexGrow > 0) ? 1 : 0;
                }
                if (section.flexGrow && section.flexGrow > 0) {
                    sectionStyle.minWidth = 0;
                    sectionStyle.minHeight = 0; // Allow shrinking below content height for overflow-y
                    sectionStyle.overflowY = 'auto'; // Allow vertical scroll for growing text areas
                }

                let sectionBorderClass = '';
                if (section.borderWidth && section.borderWidth !== '_none_') {
                    sectionBorderClass = section.borderWidth;
                }

                let resolvedBgImageUrl = '';
                if (section.backgroundImageUrl) {
                    resolvedBgImageUrl = replacePlaceholdersLocal(section.backgroundImageUrl, data, isEditorPreview);
                    if (resolvedBgImageUrl && !resolvedBgImageUrl.startsWith('http') && !resolvedBgImageUrl.startsWith('data:')) {
                         // If it's still a placeholder or invalid, don't use
                         resolvedBgImageUrl = '';
                    }
                    if (resolvedBgImageUrl) {
                        sectionStyle.backgroundImage = `url(${resolvedBgImageUrl})`;
                        sectionStyle.backgroundSize = 'cover';
                        sectionStyle.backgroundPosition = 'center';
                    }
                }

                const sectionClasses = cn(
                  'relative', // Ensure relative for NextImage fill or other absolute positioning
                  section.padding || 'p-1',
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  section.minHeight && section.minHeight !== '_auto_' && !section.customHeight ? section.minHeight : '',
                  sectionBorderClass,
                  'whitespace-pre-wrap', // Apply to all text-based sections for newlines
                  // 'break-words', // Handled by inline style for more aggressive breaking
                  isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : '',
                  isEditorPreview && 'border-l border-r border-foreground/10',
                  !section.customWidth && ((section.flexGrow && section.flexGrow > 0)) ? 'w-full' : '' // Simplified w-full logic
                );

                const handlePreviewSectionClick = (e: React.MouseEvent) => {
                  if (isEditorPreview && onSectionClick) {
                    e.stopPropagation();
                    onSectionClick(section.id);
                  }
                };

                // --- Image Handling Logic ---
                let isResolvedAsImage = false;
                let imageSrc = '';
                const resolvedContentForImageCheck = replacePlaceholdersLocal(section.contentPlaceholder, data, false);

                if (resolvedContentForImageCheck && (resolvedContentForImageCheck.startsWith('http://') || resolvedContentForImageCheck.startsWith('https://') || resolvedContentForImageCheck.startsWith('data:image/'))) {
                    isResolvedAsImage = true;
                    imageSrc = resolvedContentForImageCheck;
                }

                if (isEditorPreview && section.contentPlaceholder.toLowerCase().includes('art')) { // Simplified editor preview for "art" placeholders
                    return (
                        <div
                            key={section.id}
                            className={cn(sectionClasses, "flex items-center justify-center bg-muted/50 border-dashed border-border")}
                            style={{
                                ...sectionStyle,
                                height: section.customHeight || '120px',
                                width: section.customWidth || '100%',
                            }}
                            onClick={handlePreviewSectionClick}
                            data-section-id={section.id}
                        >
                            <div className="text-center text-muted-foreground text-xs p-1">
                                <div>{processedContentForDisplay}</div>
                                <div>Size: {section.customWidth || 'auto'} x {section.customHeight || 'auto'}</div>
                            </div>
                        </div>
                    );
                }

                if (isResolvedAsImage && imageSrc) {
                    const imageContainerStyle: React.CSSProperties = {
                        ...sectionStyle,
                        position: 'relative',
                        overflow: 'hidden',
                        height: section.customHeight || sectionStyle.height || 'auto',
                        width: section.customWidth || sectionStyle.width || '100%',
                        padding: section.padding || 'p-0', // Default to no padding for image containers
                    };

                    return (
                        <div
                            key={section.id}
                            className={cn(sectionClasses, section.padding || 'p-0')}
                            style={imageContainerStyle}
                            onClick={handlePreviewSectionClick}
                            data-section-id={section.id}
                        >
                            <NextImage
                                src={imageSrc}
                                alt={processedContentForDisplay || "Card section image"}
                                layout="fill"
                                objectFit="cover"
                                data-ai-hint={artworkHintValue}
                                priority={rowIndex === 0 && sectionIndex === 0}
                            />
                            {/* Render text content on top of background image if content is not an image URL itself */}
                            {section.backgroundImageUrl && section.contentPlaceholder && !isResolvedAsImage && (
                                <div className="relative z-10" style={{color: section.textColor || undefined}}>{processedContentForDisplay}</div>
                            )}
                        </div>
                    );
                }

                // Default: Render as text
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
              })}
            </div>
          );
        })}
      </div>
      {showSizeInfo && !isPrintMode && (
        <div className="text-xs text-muted-foreground mt-1">
          Approx. Print Size: {cardStandardWidthInches}in x {cardStandardHeightInches}in
        </div>
      )}
    </div>
  );
}
