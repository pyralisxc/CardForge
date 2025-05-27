
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
  hideEmptySections?: boolean; // New prop
}

const PREVIEW_WIDTH_PX = 280; // Standard preview width on screen

export function CardPreview({
  template,
  data,
  className,
  isPrintMode = false,
  showSizeInfo = false,
  isEditorPreview = false,
  hideEmptySections = true, // Default to hiding empty sections
}: CardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // const [actualWidthPx, setActualWidthPx] = useState(PREVIEW_WIDTH_PX); // Not currently used, but kept for potential future use

  // useEffect(() => { // Kept for potential future use if dynamic width calculation is needed
  //   if (cardRef.current && !isPrintMode) {
  //     setActualWidthPx(cardRef.current.offsetWidth);
  //   }
  // }, [isPrintMode, template]); 

  function replacePlaceholdersLocal(text: string | undefined, dataContext: CardData): string {
    if (text === undefined || text === null) return '';
    let result = String(text);

    for (const key in dataContext) {
      if (dataContext[key] !== undefined && dataContext[key] !== null) {
        // Escape regex special characters in the key
        const escapedKey = key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        const searchRegex = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g');
        result = result.replace(searchRegex, String(dataContext[key]));
      }
    }
    
    // If not in editor preview, remove any remaining {{...}} placeholders
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

  let artworkHint = "card art"; // Default AI hint
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
      // In editor preview, only hide if the original placeholder was completely empty.
      // The live preview data will make {{placeholder}} appear as text.
      return section.contentPlaceholder.trim() === '';
    }
    if (hideEmptySections) {
      // For artwork and dividers, their visibility isn't solely based on text content for this check.
      // Artwork will show placeholder if src is empty. Dividers are always shown unless explicitly styled away.
      if (section.type === 'Artwork' || section.type === 'Divider') return false; 
      return processedContent.trim() === '';
    }
    return false; // If not hiding empty sections, never hide based on content (unless original placeholder was empty).
  };


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

          if (shouldHideSection(section, sectionContent) && section.type !== 'Artwork' && section.type !== 'Divider') {
            return null;
          }

          const sectionStyle: React.CSSProperties = {
            color: section.textColor || template.baseTextColor || '#000000',
            backgroundColor: section.backgroundColor || 'transparent',
            textAlign: section.textAlign || 'left',
            fontStyle: section.fontStyle || 'normal',
            minHeight: section.minHeight || 'auto',
            flexGrow: section.flexGrow ? 1 : 0,
            // Ensure border style is solid if width is defined, this helps visibility
            borderStyle: section.borderWidth ? 'solid' : undefined,
          };

          const sectionClasses = cn(
            section.padding || 'p-0',
            section.fontSize || 'text-sm',
            section.fontWeight || 'font-normal',
            section.borderWidth, // e.g., border-t-2
            section.fontFamily || 'font-sans',
            section.flexGrow ? 'flex-grow' : '',
            (section.type === 'RulesText' || section.type === 'FlavorText') ? 'whitespace-pre-wrap' : 'whitespace-normal break-words',
             `tcg-section-${section.type.toLowerCase()}`
          );
          
          // Set border color, prioritizing section-specific then template default.
          if (section.borderColor) {
              sectionStyle.borderColor = section.borderColor;
          } else if (section.borderWidth && template.borderColor) { 
              sectionStyle.borderColor = template.borderColor;
          }


          if (section.type === 'Artwork') {
            let artworkSrc = sectionContent; // This now has {{artworkUrl}} if in editor preview data
            if (isEditorPreview && artworkSrc && artworkSrc.startsWith('{{') && artworkSrc.endsWith('}}')) {
              artworkSrc = `https://placehold.co/600x400.png`; // Default placeholder for editor
            } else if (!artworkSrc || artworkSrc.trim() === '') {
              artworkSrc = `https://placehold.co/600x400.png`; // Default if empty or invalid
            }
            
            return (
              <div key={section.id} className={cn(sectionClasses, "relative")} style={sectionStyle}> {/* Ensure relative for Image layout fill */}
                <Image
                  src={artworkSrc}
                  alt={replacePlaceholdersLocal(template.sections.find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
                  layout="fill"
                  objectFit="cover" // 'cover' is often better for TCG art than 'contain'
                  className="w-full h-full" // Ensure image tries to fill its container
                  data-ai-hint={artworkHint}
                  priority={index === 0} // Prioritize loading for the first artwork (usually main art)
                />
              </div>
            );
          }

          if (section.type === 'Divider') {
              return (
                  <div key={section.id} className={cn("tcg-section-divider", sectionClasses)} style={{...sectionStyle, height: section.minHeight || '1px', backgroundColor: section.backgroundColor || sectionStyle.borderColor || template.borderColor || '#AAAAAA'}}></div>
              );
          }
          
          // For text-based sections
          const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';

          // Final check if content is just empty spaces and we are not in editor preview
          if (sectionContent.trim() === '' && !isEditorPreview && hideEmptySections) {
            return null;
          }
           // If in editor preview, but the original placeholder was empty, don't render (unless it's a divider/art that has defaults)
          if (isEditorPreview && section.contentPlaceholder.trim() === '' && section.type !== 'Artwork' && section.type !== 'Divider') {
            return null;
          }


          return (
            <Tag key={section.id} className={cn(sectionClasses, section.flexGrow ? 'flex-grow overflow-y-auto' : 'shrink-0')} style={sectionStyle}>
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
