
"use client";

import type { DisplayCard, CardSection, CardData, CardRow } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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

  function replacePlaceholdersLocal(text: string | undefined, dataContext: CardData): string {
    if (text === undefined || text === null) return '';
    let result = String(text);

    for (const key in dataContext) {
      if (dataContext[key] !== undefined && dataContext[key] !== null) {
        const escapedKey = key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        const searchRegex = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g');
        result = result.replace(searchRegex, String(dataContext[key]));
      }
    }

    if (!isEditorPreview) {
      result = result.replace(/{{\s*[\w-]+\s*}}/g, '');
    }
    return result;
  }


  if (!template) return <div className="text-destructive">Error: Template not provided to CardPreview.</div>;
  if (!template.rows) return <div className="text-destructive">Error: Template has no rows defined.</div>;


  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);
  const cardPixelHeight = (aspectW > 0 && aspectH > 0) ? (PREVIEW_WIDTH_PX / aspectW) * aspectH : 390; // Default height if aspect ratio invalid

  const cardContainerStyle: React.CSSProperties = {
    backgroundColor: template.baseBackgroundColor || undefined,
    color: template.baseTextColor || undefined,
    aspectRatio: (aspectW > 0 && aspectH > 0) ? `${aspectW} / ${aspectH}` : undefined,
    width: isPrintMode ? '100%' : `${PREVIEW_WIDTH_PX}px`,
    height: isPrintMode ? '100%' : (aspectW > 0 && aspectH > 0 ? 'auto' : `${cardPixelHeight}px`), // Use explicit height if aspect ratio is bad
    boxSizing: 'border-box',
  };
  
  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  let artworkHintValue = "card art"; 
  if (template.rows) {
    const typeLineSection = template.rows
      .flatMap(row => row.columns)
      .find(section => section.type === 'TypeLine');
    if (typeLineSection && typeLineSection.contentPlaceholder) {
      const typeLineText = replacePlaceholdersLocal(typeLineSection.contentPlaceholder, data).toLowerCase();
      if (typeLineText.includes("creature")) artworkHintValue = "fantasy creature";
      else if (typeLineText.includes("spell") || typeLineText.includes("instant") || typeLineText.includes("sorcery")) artworkHintValue = "spell effect";
      else if (typeLineText.includes("item") || typeLineText.includes("artifact") || typeLineText.includes("equipment")) artworkHintValue = "fantasy item";
      else if (typeLineText.includes("land") || typeLineText.includes("location")) artworkHintValue = "fantasy landscape";
    }
  }


  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) {
      if (section.type === 'Artwork' || section.type === 'Divider') return false;
      return section.contentPlaceholder?.trim() === ''; 
    }
    if (hideEmptySections) {
      if (section.type === 'Artwork' || section.type === 'Divider') return false; 
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
          "tcg-card-preview shadow-lg rounded-lg flex flex-col relative overflow-hidden",
          isPrintMode ? "card-preview-print" : "",
          `frame-${template.frameStyle || 'standard'}`,
          onEdit && !isEditorPreview ? 'cursor-pointer hover:shadow-primary/50 hover:shadow-md transition-shadow duration-150' : ''
        )}
        style={cardContainerStyle}
        data-ai-hint="tcg card custom"
        onClick={handleCardClick}
      >
        {template.rows.map((row, rowIndex) => {
          const handlePreviewRowClick = (e: React.MouseEvent) => {
            if (isEditorPreview && onRowClick) {
              e.stopPropagation();
              onRowClick(row.id);
            }
          };

          const allColumnsInRowHidden = row.columns.every(section => {
            const sectionContentForHiding = replacePlaceholdersLocal(section.contentPlaceholder, data);
            return shouldHideSection(section, sectionContentForHiding);
          });

          if (allColumnsInRowHidden && hideEmptySections && !isEditorPreview) {
            return null;
          }
          
          let rowEffectiveHeight: string | undefined = row.customHeight || undefined;
          if (row.customHeight && row.customHeight.includes('%') && !isPrintMode) {
            const percentageValue = parseFloat(row.customHeight.replace('%', ''));
            if (!isNaN(percentageValue) && isFinite(percentageValue) && cardPixelHeight > 0) {
              rowEffectiveHeight = `${cardPixelHeight * (percentageValue / 100)}px`;
            } else {
              console.warn(`Invalid percentage or cardPixelHeight for row height: ${row.customHeight}`);
              rowEffectiveHeight = undefined; 
            }
          }

          const rowStyle: React.CSSProperties = {
            display: 'flex', // ensures it's a flex container for columns
            alignItems: row.alignItems || 'flex-start',
            height: rowEffectiveHeight,
            flexShrink: 0, // Prevent rows from shrinking if their content is larger than their calculated height
          };


          return (
            <div
              key={row.id}
              className={cn(
                "flex", // Already a flex container from rowStyle, class ensures it's applied
                isEditorPreview && onRowClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-500/70' : ''
              )}
              style={rowStyle}
              onClick={handlePreviewRowClick}
              data-row-id={row.id}
            >
              {row.columns.map((section, sectionIndex) => {
                const sectionContent = replacePlaceholdersLocal(section.contentPlaceholder, data);

                if (shouldHideSection(section, sectionContent)) { 
                    return null;
                }
                
                const sectionStyle: React.CSSProperties = {
                  color: section.textColor || undefined,
                  backgroundColor: section.backgroundColor || 'transparent',
                  textAlign: section.textAlign || 'left',
                  fontStyle: section.fontStyle || 'normal',
                  flexGrow: section.flexGrow || 0,
                  flexShrink: section.flexGrow && section.flexGrow > 0 ? 1 : 0, 
                  flexBasis: section.flexGrow && section.flexGrow > 0 ? '0%' : 'auto', 
                  minWidth: section.flexGrow && section.flexGrow > 0 ? 0 : undefined,
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  height: section.customHeight || undefined,
                  width: section.customWidth || undefined,  
                  overflow: 'hidden', // Helps contain content, especially for text
                };

                if (section.borderColor) {
                  sectionStyle.borderColor = section.borderColor;
                } else if (section.borderWidth && section.borderWidth !== '_none_' && template.borderColor) {
                  sectionStyle.borderColor = template.borderColor;
                } else if (section.borderWidth && section.borderWidth !== '_none_') {
                  sectionStyle.borderColor = 'hsl(var(--border))';
                }
                
                const sectionClasses = cn(
                  'relative', 
                  section.padding || (section.type === 'Artwork' ? 'p-0' : 'p-1'),
                  section.fontSize || 'text-sm',
                  section.fontWeight || 'font-normal',
                  section.fontFamily || 'font-sans',
                  (section.minHeight && section.minHeight !== '_auto_') ? section.minHeight : '',
                  section.borderWidth === '_none_' ? '' : section.borderWidth,
                  (section.type === 'RulesText' || section.type === 'FlavorText') ? 'whitespace-pre-wrap break-words' : 'whitespace-normal break-words',
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
                    const editorPreviewStyle: React.CSSProperties = {
                      height: section.customHeight || (section.minHeight && section.minHeight !== '_auto_' && !section.customHeight ? undefined : '180px'),
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
                      position: 'relative',
                       ...sectionStyle, // Apply general section styles
                       // Explicitly override height and width from sectionStyle if they came from customHeight/Width on the section itself
                       height: section.customHeight || sectionStyle.height || '180px', // Prioritize section.customHeight
                       width: section.customWidth || sectionStyle.width || '100%',   // Prioritize section.customWidth
                    };
                     delete editorPreviewStyle.flexGrow; 
                     delete editorPreviewStyle.minWidth;

                    if (isEditorPreview) {
                      return (
                        <div
                          key={section.id}
                          className={cn(sectionClasses, section.flexGrow && section.flexGrow > 0 ? 'flex-grow' : '')}
                          style={editorPreviewStyle}
                          onClick={handlePreviewSectionClick}
                          data-section-id={section.id}
                        >
                          <div>Artwork: {section.contentPlaceholder}</div>
                          <div>Size: {editorPreviewStyle.width} x {editorPreviewStyle.height}</div>
                        </div>
                      );
                    } else {
                      let artworkDisplaySrc = sectionContent;
                      const looksLikePlaceholderOrInvalid = !sectionContent || sectionContent.trim() === '' || 
                                                        (sectionContent.startsWith('{{') && sectionContent.endsWith('}}')) ||
                                                        (!sectionContent.startsWith('http://') && !sectionContent.startsWith('https://') && !sectionContent.startsWith('data:'));
                      
                      if (looksLikePlaceholderOrInvalid) {
                        artworkDisplaySrc = `https://placehold.co/600x400.png?text=ART`;
                      }
                    
                      const imageIsPriority = typeof rowIndex === 'number' && typeof sectionIndex === 'number' && rowIndex === 0 && sectionIndex === 0;
                      const imageContainerStyle: React.CSSProperties = {
                          position: 'relative', 
                          height: section.customHeight || '100%', 
                          width: section.customWidth || '100%',  
                          overflow: 'hidden',
                          ...sectionStyle, 
                      };
                      delete imageContainerStyle.flexGrow;
                      delete imageContainerStyle.flexShrink;
                      delete imageContainerStyle.flexBasis;
                      delete imageContainerStyle.minWidth;


                      return (
                        <div
                          key={section.id}
                          className={cn("relative", sectionClasses, section.flexGrow && section.flexGrow > 0 ? 'flex-grow' : '')}
                          style={imageContainerStyle}
                          onClick={handlePreviewSectionClick}
                          data-section-id={section.id}
                        >
                          <Image
                            src={artworkDisplaySrc}
                            alt={replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
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
                    return (
                        <div
                          key={section.id}
                          className={cn("tcg-section-divider w-full", sectionClasses, section.minHeight && section.minHeight !== '_auto_' ? section.minHeight : '')} 
                          style={{...sectionStyle, height: section.customHeight || '1px', backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.borderColor || 'hsl(var(--border))'}}
                          onClick={handlePreviewSectionClick}
                          data-section-id={section.id}
                        ></div>
                    );
                }

                const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';

                let displayContent = sectionContent;
                if (isEditorPreview && section.contentPlaceholder && sectionContent.trim() === '' && section.contentPlaceholder.trim() !== '') {
                    displayContent = section.contentPlaceholder;
                } else if (isEditorPreview && section.contentPlaceholder && sectionContent === section.contentPlaceholder) {
                   displayContent = section.contentPlaceholder;
                }

                return (
                  <Tag
                    key={section.id}
                    className={cn(sectionClasses, section.flexGrow && section.flexGrow > 0 ? 'overflow-y-auto' : 'shrink-0', section.minHeight && section.minHeight !== '_auto_' ? section.minHeight : '', section.customHeight ? '' : (section.minHeight && section.minHeight !=='_auto_' ? section.minHeight : ''))}
                    style={sectionStyle}
                    onClick={handlePreviewSectionClick}
                    data-section-id={section.id}
                  >
                    {displayContent}
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


    