
"use client";

import type { TCGCardTemplate, CardData } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CardPreviewProps {
  template: TCGCardTemplate;
  data: CardData;
  className?: string;
  isPrintMode?: boolean;
}

function replacePlaceholders(text: string | undefined, data: CardData): string {
  if (!text) return '';
  let result = text;
  // First, replace known data fields
  for (const key in data) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"), 'g'), String(data[key]));
  }
  // Remove any unreplaced placeholders (e.g. {{unfilledValue}})
  result = result.replace(/{{\s*[\w-]+\s*}}/g, '');
  return result;
}

export function CardPreview({ template, data, className, isPrintMode = false }: CardPreviewProps) {
  const [aspectW, aspectH] = template.aspectRatio.split(':').map(Number);

  // Fallbacks for new specific colors to existing general colors
  const nameColor = template.nameTextColor || template.baseTextColor || '#000000';
  const costColor = template.costTextColor || template.baseTextColor || '#000000';
  const typeLineColor = template.typeLineTextColor || template.baseTextColor || '#000000';
  const rulesColor = template.rulesTextColor || template.baseTextColor || '#000000';
  const flavorColor = template.flavorTextColor || template.rulesTextColor || template.baseTextColor || '#333333'; // Flavor often slightly different
  const ptColor = template.ptTextColor || template.baseTextColor || '#000000';
  
  const artBg = template.artBoxBackgroundColor || template.baseBackgroundColor || '#CCCCCC'; // Default artbox bg
  const textBg = template.textBoxBackgroundColor || template.baseBackgroundColor || '#FFFFFF'; // Default textbox bg
  const cardBodyBg = template.baseBackgroundColor || '#FFFFFF';


  const containerStyle: React.CSSProperties = {
    backgroundColor: cardBodyBg,
    color: template.baseTextColor || '#000000',
    aspectRatio: `${aspectW} / ${aspectH}`,
    width: isPrintMode ? '100%' : '250px',
    height: isPrintMode ? '100%' : 'auto',
    border: `4px solid ${template.frameColor || 'grey'}`,
    boxSizing: 'border-box',
  };
  
  const cardName = replacePlaceholders(template.cardNamePlaceholder, data);
  const manaCost = replacePlaceholders(template.manaCostPlaceholder, data);
  const artworkUrl = data.artworkUrl as string || template.artworkUrlPlaceholder || 'https://placehold.co/375x275.png';
  const cardTypeLine = replacePlaceholders(template.cardTypeLinePlaceholder, data);
  const rulesText = replacePlaceholders(template.rulesTextPlaceholder, data);
  const flavorText = replacePlaceholders(template.flavorTextPlaceholder, data);
  const powerToughness = replacePlaceholders(template.powerToughnessPlaceholder, data);
  const rarity = replacePlaceholders(template.rarityPlaceholder, data);
  const artistCredit = replacePlaceholders(template.artistCreditPlaceholder, data);

  const artworkHint = (cardTypeLine.toLowerCase().includes("creature") ? "fantasy creature" : cardTypeLine.toLowerCase().includes("spell") || cardTypeLine.toLowerCase().includes("instant") ? "spell effect" : "fantasy item") || "card art";


  return (
    <div
      className={cn(
        "tcg-card-preview shadow-lg rounded-lg flex flex-col relative overflow-hidden",
        isPrintMode ? "card-preview-print" : "",
        className
      )}
      style={containerStyle}
      data-ai-hint="tcg card"
    >
      {/* Header: Name and Mana Cost */}
      <div className="tcg-header flex justify-between items-center p-1.5 sm:p-2" style={{ backgroundColor: template.frameColor, borderBottom: `2px solid ${template.borderColor || template.frameColor}` }}>
        <h3 className="tcg-card-name font-bold text-sm sm:text-base leading-tight truncate" style={{ color: nameColor }}>{cardName || "Card Name"}</h3>
        {manaCost && <span className="tcg-mana-cost text-xs sm:text-sm font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: cardBodyBg, color: costColor, border: `1px solid ${template.borderColor || template.frameColor}` }}>{manaCost}</span>}
      </div>

      {/* Artwork */}
      <div className="tcg-artwork-area flex-grow m-1.5 sm:m-2" style={{ backgroundColor: artBg, borderColor: template.borderColor || template.frameColor, borderWidth: '2px', borderStyle: 'solid', minHeight: '100px' }}>
        <Image
          src={artworkUrl}
          alt={cardName || "Card artwork"}
          layout="responsive"
          width={375}
          height={275}
          className="object-cover w-full h-full"
          data-ai-hint={artworkHint}
        />
      </div>

      {/* Type Line */}
      <div className="tcg-type-line-box p-1.5 sm:p-2 text-xs sm:text-sm font-semibold" style={{ backgroundColor: template.frameColor, color: typeLineColor, borderTop: `2px solid ${template.borderColor || template.frameColor}`, borderBottom: `2px solid ${template.borderColor || template.frameColor}` }}>
        <p className="tcg-type-line truncate">{cardTypeLine || "Card Type"}</p>
      </div>

      {/* Rules Text Box */}
      <div className="tcg-text-box flex-grow p-1.5 sm:p-2 text-xs sm:text-[10px] leading-snug overflow-y-auto space-y-1 m-1.5 sm:m-2" style={{ backgroundColor: textBg, border: `2px solid ${template.borderColor || template.frameColor}`, minHeight: '60px' }}>
        {rulesText && <pre className="tcg-rules-text whitespace-pre-wrap font-sans" style={{ color: rulesColor }}>{rulesText}</pre>}
        {flavorText && <pre className="tcg-flavor-text italic whitespace-pre-wrap font-sans pt-1 border-t border-dashed" style={{ borderColor: template.borderColor || template.frameColor, color: flavorColor }}>{flavorText}</pre>}
      </div>
      
      {/* Footer: P/T, Rarity, Artist */}
      <div className="tcg-footer flex justify-between items-end p-1.5 sm:p-2 text-[9px] sm:text-xs" style={{ color: template.baseTextColor, borderTop: `2px solid ${template.borderColor || template.frameColor}` }}>
        <div className="tcg-artist-rarity space-x-2">
            {artistCredit && <span className="tcg-artist">{artistCredit}</span>}
            {rarity && <span className="tcg-rarity">({rarity})</span>}
        </div>
        {powerToughness && powerToughness.trim() !== "/" && powerToughness.trim() !== "" && (
          <div className="tcg-pt-box font-bold text-sm sm:text-base px-2 py-0.5 rounded" style={{ backgroundColor: template.frameColor, color: ptColor, border: `1px solid ${template.borderColor || template.frameColor}`}}>
            <span className="tcg-pt">{powerToughness}</span>
          </div>
        )}
      </div>
    </div>
  );
}
