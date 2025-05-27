
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

  const cardContainerStyle: React.CSSProperties = {
    backgroundColor: template.baseBackgroundColor || undefined,
    color: template.baseTextColor || undefined,
    aspectRatio: `${aspectW} / ${aspectH}`,
    width: isPrintMode ? '100%' : `${PREVIEW_WIDTH_PX}px`,
    height: isPrintMode ? '100%' : 'auto',
    boxSizing: 'border-box',
  };
  
  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  let artworkHintValue = "card art"; // Default hint
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

          return (
            <div
              key={row.id}
              className={cn(
                "flex",
                isEditorPreview && onRowClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-500/70' : ''
              )}
              style={{ alignItems: row.alignItems || 'flex-start' }}
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
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  minWidth: section.flexGrow && section.flexGrow > 0 ? 0 : undefined, 
                };

                if (section.borderColor) {
                  sectionStyle.borderColor = section.borderColor;
                } else if (section.borderWidth && section.borderWidth !== '_none_' && template.borderColor) {
                  sectionStyle.borderColor = template.borderColor;
                } else if (section.borderWidth && section.borderWidth !== '_none_') {
                  sectionStyle.borderColor = 'hsl(var(--border))';
                }

                const sectionClasses = cn(
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
                  let artworkDisplaySrc = sectionContent;
                  
                  if (isEditorPreview) {
                     // For the template editor's live preview, ALWAYS use the placeholder.co image.
                     artworkDisplaySrc = `https://placehold.co/600x400.png?text=ART`;
                  } else {
                    // For generated cards, if no valid URL, use placeholder.co.
                    const looksLikePlaceholder = !sectionContent || sectionContent.trim() === '' || (sectionContent.startsWith('{{') && sectionContent.endsWith('}}'));
                    const isNotHttpOrData = sectionContent && !sectionContent.startsWith('http://') && !sectionContent.startsWith('https://') && !sectionContent.startsWith('data:');
                    
                    if (looksLikePlaceholder || isNotHttpOrData ) {
                      artworkDisplaySrc = `https://placehold.co/600x400.png`;
                    }
                  }
                  
                  const imageIsPriority = typeof rowIndex === 'number' && typeof sectionIndex === 'number' && rowIndex === 0 && sectionIndex === 0;

                  return (
                    <div
                      key={section.id}
                      className={cn(sectionClasses, "relative")} // sectionClasses includes minHeight, padding ('p-0' for artwork), and other styles. "relative" for NextImage.
                      style={sectionStyle} // sectionStyle includes flex properties
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

                if (section.type === 'Divider') {
                    return (
                        <div
                          key={section.id}
                          className={cn("tcg-section-divider w-full", sectionClasses)} 
                          style={{...sectionStyle, backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.borderColor || 'hsl(var(--border))'}}
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
                    className={cn(sectionClasses, section.flexGrow && section.flexGrow > 0 ? 'overflow-y-auto' : 'shrink-0')}
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
