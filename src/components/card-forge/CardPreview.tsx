
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
    cardContainerStyle.borderStyle = template.cardBorderStyle;
  } else if (template.cardBorderStyle === 'none') {
     cardContainerStyle.borderStyle = 'none';
     cardContainerStyle.borderWidth = '0';
  }
  if (template.cardBorderRadius) cardContainerStyle.borderRadius = template.cardBorderRadius;


  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  const artworkHintValue = useMemo(() => { // General hint, as specific types are gone
    return "card art";
  }, []);

  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) return false; // Always show all sections in editor preview
    if (hideEmptySections) {
      // Hide if content is empty, unless it's an image section with a background or a divider
      const hasContent = processedContent.trim() !== '';
      const hasBgImage = !!section.backgroundImageUrl; // Check if it has a background image config
      // Don't hide if it has content OR a background image (as it's visually present)
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

          const allColumnsInRowEffectivelyHidden = row.columns.every(col => {
             let colContentForHidingCheck: string;
             if (isEditorPreview) {
                colContentForHidingCheck = col.contentPlaceholder.replace(PLACEHOLDER_REGEX_EDITOR_PREVIEW_KEY_EXTRACT, '$1');
             } else {
                colContentForHidingCheck = replacePlaceholdersLocal(col.contentPlaceholder, data, true);
             }
             return shouldHideSection(col, colContentForHidingCheck);
          });

          if (allColumnsInRowEffectivelyHidden && hideEmptySections && !isEditorPreview) {
            return null;
          }

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
            flexShrink: 0, // Prevent rows from shrinking if card content overflows
          };

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
                  // Show just the key part of the placeholder in editor preview
                  processedContentForDisplay = section.contentPlaceholder.replace(PLACEHOLDER_REGEX_EDITOR_PREVIEW_KEY_EXTRACT, (match, key) => key);
                } else {
                  processedContentForDisplay = replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                }
                
                const contentForHidingCheck = processedContentForDisplay;

                if (shouldHideSection(section, contentForHidingCheck) && !isEditorPreview) {
                  return null;
                }
                
                const sectionStyle: React.CSSProperties = {
                  position: 'relative',
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  borderColor: section.borderColor || template.defaultSectionBorderColor || undefined,
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  overflowWrap: 'break-word',
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
                    sectionStyle.minHeight = 0;
                    sectionStyle.overflowY = 'auto';
                }

                let sectionBorderClass = '';
                if (section.borderWidth && section.borderWidth !== '_none_') {
                    sectionBorderClass = section.borderWidth;
                }
                
                let resolvedBackgroundImageUrl = '';
                if (section.backgroundImageUrl) {
                    resolvedBackgroundImageUrl = isEditorPreview 
                        ? (section.backgroundImageUrl.startsWith('{{') ? 'url(https://placehold.co/100x100/eee/ccc?text=BG)' : `url(${section.backgroundImageUrl})`)
                        : `url(${replacePlaceholdersLocal(section.backgroundImageUrl, data, false)})`;
                    if (resolvedBackgroundImageUrl.includes('{{')) { // If still a placeholder after replacement
                        resolvedBackgroundImageUrl = 'url(https://placehold.co/100x100/eee/ccc?text=BG)';
                    }
                     sectionStyle.backgroundImage = resolvedBackgroundImageUrl;
                     sectionStyle.backgroundSize = 'cover'; // Common default
                     sectionStyle.backgroundPosition = 'center'; // Common default
                }


                const sectionClasses = cn(
                  'relative',
                  section.padding || 'p-1',
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  (section.minHeight && section.minHeight !== '_auto_' && !section.customHeight) ? section.minHeight : '',
                  sectionBorderClass,
                  'whitespace-pre-wrap break-words', // Apply to all text-based sections
                  isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : '',
                  isEditorPreview && 'border-l border-r border-foreground/10', // Subtle persistent border in editor
                  !section.customWidth && ((section.flexGrow && section.flexGrow > 0) || ['CardName', 'TypeLine', 'RulesText', 'FlavorText', 'CustomText'].includes(section.contentPlaceholder)) ? 'w-full' : ''
                );

                const handlePreviewSectionClick = (e: React.MouseEvent) => {
                  if (isEditorPreview && onSectionClick) {
                    e.stopPropagation();
                    onSectionClick(section.id);
                  }
                };

                // --- New Image Handling Logic ---
                let isResolvedAsImage = false;
                let imageSrc = '';
                if (!isEditorPreview) {
                    const resolvedContent = replacePlaceholdersLocal(section.contentPlaceholder, data, false);
                    if (resolvedContent && (resolvedContent.startsWith('http://') || resolvedContent.startsWith('https://') || resolvedContent.startsWith('data:image/'))) {
                        isResolvedAsImage = true;
                        imageSrc = resolvedContent;
                    } else if (resolvedContent && resolvedContent.trim() !== '' && (section.contentPlaceholder.toLowerCase().includes('art') || section.contentPlaceholder.toLowerCase().includes('image'))) {
                        // Fallback to placeholder if it's an art field but not a valid URL
                        imageSrc = `https://placehold.co/600x400.png?text=${encodeURIComponent(template.name + " Art")}`;
                        isResolvedAsImage = true;
                    }
                } else { // Editor Preview: special handling for potential image sections
                    if (section.contentPlaceholder.toLowerCase().includes('art') || section.contentPlaceholder.toLowerCase().includes('image')) {
                        // Render a grey box for artwork placeholders in editor
                        return (
                            <div
                                key={section.id}
                                className={cn(sectionClasses, "flex items-center justify-center bg-muted/50 border-dashed border-border")}
                                style={{
                                    ...sectionStyle,
                                    height: section.customHeight || '120px', // Default height for art in editor
                                    width: section.customWidth || '100%',
                                }}
                                onClick={handlePreviewSectionClick}
                                data-section-id={section.id}
                            >
                                <div className="text-center text-muted-foreground text-xs p-1">
                                    <div>{section.contentPlaceholder.replace(PLACEHOLDER_REGEX_EDITOR_PREVIEW_KEY_EXTRACT, (match, key) => key)}</div>
                                    <div>(Image Area)</div>
                                    <div>{section.customWidth || '100%'} x {section.customHeight || '120px'}</div>
                                </div>
                            </div>
                        );
                    }
                }
                
                if (isResolvedAsImage && imageSrc) {
                    const imageContainerStyle: React.CSSProperties = {
                        ...sectionStyle, // Inherit text styles for alt or if image fails, and background
                        position: 'relative', // For NextImage layout="fill"
                        overflow: 'hidden',
                        // Explicitly use customHeight/Width if set, otherwise let flexbox or minHeight decide
                        height: section.customHeight || sectionStyle.height || (section.minHeight && section.minHeight !== '_auto_' ? undefined : 'auto'), // Let Tailwind minHeight work if customHeight is not set
                        width: section.customWidth || sectionStyle.width || '100%', // Default to full width if not specified
                    };
                     // Remove minHeight class if customHeight is set to avoid conflict
                    const finalSectionClasses = section.customHeight ? sectionClasses.replace(/min-h-\[[^\]]+\]/g, '') : sectionClasses;

                    return (
                        <div
                            key={section.id}
                            className={cn(finalSectionClasses, section.padding || 'p-0')} // Ensure padding is p-0 for images unless specified
                            style={imageContainerStyle}
                            onClick={handlePreviewSectionClick}
                            data-section-id={section.id}
                        >
                            <NextImage
                                src={imageSrc}
                                alt={replacePlaceholdersLocal(section.contentPlaceholder, data, false) || "Card section image"}
                                layout="fill"
                                objectFit="cover" // Or "contain", could be a prop
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

                // Default: Render as text (either actual text or placeholder key in editor)
                // Apply background image to this div if specified, and text on top
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
