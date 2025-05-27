
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

  let artworkHint = "card art";
  if (template.rows) {
    const typeLineSection = template.rows
      .flatMap(row => row.columns)
      .find(section => section.type === 'TypeLine');
    if (typeLineSection) {
      const typeLineText = replacePlaceholdersLocal(typeLineSection.contentPlaceholder, data).toLowerCase();
      if (typeLineText.includes("creature")) artworkHint = "fantasy creature";
      else if (typeLineText.includes("spell") || typeLineText.includes("instant") || typeLineText.includes("sorcery")) artworkHint = "spell effect";
      else if (typeLineText.includes("item") || typeLineText.includes("artifact") || typeLineText.includes("equipment")) artworkHint = "fantasy item";
      else if (typeLineText.includes("land") || typeLineText.includes("location")) artworkHint = "fantasy landscape";
    }
  }


  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) {
      // In editor preview, only hide if the placeholder itself is truly empty,
      // but generally show it so users can see all defined sections.
      // Artwork and Dividers are always shown structurally in editor.
      if (section.type === 'Artwork' || section.type === 'Divider') return false;
      return section.contentPlaceholder?.trim() === '';
    }
    // For actual card previews (not editor)
    if (hideEmptySections) {
      if (section.type === 'Artwork' || section.type === 'Divider') return false; // Artwork might have a default, Divider is structural
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
                  flexBasis: section.flexGrow && section.flexGrow > 0 ? '0%' : 'auto', // Allow grow/shrink from 0
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
                  minWidth: section.flexGrow && section.flexGrow > 0 ? 0 : undefined, // Crucial for text wrapping in flex items
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
                  (section.minHeight && section.minHeight !== '_auto_') ? section.minHeight : '', // Apply minHeight as a class
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
                     if (!artworkDisplaySrc.startsWith('http://') && 
                         !artworkDisplaySrc.startsWith('https://') && 
                         !artworkDisplaySrc.startsWith('data:')) {
                       artworkDisplaySrc = `https://placehold.co/600x400.png`;
                     }
                  } else {
                    if (!artworkDisplaySrc || artworkDisplaySrc.trim() === '' || (artworkDisplaySrc.startsWith('{{') && artworkDisplaySrc.endsWith('}}'))) {
                       artworkDisplaySrc = `https://placehold.co/600x400.png`; 
                    }
                  }

                  return (
                    <div
                      key={section.id}
                      className={cn(sectionClasses, "relative w-full")} // w-full is important for layout="fill"
                      style={sectionStyle} // sectionStyle contains minHeight for Artwork
                      onClick={handlePreviewSectionClick}
                      data-section-id={section.id}
                    >
                      <Image
                        src={artworkDisplaySrc}
                        alt={replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
                        layout="fill"
                        objectFit="cover"
                        className="w-full h-full" // these might be redundant with layout="fill" but fine
                        data-ai-hint={artworkHint}
                        priority={rowIndex === 0 && sectionIndex === 0} 
                      />
                    </div>
                  );
                }

                if (section.type === 'Divider') {
                    return (
                        <div
                          key={section.id}
                          className={cn("tcg-section-divider w-full", sectionClasses)} // sectionClasses includes minHeight if set
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
