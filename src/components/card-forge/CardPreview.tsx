
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
  onSectionClick?: (sectionId: string) => void; // Changed from onColumnClick
  onRowClick?: (rowId: string) => void; // New prop
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
  onSectionClick, // For clicking individual sections (columns)
  onRowClick,     // For clicking entire rows
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
      return section.type !== 'Artwork' && section.type !== 'Divider' && section.contentPlaceholder?.trim() === '';
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
        {template.rows.map((row) => {
          const handlePreviewRowClick = (e: React.MouseEvent) => {
            if (isEditorPreview && onRowClick) {
              e.stopPropagation();
              onRowClick(row.id);
            }
          };

          // Determine if the entire row should be hidden (if all its columns are hidden)
          const allColumnsInRowHidden = row.columns.every(section => {
            const sectionContent = replacePlaceholdersLocal(section.contentPlaceholder, data);
            return shouldHideSection(section, sectionContent);
          });

          if (allColumnsInRowHidden && hideEmptySections && !isEditorPreview) {
            return null; // Hide the entire row if all its sections are empty and we are hiding empty sections
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
                  minHeight: section.minHeight === '_auto_' || !section.minHeight ? undefined : section.minHeight,
                  flexGrow: section.flexGrow || 0,
                  flexShrink: 0, // Prevent shrinking by default, flexGrow controls expansion
                  flexBasis: section.flexGrow && section.flexGrow > 0 ? '0%' : 'auto', // Allow grow from 0 or take content size
                  borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
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
                  section.borderWidth === '_none_' ? '' : section.borderWidth,
                  section.fontFamily || 'font-sans',
                  (section.type === 'RulesText' || section.type === 'FlavorText') ? 'whitespace-pre-wrap' : 'whitespace-normal break-words',
                  `tcg-section-${section.type.toLowerCase()}`,
                   // Add column index for more specific targeting if needed: `tcg-col-${sectionIndex}`
                  isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : ''
                );

                const handlePreviewSectionClick = (e: React.MouseEvent) => {
                  if (isEditorPreview && onSectionClick) {
                    e.stopPropagation(); 
                    onSectionClick(section.id);
                  }
                };

                if (section.type === 'Artwork') {
                  let artworkSrc = sectionContent;
                  if (isEditorPreview && artworkSrc && artworkSrc.startsWith('{{') && artworkSrc.endsWith('}}')) {
                    artworkSrc = `https://placehold.co/600x400.png`; 
                  } else if (!artworkSrc || artworkSrc.trim() === '') {
                    artworkSrc = `https://placehold.co/600x400.png`;
                  }
                  
                  return (
                    <div 
                      key={section.id} 
                      className={cn(sectionClasses, "relative w-full")} // Artwork often takes full width of its column space
                      style={sectionStyle}
                      onClick={handlePreviewSectionClick}
                      data-section-id={section.id}
                    >
                      <Image
                        src={artworkSrc}
                        alt={replacePlaceholdersLocal(template.rows.flatMap(r => r.columns).find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
                        layout="fill"
                        objectFit="cover"
                        className="w-full h-full" // Ensure image itself fills the div
                        data-ai-hint={artworkHint}
                        priority={sectionIndex === 0 && row.id === template.rows[0]?.id} 
                      />
                    </div>
                  );
                }

                if (section.type === 'Divider') {
                    return (
                        <div 
                          key={section.id} 
                          className={cn("tcg-section-divider w-full", sectionClasses)} 
                          style={{...sectionStyle, height: section.minHeight === '_auto_' || !section.minHeight ? '1px' : section.minHeight, backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.borderColor || 'hsl(var(--border))'}}
                          onClick={handlePreviewSectionClick}
                          data-section-id={section.id}
                        ></div>
                    );
                }
                
                const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';
                
                let displayContent = sectionContent;
                if (isEditorPreview && section.contentPlaceholder && sectionContent.trim() === '') {
                   displayContent = section.contentPlaceholder; 
                }
                if (isEditorPreview && section.contentPlaceholder && sectionContent === section.contentPlaceholder) {
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
