
"use client";

import type { TCGCardTemplate, CardData, CardSection } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CardPreviewProps {
  template: TCGCardTemplate;
  data: CardData;
  className?: string;
  isPrintMode?: boolean;
}

function replacePlaceholders(text: string | undefined, data: CardData): string {
  if (text === undefined || text === null) return '';
  let result = String(text); // Ensure text is a string
  
  // First, replace known data fields
  for (const key in data) {
    if (data[key] !== undefined && data[key] !== null) {
      const placeholder = `{{${key}}}`;
      // Escape special characters in placeholder for regex
      const escapedPlaceholder = placeholder.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), String(data[key]));
    }
  }
  // Remove any unreplaced placeholders (e.g. {{unfilledValue}}) or those with undefined/null data
  result = result.replace(/{{\s*[\w-]+\s*}}/g, '');
  return result;
}

export function CardPreview({ template, data, className, isPrintMode = false }: CardPreviewProps) {
  if (!template) return <div className="text-red-500">Error: Template not provided to CardPreview.</div>;

  const [aspectW, aspectH] = (template.aspectRatio || "63:88").split(':').map(Number);

  const cardContainerStyle: React.CSSProperties = {
    backgroundColor: template.baseBackgroundColor || '#FFFFFF',
    color: template.baseTextColor || '#000000',
    aspectRatio: `${aspectW} / ${aspectH}`,
    width: isPrintMode ? '100%' : '280px', // Slightly larger for better viewing
    height: isPrintMode ? '100%' : 'auto',
    border: `4px solid ${template.frameColor || 'grey'}`,
    boxSizing: 'border-box',
  };

  // Determine overall artwork hint from multiple sections if possible
  let artworkHint = "card art"; // Default
  const artSection = template.sections?.find(s => s.type === 'Artwork');
  const typeSection = template.sections?.find(s => s.type === 'TypeLine');
  if (typeSection) {
    const typeLineText = replacePlaceholders(typeSection.contentPlaceholder, data).toLowerCase();
    if (typeLineText.includes("creature")) artworkHint = "fantasy creature";
    else if (typeLineText.includes("spell") || typeLineText.includes("instant")) artworkHint = "spell effect";
    else if (typeLineText.includes("item") || typeLineText.includes("artifact")) artworkHint = "fantasy item";
  }


  return (
    <div
      className={cn(
        "tcg-card-preview shadow-lg rounded-lg flex flex-col relative overflow-hidden",
        isPrintMode ? "card-preview-print" : "",
        className
      )}
      style={cardContainerStyle}
      data-ai-hint="tcg card custom"
    >
      {template.sections?.map((section) => {
        const sectionContent = replacePlaceholders(section.contentPlaceholder, data);
        
        // Skip rendering section if its placeholder was for an optional field and data is missing,
        // unless it's an artwork section (which might have a default bg) or a divider.
        if (!sectionContent && 
            section.type !== 'Artwork' && 
            section.type !== 'Divider' && 
            section.contentPlaceholder && section.contentPlaceholder.includes("{{") && section.contentPlaceholder.includes("}}") &&
            !Object.keys(data).some(key => section.contentPlaceholder.includes(`{{${key}}}`) && data[key]) 
           ) {
             // This logic is tricky: aims to hide sections if their *only* content was an empty placeholder
             // A section with "Cost: {{cost}}" and cost is empty, should still show "Cost: " if that's desired.
             // For now, if all placeholders are empty and there's no static text, and it's not Art/Divider, skip.
             const allPlaceholders = Array.from(section.contentPlaceholder.matchAll(/{{\s*([\w-]+)\s*}}/g)).map(m => m[1]);
             const allPlaceholdersEmpty = allPlaceholders.every(pKey => !data[pKey]);
             if (allPlaceholders.length > 0 && allPlaceholdersEmpty && section.contentPlaceholder.replace(/{{\s*[\w-]+\s*}}/g, '').trim() === '') {
                 return null;
             }
        }


        const sectionStyle: React.CSSProperties = {
          color: section.textColor || template.baseTextColor || '#000000',
          backgroundColor: section.backgroundColor || 'transparent', // Sections are transparent by default over card BG
          textAlign: section.textAlign || 'left',
          fontStyle: section.fontStyle || 'normal',
          minHeight: section.minHeight || 'auto',
          flexGrow: section.flexGrow ? 1 : 0,
        };
        
        const sectionClasses = cn(
          section.padding || 'p-0',
          section.fontSize || 'text-sm',
          section.fontWeight || 'font-normal',
          section.borderWidth, // e.g. "border-t-2"
        );
        
        if (section.borderColor) {
            sectionStyle.borderColor = section.borderColor;
        } else if (section.borderWidth && template.borderColor) {
            sectionStyle.borderColor = template.borderColor; // Use template default border color if section has border width but no specific color
        }
        if (section.borderWidth && !sectionStyle.borderStyle) {
            sectionStyle.borderStyle = 'solid'; // Default to solid if borderWidth is set
        }


        if (section.type === 'Artwork') {
          const artworkUrl = sectionContent || 'https://placehold.co/300x200.png'; // sectionContent here is the resolved URL
          return (
            <div key={section.id} className={cn("tcg-section-artwork", sectionClasses, section.flexGrow ? 'flex-grow' : '')} style={sectionStyle}>
              <Image
                src={artworkUrl}
                alt={replacePlaceholders(template.sections.find(s=>s.type === 'CardName')?.contentPlaceholder, data) || "Card artwork"}
                layout="responsive"
                width={aspectW > aspectH ? 3 : 2} // Simple aspect ratio check for width/height dominance
                height={aspectH > aspectW ? 3 : 2}
                className="object-cover w-full h-full"
                data-ai-hint={artworkHint}
              />
            </div>
          );
        }

        if (section.type === 'Divider') {
            return (
                 <div key={section.id} className={cn("tcg-section-divider", sectionClasses)} style={{...sectionStyle, height: section.minHeight || '1px', backgroundColor: section.backgroundColor || template.borderColor || '#AAAAAA'}}></div>
            );
        }
        
        // For text based sections
        // Using <pre> for rules/flavor to respect newlines, but might need adjustment for other text types.
        const Tag = (section.type === 'RulesText' || section.type === 'FlavorText') ? 'pre' : 'div';

        return (
          <Tag key={section.id} className={cn(`tcg-section-${section.type.toLowerCase()}`, sectionClasses, section.flexGrow ? 'flex-grow overflow-y-auto' : 'shrink-0')} style={sectionStyle}>
            {/* Using dangerouslySetInnerHTML for rich text/symbols can be risky if content is user-input without sanitization.
                For now, assuming placeholders are simple text. If HTML is intended in placeholders, sanitization is CRITICAL.
                A safer approach would be a mini-parser for specific syntax like {symbol_mana_R} -> <img> etc.
            */}
            {Tag === 'pre' ? sectionContent : <span className="whitespace-pre-wrap">{sectionContent}</span>}
          </Tag>
        );
      })}
    </div>
  );
}
