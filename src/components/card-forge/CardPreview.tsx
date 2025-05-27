
"use client";

import type { TCGCardTemplate, CardData, CardSection } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface CardPreviewProps {
  template: TCGCardTemplate;
  data: CardData;
  className?: string;
  isPrintMode?: boolean;
  showSizeInfo?: boolean;
  isEditorPreview?: boolean; 
}

const PREVIEW_WIDTH_PX = 280; // Standard preview width on screen

export function CardPreview({
  template,
  data,
  className,
  isPrintMode = false,
  showSizeInfo = false,
  isEditorPreview = false,
}: CardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [actualWidthPx, setActualWidthPx] = useState(PREVIEW_WIDTH_PX);

  useEffect(() => {
    if (cardRef.current && !isPrintMode) {
      setActualWidthPx(cardRef.current.offsetWidth);
    }
  }, [isPrintMode, template]); 

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


  if (!template) return <div className="text-red-500">Error: Template not provided to CardPreview.</div>;

  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);

  const cardContainerStyle: React.CSSProperties = {
    backgroundColor: template.baseBackgroundColor || '#FFFFFF',
    color: template.baseTextColor || '#000000',
    aspectRatio: `${aspectW} / ${aspectH}`,
    width: isPrintMode ? '100%' : `${PREVIEW_WIDTH_PX}px`,
    height: isPrintMode ? '100%' : 'auto',
    border: `4px solid ${template.frameColor || 'grey'}`,
    boxSizing: 'border-box',
  };

  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);

  let artworkHint = "card art";
  const typeSection = template.sections?.find(s => s.type === 'TypeLine');
  if (typeSection) {
    const typeLineText = replacePlaceholdersLocal(typeSection.contentPlaceholder, data).toLowerCase();
    if (typeLineText.includes("creature")) artworkHint = "fantasy creature";
    else if (typeLineText.includes("spell") || typeLineText.includes("instant")) artworkHint = "spell effect";
    else if (typeLineText.includes("item") || typeLineText.includes("artifact")) artworkHint = "fantasy item";
  }


  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        ref={cardRef}
        className={cn(
          "tcg-card-preview shadow-lg rounded-lg flex flex-col relative overflow-hidden",
          isPrintMode ? "card-preview-print" : "",
        )}
        style={cardContainerStyle}
        data-ai-hint="tcg card custom"
      >
        {template.sections?.map((section, index) => {
          const sectionContent = replacePlaceholdersLocal(section.contentPlaceholder, data);

          if (section.type !== 'Artwork' && section.type !== 'Divider') {
            const placeholderKeysInSection = Array.from(section.contentPlaceholder?.matchAll(/{{\s*([\w-]+)\s*}}/g) || []).map(m => m[1]);
            const hasActualText = section.contentPlaceholder?.replace(/{{\s*[\w-]+\s*}}/g, '').trim() !== '';

            if (!hasActualText && placeholderKeysInSection.length > 0) {
              const allPlaceholdersEmptyOrMissing = placeholderKeysInSection.every(pKey => {
                const value = data[pKey];
                return value === undefined || value === '' || (isEditorPreview && value === `{{${pKey}}}` && !data.hasOwnProperty(pKey));
              });
              
              if ((allPlaceholdersEmptyOrMissing && !isEditorPreview && sectionContent.trim() === '') || (!isEditorPreview && sectionContent.trim() === '')) {
                 return null;
              }
              if (isEditorPreview && sectionContent.trim() === '') {
                return null;
              }
            } else if (sectionContent.trim() === '' && section.type !== 'Artwork' && section.type !== 'Divider' && !isEditorPreview) {
                return null;
            }
          }


          const sectionStyle: React.CSSProperties = {
            color: section.textColor || template.baseTextColor || '#000000',
            backgroundColor: section.backgroundColor || 'transparent',
            textAlign: section.textAlign || 'left',
            fontStyle: section.fontStyle || 'normal',
            minHeight: section.minHeight || 'auto',
            flexGrow: section.flexGrow ? 1 : 0,
          };

          const sectionClasses = cn(
            section.padding || 'p-0',
            section.fontSize || 'text-sm',
            section.fontWeight || 'font-normal',
            section.borderWidth,
            section.fontFamily || 'font-sans',
            section.flexGrow ? 'flex-grow' : '',
            section.type === 'RulesText' || section.type === 'FlavorText' ? 'whitespace-pre-wrap' : 'whitespace-normal',
          );

          if (section.borderColor) {
              sectionStyle.borderColor = section.borderColor;
          } else if (section.borderWidth && template.borderColor) {
              sectionStyle.borderColor = template.borderColor;
          }
          if (section.borderWidth && !sectionStyle.borderStyle) {
              sectionStyle.borderStyle = 'solid';
          }


          if (section.type === 'Artwork') {
            let artworkSrc = sectionContent;
            if (isEditorPreview && artworkSrc && artworkSrc.startsWith('{{') && artworkSrc.endsWith('}}')) {
              artworkSrc = 'https://placehold.co/300x200.png';
            } else if (!artworkSrc || artworkSrc.trim() === '') {
              artworkSrc = 'https://placehold.co/300x200.png';
            }
            
            return (
              <div key={section.id} className={cn("tcg-section-artwork", sectionClasses, section.flexGrow ? 'flex-grow relative' : 'relative')} style={sectionStyle}>
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
                  <div key={section.id} className={cn("tcg-section-divider", sectionClasses)} style={{...sectionStyle, height: section.minHeight || '1px', backgroundColor: section.backgroundColor || template.borderColor || '#AAAAAA'}}></div>
              );
          }

          const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';

          if (sectionContent.trim() === '' && !isEditorPreview) {
            return null;
          }

          return (
            <Tag key={section.id} className={cn(`tcg-section-${section.type.toLowerCase()}`, sectionClasses, section.flexGrow ? 'flex-grow overflow-y-auto' : 'shrink-0')} style={sectionStyle}>
              {sectionContent}
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
    

    