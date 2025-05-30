
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

  const effectiveWidthPx = targetWidthPx || PREVIEW_WIDTH_PX;
  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);
  const cardPixelHeight = (aspectW > 0 && aspectH > 0) ? (effectiveWidthPx / aspectW) * aspectH : (effectiveWidthPx / (63 / 88));

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
    const nameSection = template.rows?.flatMap(r => r.columns).find(s => 
      s.sectionContentType === 'placeholder' && (s.contentPlaceholder || '').toLowerCase().includes('name')
    );
    if (nameSection && data) {
        const resolvedName = replacePlaceholdersLocal(nameSection.contentPlaceholder, data, true);
        if (resolvedName.trim()) return resolvedName.trim().toLowerCase();
    }
    return "card art";
  }, [template, data]);

  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) return false;
    if (hideEmptySections) {
      if (section.sectionContentType === 'image') {
        return !processedContent.trim(); // Hide if image key resolved to empty URL
      }
      // For placeholder type
      const hasTextContent = processedContent.trim() !== '';
      const hasBgImage = !!section.backgroundImageUrl; // Assuming this is a direct URL or placeholder that might resolve
      return !hasTextContent && !hasBgImage;
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
            flexShrink: 0, // Prevent rows from shrinking if content overflows card height
          };
          
          const allColumnsInRowEffectivelyHidden = row.columns.every(col => {
            let colContent = '';
            if (col.sectionContentType === 'image') {
                colContent = isEditorPreview ? col.contentPlaceholder : (data[col.contentPlaceholder] as string || '');
            } else {
                colContent = isEditorPreview ? col.contentPlaceholder : replacePlaceholdersLocal(col.contentPlaceholder, data, true);
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
              {row.columns.map((section, sectionIndex) => {
                const sectionStyle: React.CSSProperties = {
                  position: 'relative',
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  borderColor: section.borderColor || template.defaultSectionBorderColor || undefined,
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  height: section.customHeight || undefined,
                  width: section.customWidth || undefined,
                  overflowWrap: 'break-word', 
                };

                if (section.flexGrow && section.flexGrow > 0) {
                    sectionStyle.minWidth = 0;
                    sectionStyle.minHeight = 0; 
                    sectionStyle.overflowY = 'auto';
                    sectionStyle.flexBasis = '0%';
                } else {
                    sectionStyle.flexShrink = 0; // Non-growing items should not shrink by default
                }
                sectionStyle.flexGrow = section.flexGrow || 0;


                if (section.customWidth) {
                  sectionStyle.width = section.customWidth;
                  sectionStyle.flexBasis = section.customWidth;
                  sectionStyle.flexShrink = 0;
                }

                let sectionBorderClass = '';
                if (section.borderWidth && section.borderWidth !== '_none_') {
                    sectionBorderClass = section.borderWidth;
                }

                if (section.backgroundImageUrl) {
                    const resolvedBgUrl = replacePlaceholdersLocal(section.backgroundImageUrl, data, isEditorPreview);
                    if (resolvedBgUrl && (resolvedBgUrl.startsWith('http') || resolvedBgUrl.startsWith('data:'))) {
                        sectionStyle.backgroundImage = `url(${resolvedBgUrl})`;
                        sectionStyle.backgroundSize = 'cover';
                        sectionStyle.backgroundPosition = 'center';
                    }
                }
                
                const sectionClasses = cn(
                  'relative',
                  section.padding || 'p-1',
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  section.minHeight && section.minHeight !== '_auto_' && !section.customHeight ? section.minHeight : '',
                  sectionBorderClass,
                  'whitespace-pre-wrap break-words',
                  isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : '',
                  isEditorPreview && 'border-l border-r border-foreground/10',
                   (!section.customWidth && ((section.flexGrow && section.flexGrow > 0))) ? 'w-full' : ''
                );

                const handlePreviewSectionClick = (e: React.MouseEvent) => {
                  if (isEditorPreview && onSectionClick) {
                    e.stopPropagation();
                    onSectionClick(section.id);
                  }
                };
                
                // --- New Section Content Type Logic ---
                if (section.sectionContentType === 'image') {
                    const imageKey = section.contentPlaceholder; // This is now just the key name
                    const imageUrl = data && imageKey ? (data[imageKey] as string || '') : '';
                    const displayWidth = parseInt(section.imageWidthPx || '100', 10);
                    const displayHeight = parseInt(section.imageHeightPx || '100', 10);

                    if (isEditorPreview) {
                        return (
                            <div
                                key={section.id}
                                className={cn(sectionClasses, "flex items-center justify-center bg-muted/50 border-dashed border-border overflow-hidden")}
                                style={{
                                    ...sectionStyle,
                                    // Override dimensions specifically for the editor image placeholder box
                                    width: section.imageWidthPx ? `${displayWidth}px` : (section.customWidth || '100%'),
                                    height: section.imageHeightPx ? `${displayHeight}px` : (section.customHeight || '120px'),
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

                    // Generated card preview for image
                    if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:'))) {
                        return (
                            <div
                                key={section.id}
                                className={cn(sectionClasses, section.padding || 'p-0')} // Often no padding for image container
                                style={{
                                    ...sectionStyle,
                                    width: section.imageWidthPx ? `${displayWidth}px` : (section.customWidth || '100%'),
                                    height: section.imageHeightPx ? `${displayHeight}px` : (section.customHeight || 'auto'),
                                    overflow: 'hidden', // Ensure image is contained
                                }}
                                onClick={handlePreviewSectionClick}
                                data-section-id={section.id}
                            >
                                <NextImage
                                    src={imageUrl}
                                    alt={`Image for ${section.contentPlaceholder}`}
                                    width={displayWidth > 0 ? displayWidth : 300} // NextImage requires valid width/height
                                    height={displayHeight > 0 ? displayHeight : 200}
                                    style={{ 
                                      objectFit: 'contain', // Or make this a section prop: section.objectFit || 'contain'
                                      width: '100%', 
                                      height: '100%' 
                                    }}
                                    data-ai-hint={artworkHintValue}
                                    priority={rowIndex === 0 && sectionIndex === 0}
                                />
                            </div>
                        );
                    } else { // Fallback for generated image if URL is invalid/missing
                         return (
                            <div
                                key={section.id}
                                className={cn(sectionClasses, "flex items-center justify-center bg-muted/30 border-dashed border-border/50 text-muted-foreground text-xs")}
                                style={{
                                    ...sectionStyle,
                                    width: section.imageWidthPx ? `${displayWidth}px` : (section.customWidth || '100%'),
                                    height: section.imageHeightPx ? `${displayHeight}px` : (section.customHeight || '120px'),
                                }}
                                onClick={handlePreviewSectionClick}
                                data-section-id={section.id}
                            >
                                Missing/Invalid Image: {imageKey}
                            </div>
                        );
                    }
                } else { // sectionContentType === 'placeholder' (Text content)
                    const processedContentForDisplay = isEditorPreview
                        ? section.contentPlaceholder.replace(/\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g, (match, key) => key)
                        : replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                    
                    if (shouldHideSection(section, processedContentForDisplay) && !isEditorPreview) {
                      return null;
                    }

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
        <div className="text-xs text-muted-foreground mt-1">
          Approx. Print Size: {cardStandardWidthInches}in x {cardStandardHeightInches}in
        </div>
      )}
    </div>
  );
}
