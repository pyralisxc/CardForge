
"use client";

import type { TCGCardTemplate, CardData, CardSection, DisplayCard } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface CardPreviewProps {
  card: DisplayCard; 
  className?: string;
  isPrintMode?: boolean;
  showSizeInfo?: boolean;
  isEditorPreview?: boolean; 
  hideEmptySections?: boolean;
  onSectionClick?: (sectionId: string) => void;
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
  onEdit,
}: CardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
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
      // Remove any un-substituted placeholders only if not in editor preview
      result = result.replace(/{{\s*[\w-]+\s*}}/g, '');
    }
    return result;
  }


  if (!template) return <div className="text-red-500">Error: Template not provided to CardPreview.</div>;

  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);

  const cardContainerStyle: React.CSSProperties = {
    backgroundColor: template.baseBackgroundColor || undefined, // Rely on CSS for default unless overridden
    color: template.baseTextColor || 'hsl(var(--card-foreground))',
    aspectRatio: `${aspectW} / ${aspectH}`,
    width: isPrintMode ? '100%' : `${PREVIEW_WIDTH_PX}px`,
    height: isPrintMode ? '100%' : 'auto',
    boxSizing: 'border-box',
  };
   // For frame-standard, if baseBackgroundColor is not set, it will use theme's --card
   if (template.frameStyle === 'standard' && !template.baseBackgroundColor) {
    cardContainerStyle.backgroundColor = 'hsl(var(--card))';
   }


  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  let artworkHint = "card art";
  const typeSection = template.sections?.find(s => s.type === 'TypeLine');
  if (typeSection) {
    const typeLineText = replacePlaceholdersLocal(typeSection.contentPlaceholder, data).toLowerCase();
    if (typeLineText.includes("creature")) artworkHint = "fantasy creature";
    else if (typeLineText.includes("spell") || typeLineText.includes("instant") || typeLineText.includes("sorcery")) artworkHint = "spell effect";
    else if (typeLineText.includes("item") || typeLineText.includes("artifact") || typeLineText.includes("equipment")) artworkHint = "fantasy item";
    else if (typeLineText.includes("land") || typeLineText.includes("location")) artworkHint = "fantasy landscape";
  }


  const shouldHideSection = (section: CardSection, processedContent: string): boolean => {
    if (isEditorPreview) {
      // In editor preview, only hide if placeholder is truly empty AND it's not art/divider
      return section.contentPlaceholder?.trim() === '' && section.type !== 'Artwork' && section.type !== 'Divider';
    }
    if (hideEmptySections) {
      if (section.type === 'Artwork' || section.type === 'Divider') return false; 
      // For generated cards, hide if the *processed content* is empty
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
        ref={cardRef}
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
        {template.sections?.map((section, index) => {
          const sectionContent = replacePlaceholdersLocal(section.contentPlaceholder, data);

          if (shouldHideSection(section, sectionContent)) {
            return null;
          }

          const sectionStyle: React.CSSProperties = {
            color: section.textColor || template.baseTextColor || undefined, // Fallback to theme via CSS if not set
            backgroundColor: section.backgroundColor || 'transparent',
            textAlign: section.textAlign || 'left',
            fontStyle: section.fontStyle || 'normal',
            minHeight: section.minHeight === '_auto_' || !section.minHeight ? 'auto' : section.minHeight,
            flexGrow: section.flexGrow ? 1 : 0,
            borderStyle: section.borderWidth && section.borderWidth !== '_none_' ? 'solid' : undefined,
          };

          const sectionClasses = cn(
            section.padding || 'p-0',
            section.fontSize || 'text-sm',
            section.fontWeight || 'font-normal',
            section.borderWidth === '_none_' ? '' : section.borderWidth,
            section.fontFamily || 'font-sans',
            section.flexGrow ? 'flex-grow' : '',
            (section.type === 'RulesText' || section.type === 'FlavorText') ? 'whitespace-pre-wrap' : 'whitespace-normal break-words',
            `tcg-section-${section.type.toLowerCase()}`,
            isEditorPreview && onSectionClick ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-[-1px] hover:outline-primary/70' : ''
          );
          
          if (section.borderColor) {
              sectionStyle.borderColor = section.borderColor;
          } else if (section.borderWidth && section.borderWidth !== '_none_' && template.borderColor) { 
              sectionStyle.borderColor = template.borderColor;
          } else if (section.borderWidth && section.borderWidth !== '_none_') {
            sectionStyle.borderColor = 'hsl(var(--border))'; 
          }


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
                className={cn(sectionClasses, "relative")} 
                style={sectionStyle}
                onClick={handlePreviewSectionClick}
              >
                <Image
                  src={artworkSrc}
                  alt={replacePlaceholdersLocal(template.sections.find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
                  layout="fill"
                  objectFit="cover"
                  className="w-full h-full"
                  data-ai-hint={artworkHint}
                  priority={index === 0}
                />
              </div>
            );
          }

          if (section.type === 'Divider') {
              return (
                  <div 
                    key={section.id} 
                    className={cn("tcg-section-divider", sectionClasses)} 
                    style={{...sectionStyle, height: section.minHeight === '_auto_' || !section.minHeight ? '1px' : section.minHeight, backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.borderColor || 'hsl(var(--border))'}}
                    onClick={handlePreviewSectionClick}
                  ></div>
              );
          }
          
          const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';
          
          let displayContent = sectionContent;
          if (isEditorPreview && section.contentPlaceholder && sectionContent.trim() === '') {
             displayContent = section.contentPlaceholder; // Show placeholder if content is empty in editor
          }
          // If content is just the placeholder itself (common in editor preview), show it
          if (isEditorPreview && section.contentPlaceholder && sectionContent === section.contentPlaceholder) {
            displayContent = section.contentPlaceholder;
          }


          // This condition was problematic, adjusted shouldHideSection
          // if (displayContent.trim() === '' && !isEditorPreview && hideEmptySections) {
          //   return null;
          // }


          return (
            <Tag 
              key={section.id} 
              className={cn(sectionClasses, section.flexGrow ? 'flex-grow overflow-y-auto' : 'shrink-0')} 
              style={sectionStyle}
              onClick={handlePreviewSectionClick}
            >
              {displayContent}
            </Tag>
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
    
