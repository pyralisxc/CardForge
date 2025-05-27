
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
  showSizeInfo?: boolean; // New prop to control size display
}

function replacePlaceholders(text: string | undefined, data: CardData): string {
  if (text === undefined || text === null) return '';
  let result = String(text); 
  
  for (const key in data) {
    if (data[key] !== undefined && data[key] !== null) {
      const placeholder = `{{${key}}}`;
      const escapedPlaceholder = placeholder.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), String(data[key]));
    }
  }
  result = result.replace(/{{\s*[\w-]+\s*}}/g, '');
  return result;
}

const PREVIEW_WIDTH_PX = 280; // Standard preview width on screen
const DPI = 96; // Assumed screen DPI for inch calculation

export function CardPreview({ template, data, className, isPrintMode = false, showSizeInfo = false }: CardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [actualWidthPx, setActualWidthPx] = useState(PREVIEW_WIDTH_PX);

  useEffect(() => {
    if (cardRef.current && !isPrintMode) {
      setActualWidthPx(cardRef.current.offsetWidth);
    }
  }, [isPrintMode]);


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
  
  const widthInches = ((actualWidthPx / DPI) * (63 / (PREVIEW_WIDTH_PX / (aspectW/aspectH * PREVIEW_WIDTH_PX / PREVIEW_WIDTH_PX * 25.4 / 63)))).toFixed(1);
  const heightInches = ((actualWidthPx / DPI / aspectW * aspectH) * (88 / (PREVIEW_WIDTH_PX / (aspectW/aspectH * PREVIEW_WIDTH_PX / PREVIEW_WIDTH_PX * 25.4 / 88)))).toFixed(1);
  
  // A more direct way to estimate physical size based on the TCG standard dimensions 63x88mm
  const cardStandardWidthInches = (63 / 25.4).toFixed(1);
  const cardStandardHeightInches = (88 / 25.4).toFixed(1);


  let artworkHint = "card art"; 
  const artSectionDef = template.sections?.find(s => s.type === 'Artwork');
  const typeSection = template.sections?.find(s => s.type === 'TypeLine');
  if (typeSection) {
    const typeLineText = replacePlaceholders(typeSection.contentPlaceholder, data).toLowerCase();
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
          // className // className from props might conflict with positioning, apply to wrapper
        )}
        style={cardContainerStyle}
        data-ai-hint="tcg card custom"
      >
        {template.sections?.map((section, index) => { // Added index here
          const sectionContent = replacePlaceholders(section.contentPlaceholder, data);
          
          if (!sectionContent && 
              section.type !== 'Artwork' && 
              section.type !== 'Divider' && 
              section.contentPlaceholder && section.contentPlaceholder.includes("{{") && section.contentPlaceholder.includes("}}") &&
              !Object.keys(data).some(key => section.contentPlaceholder.includes(`{{${key}}}`) && data[key]) 
            ) {
              const allPlaceholders = Array.from(section.contentPlaceholder.matchAll(/{{\s*([\w-]+)\s*}}/g)).map(m => m[1]);
              const allPlaceholdersEmpty = allPlaceholders.every(pKey => !data[pKey]);
              if (allPlaceholders.length > 0 && allPlaceholdersEmpty && section.contentPlaceholder.replace(/{{\s*[\w-]+\s*}}/g, '').trim() === '') {
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
            // fontFamily handled by className now
          };
          
          const sectionClasses = cn(
            section.padding || 'p-0',
            section.fontSize || 'text-sm',
            section.fontWeight || 'font-normal',
            section.borderWidth, 
            section.fontFamily || 'font-sans', // Apply font family class
            section.flexGrow ? 'flex-grow' : '', // Keep this for CSS flex
            section.type === 'RulesText' || section.type === 'FlavorText' ? 'whitespace-pre-wrap' : 'whitespace-normal', // Ensure text wraps
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
            const artworkUrl = sectionContent || 'https://placehold.co/300x200.png'; 
            return (
              <div key={section.id} className={cn("tcg-section-artwork", sectionClasses, section.flexGrow ? 'flex-grow relative' : 'relative')} style={sectionStyle}>
                <Image
                  src={artworkUrl}
                  alt={replacePlaceholders(template.sections.find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
                  layout="fill" // Use fill and ensure parent has relative positioning and dimensions
                  objectFit="cover" // Changed from object-cover to objectFit
                  className="w-full h-full" // These might be redundant with layout="fill"
                  data-ai-hint={artworkHint}
                  priority={index === 0 || section.type === 'Artwork'} // Prioritize loading for early artwork
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
