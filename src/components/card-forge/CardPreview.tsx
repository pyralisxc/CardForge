
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
}

const PREVIEW_WIDTH_PX = 280;

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
}: CardPreviewProps) {
  const { template, data } = card;

  if (!template) return <div className="text-destructive">Error: Template not provided to CardPreview.</div>;
  if (!template.rows) return <div className="text-destructive">Error: Template has no rows defined.</div>;

  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);
  const cardPixelHeight = (aspectW > 0 && aspectH > 0) ? (PREVIEW_WIDTH_PX / aspectW) * aspectH : 390;

  const cardContainerStyle: React.CSSProperties = {
    aspectRatio: (aspectW > 0 && aspectH > 0) ? `${aspectW} / ${aspectH}` : undefined,
    width: isPrintMode ? '100%' : `${PREVIEW_WIDTH_PX}px`,
    height: isPrintMode ? '100%' : (aspectW > 0 && aspectH > 0 ? 'auto' : `${cardPixelHeight}px`),
    boxSizing: 'border-box',
  };

  if (template.frameStyle === 'standard' || template.frameStyle === 'custom') {
    if (template.baseBackgroundColor) {
      cardContainerStyle.backgroundColor = template.baseBackgroundColor;
    }
    if (template.baseTextColor) {
      cardContainerStyle.color = template.baseTextColor;
    }
  }
  
  if (template.cardBorderColor) cardContainerStyle.borderColor = template.cardBorderColor;
  if (template.cardBorderWidth) cardContainerStyle.borderWidth = template.cardBorderWidth;
  if (template.cardBorderStyle && template.cardBorderStyle !== 'none') {
    cardContainerStyle.borderStyle = template.cardBorderStyle;
  } else if (template.cardBorderStyle === 'none') {
    // cardContainerStyle.borderStyle = 'none'; // This can be problematic if width is still set
    cardContainerStyle.borderWidth = '0'; // Better to set width to 0 for no border
  }
  if (template.cardBorderRadius) cardContainerStyle.borderRadius = template.cardBorderRadius;


  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  const artworkHintValue = useMemo(() => {
    let hint = "card art";
    if (template.rows) {
      const typeLineSection = template.rows
        .flatMap(row => row.columns)
        .find(section => section.type === 'TypeLine');
      if (typeLineSection && typeLineSection.contentPlaceholder) {
        const typeLineText = replacePlaceholdersLocal(typeLineSection.contentPlaceholder, data, false).toLowerCase();
        if (typeLineText.includes("creature")) hint = "fantasy creature";
        else if (typeLineText.includes("spell") || typeLineText.includes("instant") || typeLineText.includes("sorcery")) hint = "spell effect";
        else if (typeLineText.includes("item") || typeLineText.includes("artifact") || typeLineText.includes("equipment")) hint = "fantasy item";
        else if (typeLineText.includes("land") || typeLineText.includes("location")) hint = "fantasy landscape";
      }
    }
    return hint;
  }, [template, data]);


  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) {
      return false; // Never hide sections in editor preview
    }
    if (hideEmptySections) {
      if (section.type === 'Artwork' || section.type === 'Divider') return false; // Artwork and Dividers have their own visibility logic
      return processedContent.trim() === '';
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
          
          const allColumnsInRowHidden = row.columns.every(col => {
             const colContent = isEditorPreview ? col.contentPlaceholder : replacePlaceholdersLocal(col.contentPlaceholder, data, true);
             return shouldHideSection(col, colContent);
          });

          if (allColumnsInRowHidden && hideEmptySections && !isEditorPreview) {
            return null;
          }


          let rowEffectiveHeight: string | undefined = undefined;
          if (row.customHeight && !isPrintMode) {
            if (row.customHeight.includes('%') && cardPixelHeight > 0 && isFinite(cardPixelHeight)) {
              const percentageValue = parseFloat(row.customHeight.replace('%', ''));
              if (!isNaN(percentageValue) && isFinite(percentageValue)) {
                rowEffectiveHeight = `${cardPixelHeight * (percentageValue / 100)}px`;
              }
            } else if (row.customHeight !== 'auto' && row.customHeight.trim() !== '') {
              rowEffectiveHeight = row.customHeight;
            }
          }

          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: row.alignItems || 'flex-start',
            height: rowEffectiveHeight,
            flexShrink: 0, // Important for rows to maintain their height
          };

          return (
            <div
              key={row.id}
              className={cn(
                "flex",
                isEditorPreview && onRowClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-500/70' : ''
              )}
              style={rowStyle}
              onClick={handlePreviewRowClick}
              data-row-id={row.id}
            >
              {row.columns.map((section, sectionIndex) => {
                
                let processedContentForDisplay: string;

                if (isEditorPreview && section.type !== 'Artwork' && section.type !== 'Divider') {
                  // For the editor preview of text sections, directly use the contentPlaceholder string
                  processedContentForDisplay = section.contentPlaceholder;
                } else if (!isEditorPreview) {
                  // For actual card rendering, replace placeholders with real data
                  processedContentForDisplay = replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                } else {
                  // For Artwork/Divider in editor preview, or if somehow reached here
                  processedContentForDisplay = section.contentPlaceholder; 
                }
                
                // For hiding check, use the same logic as display for consistency in editor mode
                const contentForHidingCheck = isEditorPreview ? section.contentPlaceholder : processedContentForDisplay;


                if (shouldHideSection(section, contentForHidingCheck) && !isEditorPreview) {
                  return null;
                }

                const sectionStyle: React.CSSProperties = {
                  position: 'relative', 
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  flexGrow: section.flexGrow || 0,
                  flexShrink: (section.flexGrow && section.flexGrow > 0) ? 1 : 0,
                  flexBasis: (section.flexGrow && section.flexGrow > 0) ? '0%' : 'auto',
                  height: section.customHeight || undefined,
                  width: section.customWidth || undefined,
                  overflowWrap: 'break-word', 
                };
                
                if (section.flexGrow && section.flexGrow > 0) {
                    sectionStyle.minWidth = 0; 
                    sectionStyle.minHeight = 0; 
                    if (section.type !== 'Artwork') { 
                        sectionStyle.overflowY = 'auto';
                    }
                }

                if (section.borderColor) {
                  sectionStyle.borderColor = section.borderColor;
                } else if (section.borderWidth && section.borderWidth !== '_none_' && template.defaultSectionBorderColor) {
                  sectionStyle.borderColor = template.defaultSectionBorderColor;
                } else if (section.borderWidth && section.borderWidth !== '_none_') {
                  sectionStyle.borderColor = 'hsl(var(--border))'; 
                }
                
                let sectionBorderClass = '';
                if (section.borderWidth && section.borderWidth !== '_none_') {
                    sectionBorderClass = section.borderWidth; 
                    sectionStyle.borderStyle = sectionStyle.borderStyle || 'solid'; 
                }


                const sectionClasses = cn(
                  'relative', 
                  section.padding || (section.type === 'Artwork' ? 'p-0' : 'p-1'),
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  (section.minHeight && section.minHeight !== '_auto_') ? section.minHeight : '',
                  sectionBorderClass,
                  (section.type !== 'Artwork' && section.type !== 'Divider') ? 'whitespace-pre-wrap break-words' : '',
                  `tcg-section-${section.type.toLowerCase()}`,
                  isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : ''
                );

                const handlePreviewSectionClick = (e: React.MouseEvent) => {
                  if (isEditorPreview && onSectionClick) {
                    e.stopPropagation();
                    onSectionClick(section.id);
                  }
                };

                if (section.type === 'Artwork') {
                  if (isEditorPreview) {
                    const editorArtStyle: React.CSSProperties = {
                      ...sectionStyle, 
                      height: section.customHeight || (section.minHeight && section.minHeight.includes('px') ? section.minHeight : '120px'), 
                      width: section.customWidth || '100%',
                      backgroundColor: 'hsl(var(--muted) / 0.5)',
                      border: '1px dashed hsl(var(--border))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      color: 'hsl(var(--muted-foreground))',
                      boxSizing: 'border-box',
                    };
                    return (
                      <div
                        key={section.id}
                        className={cn(sectionClasses, section.minHeight && section.minHeight !== '_auto_' ? section.minHeight : '')}
                        style={editorArtStyle}
                        onClick={handlePreviewSectionClick}
                        data-section-id={section.id}
                      >
                        <div>Size: {editorArtStyle.width} x {editorArtStyle.height}</div>
                      </div>
                    );
                  } else { 
                    let artworkDisplaySrc = replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                    if (!artworkDisplaySrc || 
                        (!artworkDisplaySrc.startsWith('http://') && 
                         !artworkDisplaySrc.startsWith('https://') && 
                         !artworkDisplaySrc.startsWith('data:'))) {
                      const cardNameForPlaceholder = replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data, false) || template.name || "Card";
                      artworkDisplaySrc = `https://placehold.co/600x400.png?text=${encodeURIComponent(cardNameForPlaceholder + ' Art')}`;
                    }

                    const imageIsPriority = rowIndex === 0 && sectionIndex === 0;
                    const imageContainerStyle: React.CSSProperties = {
                        ...sectionStyle,
                        position: 'relative', 
                        height: section.customHeight || '100%', 
                        width: section.customWidth || '100%',   
                        overflow: 'hidden', 
                    };
                    if (section.customHeight) delete imageContainerStyle.minHeight;
                    if (section.customWidth) delete imageContainerStyle.minWidth;


                    return (
                      <div
                        key={section.id}
                        className={cn(sectionClasses)}
                        style={imageContainerStyle}
                        onClick={handlePreviewSectionClick}
                        data-section-id={section.id}
                      >
                        <NextImage
                          src={artworkDisplaySrc}
                          alt={replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data, false) || "Card artwork"}
                          layout="fill"
                          objectFit="cover"
                          data-ai-hint={artworkHintValue}
                          priority={imageIsPriority}
                        />
                      </div>
                    );
                  }
                }

                if (section.type === 'Divider') {
                  const dividerStyle: React.CSSProperties = {
                    ...sectionStyle,
                     height: section.customHeight || '1px',
                     backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.defaultSectionBorderColor || 'hsl(var(--border))',
                     width: section.customWidth || 'auto', 
                     flexGrow: section.flexGrow || 0, 
                     margin: section.padding?.includes('m') ? undefined : '0.25rem 0.5rem', 
                  };
                   if (section.padding?.includes('m')) { 
                     dividerStyle.margin = undefined; 
                  }
                  if (dividerStyle.width === 'auto' && !(section.flexGrow && section.flexGrow > 0)) {
                     dividerStyle.alignSelf = 'stretch'; 
                  }

                  return (
                    <div
                      key={section.id}
                      className={cn("tcg-section-divider", sectionClasses)}
                      style={dividerStyle}
                      onClick={handlePreviewSectionClick}
                      data-section-id={section.id}
                    ></div>
                  );
                }
                
                const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';
                
                return (
                  <Tag
                    key={section.id}
                    className={cn(sectionClasses)}
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

    