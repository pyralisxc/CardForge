
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

const PREVIEW_WIDTH_PX = 280; // Width of the preview card on screen

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
  const cardPixelHeight = (aspectW > 0 && aspectH > 0) ? (PREVIEW_WIDTH_PX / aspectW) * aspectH : 390; // Approx height for 63:88 at 280px width

  const cardContainerStyle: React.CSSProperties = {
    aspectRatio: (aspectW > 0 && aspectH > 0) ? `${aspectW} / ${aspectH}` : undefined,
    width: isPrintMode ? '100%' : `${PREVIEW_WIDTH_PX}px`,
    height: isPrintMode ? '100%' : (aspectW > 0 && aspectH > 0 ? 'auto' : `${cardPixelHeight}px`),
    boxSizing: 'border-box',
  };
  
  // Apply base colors only for 'standard' or 'custom' frames
  if (template.frameStyle === 'standard' || template.frameStyle === 'custom') {
    if (template.baseBackgroundColor) {
      cardContainerStyle.backgroundColor = template.baseBackgroundColor;
    }
    if (template.baseTextColor) {
      cardContainerStyle.color = template.baseTextColor;
    }
  }
  // Note: Other frame styles ('classic-gold', etc.) will have their background/text colors defined by CSS.

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
      // In editor preview, don't hide sections based on content, only by explicit settings if we add them later.
      return false; 
    }
    if (hideEmptySections) {
      if (section.type === 'Artwork' || section.type === 'Divider') return false; // Never hide artwork or dividers based on content
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
             let colContentForHidingCheck: string;
             if (isEditorPreview && col.type !== 'Artwork' && col.type !== 'Divider') {
                // For editor, check the raw placeholder to decide if it's "empty" for hiding purposes
                colContentForHidingCheck = col.contentPlaceholder;
             } else if (col.type === 'Artwork') {
                colContentForHidingCheck = "artwork_placeholder"; // Artwork is never "empty" for hiding
             } else if (col.type === 'Divider') {
                colContentForHidingCheck = "divider_placeholder"; // Dividers are never "empty"
             } else {
                colContentForHidingCheck = replacePlaceholdersLocal(col.contentPlaceholder, data, true);
             }
             return shouldHideSection(col, colContentForHidingCheck);
          });

          if (allColumnsInRowHidden && hideEmptySections && !isEditorPreview) {
            return null;
          }

          // Calculate effective row height, considering percentages relative to card height
          let rowEffectiveHeight: string | undefined = undefined;
          if (row.customHeight && !isPrintMode) { // Percentages don't make sense in fixed-size print mode as easily
            if (row.customHeight.includes('%') && cardPixelHeight > 0 && isFinite(cardPixelHeight)) {
              const percentageValue = parseFloat(row.customHeight.replace('%', ''));
              if (!isNaN(percentageValue) && isFinite(percentageValue)) {
                rowEffectiveHeight = `${cardPixelHeight * (percentageValue / 100)}px`;
              }
            } else if (row.customHeight.trim() !== '' && row.customHeight !== 'auto') {
              rowEffectiveHeight = row.customHeight;
            }
          }

          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: row.alignItems || 'flex-start',
            height: rowEffectiveHeight, // Apply calculated or direct height
            flexShrink: 0, // Prevent rows from shrinking if content overflows card
          };

          return (
            <div
              key={row.id}
              className={cn(
                "flex w-full", // Ensure rows take full width
                isEditorPreview && onRowClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-500/70' : ''
              )}
              style={rowStyle}
              onClick={handlePreviewRowClick}
              data-row-id={row.id}
            >
              {row.columns.map((section, sectionIndex) => {
                
                let processedContentForDisplay: string;
                if (isEditorPreview && section.type !== 'Artwork' && section.type !== 'Divider') {
                  processedContentForDisplay = section.contentPlaceholder; // Show raw placeholder in editor
                } else if (isEditorPreview && (section.type === 'Artwork' || section.type === 'Divider')) {
                  // For artwork/divider editor placeholders, they are handled differently below
                  processedContentForDisplay = section.contentPlaceholder; // Keep for artwork editor box text
                }
                 else {
                  // For actual card preview (not editor)
                  processedContentForDisplay = replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                }
                
                // Decide if section should be hidden (for non-editor previews)
                const contentForHidingCheck = (isEditorPreview && section.type !== 'Artwork' && section.type !== 'Divider') 
                                              ? section.contentPlaceholder // In editor, check raw placeholder
                                              : processedContentForDisplay;

                if (shouldHideSection(section, contentForHidingCheck) && !isEditorPreview) {
                  return null;
                }

                const sectionStyle: React.CSSProperties = {
                  position: 'relative', // Crucial for child absolute positioning (like NextImage)
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  flexGrow: section.flexGrow || 0,
                  flexShrink: (section.flexGrow && section.flexGrow > 0) ? 1 : 0, // Growable items can shrink
                  flexBasis: (section.flexGrow && section.flexGrow > 0) ? '0%' : 'auto', // Basis for growable items
                  height: section.customHeight || undefined, // Explicit height
                  width: section.customWidth || undefined,   // Explicit width
                  borderColor: section.borderColor || template.defaultSectionBorderColor || undefined,
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined, // Apply border style only if width is set
                  // Explicit text wrapping for all text sections, critical for AI content
                  ...(section.type !== 'Artwork' && section.type !== 'Divider' && {
                      overflowWrap: 'break-word',
                  }),
                };
                
                // For items that grow, allow them to shrink and scroll if necessary
                if (section.flexGrow && section.flexGrow > 0) {
                    sectionStyle.minWidth = 0; // Allows item to shrink below content width
                    sectionStyle.minHeight = 0; // Allows item to shrink below content height for overflowY
                    if (section.type !== 'Artwork') { // Artwork manages its own overflow via NextImage
                        sectionStyle.overflowY = 'auto'; // Enable vertical scroll if content overflows
                    }
                }
                
                // Apply Tailwind border width classes
                let sectionBorderClass = '';
                if (section.borderWidth && section.borderWidth !== '_none_') {
                    sectionBorderClass = section.borderWidth; // e.g., "border", "border-t-2"
                    // sectionStyle.borderStyle is set above
                }


                const sectionClasses = cn(
                  'relative', // Ensure relative positioning for children like NextImage
                  section.padding || (section.type === 'Artwork' ? 'p-0' : 'p-1'),
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  section.minHeight && section.minHeight !== '_auto_' ? section.minHeight : '', // Tailwind min-height
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
                      ...sectionStyle, // Apply base section styles (like flexGrow)
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
                      boxSizing: 'border-box', // Ensure padding/border are included in width/height
                    };
                    return (
                      <div
                        key={section.id}
                        className={cn(sectionClasses)} // Apply general classes
                        style={editorArtStyle} // Specific styles for editor artwork box
                        onClick={handlePreviewSectionClick}
                        data-section-id={section.id}
                      >
                        {/* Removed "Artwork: {{placeholder}}" text */}
                        <div>Size: {section.customWidth || 'auto'} x {section.customHeight || 'auto'}</div>
                      </div>
                    );
                  } else { 
                    // Actual card render for Artwork
                    let artworkDisplaySrc = replacePlaceholdersLocal(section.contentPlaceholder, data, true);
                    // Fallback for artwork if not a valid URL or placeholder still
                    if (!artworkDisplaySrc || 
                        (!artworkDisplaySrc.startsWith('http://') && 
                         !artworkDisplaySrc.startsWith('https://') && 
                         !artworkDisplaySrc.startsWith('data:'))) {
                      const cardNameForPlaceholder = replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data, false) || template.name || "Card";
                      artworkDisplaySrc = `https://placehold.co/600x400.png?text=${encodeURIComponent(cardNameForPlaceholder + ' Art')}`;
                    }

                    const imageIsPriority = rowIndex === 0 && sectionIndex === 0;
                    // Container for NextImage, needs to be relative and have dimensions
                    const imageContainerStyle: React.CSSProperties = {
                        ...sectionStyle, // Inherit flex, padding, border from sectionStyle
                        position: 'relative', // Crucial for NextImage layout="fill"
                        height: section.customHeight || '100%', // Use custom height or fill row
                        width: section.customWidth || '100%',   // Use custom width or fill column space
                        overflow: 'hidden', // To clip the image if objectFit is 'cover'
                    };
                    if (section.customHeight) delete imageContainerStyle.minHeight; // Prevent conflict with direct height
                    if (section.customWidth) delete imageContainerStyle.minWidth;  // Prevent conflict with direct width


                    return (
                      <div
                        key={section.id}
                        className={cn(sectionClasses)} // Apply padding, borders from sectionClasses
                        style={imageContainerStyle} // Apply dimensions and relative positioning
                        onClick={handlePreviewSectionClick}
                        data-section-id={section.id}
                      >
                        <NextImage
                          src={artworkDisplaySrc}
                          alt={replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data, false) || "Card artwork"}
                          layout="fill"
                          objectFit="cover" // Or "contain" depending on desired behavior
                          data-ai-hint={artworkHintValue}
                          priority={imageIsPriority}
                        />
                      </div>
                    );
                  }
                }

                if (section.type === 'Divider') {
                  const dividerStyle: React.CSSProperties = {
                    ...sectionStyle, // Inherit flex, padding etc.
                     height: section.customHeight || '1px', // Use custom height or default
                     backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.defaultSectionBorderColor || 'hsl(var(--border))',
                     width: section.customWidth || 'auto', // Use custom width or auto
                     flexGrow: section.flexGrow || 0, // Dividers usually don't grow
                     margin: section.padding?.includes('m') ? undefined : '0.25rem 0.5rem', // Use padding for margins or default
                  };
                   if (section.padding?.includes('m')) { // If padding has margin utils, clear direct margin
                     dividerStyle.margin = undefined; 
                  }
                  if (dividerStyle.width === 'auto' && !(section.flexGrow && section.flexGrow > 0)) {
                     // If width is auto and not growing, make it stretch if not already filling (e.g. for horizontal dividers)
                     // This might need adjustment based on row direction (if we ever add vertical rows)
                     dividerStyle.alignSelf = 'stretch'; 
                  }

                  return (
                    <div
                      key={section.id}
                      className={cn("tcg-section-divider", sectionClasses)} // Apply padding from sectionClasses
                      style={dividerStyle}
                      onClick={handlePreviewSectionClick}
                      data-section-id={section.id}
                    ></div>
                  );
                }
                
                // For other text-based sections
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
