
export interface TCGCardTemplate {
  id: string;
  name: string; // Template name, e.g., "Blue Creature Standard Frame"

  // Placeholders for card content
  cardNamePlaceholder?: string; // e.g., "{{cardName}}"
  manaCostPlaceholder?: string; // e.g., "{{manaCost}}" (text like "2UU" or "RRR")
  artworkUrlPlaceholder?: string; // URL for default/placeholder artwork
  cardTypeLinePlaceholder?: string; // e.g., "Creature - {{subType}}" or "Instant"
  rulesTextPlaceholder?: string;  // e.g., "{{ability1}}\n{{ability2}}"
  flavorTextPlaceholder?: string; // e.g., "{{flavorText}}"
  powerToughnessPlaceholder?: string; // e.g., "{{power}}/{{toughness}}"
  rarityPlaceholder?: string; // e.g., "{{rarity}}" (Could be C, U, R, M or a color indicator)
  artistCreditPlaceholder?: string; // e.g., "Illus. {{artistName}}"
  
  // Basic styling - more complex frames would require more fields or different approach
  frameColor?: string; // A dominant color for the card frame, e.g., blue, black, green
  borderColor?: string; // Border color around art, text boxes
  baseBackgroundColor?: string; // Fallback background if no complex frame
  baseTextColor?: string; // Default text color
  aspectRatio: string; // Should be fixed for TCGs, e.g., "5:7"
}

export interface CardData {
  // Flexible structure for variable replacement
  // e.g., { cardName: "Goblin Raider", manaCost: "1R", power: "2", toughness: "1", subType: "Goblin Warrior" }
  [key: string]: string | number;
}

// GeneratedCard remains the same structure
export interface GeneratedCard extends CardData {
  id: string; 
}

export interface PaperSize {
  name: string;
  widthMm: number; // Paper width in millimeters
  heightMm: number; // Paper height in millimeters
}

// Represents a card to be displayed, combining template and specific data
export interface DisplayCard {
  template: TCGCardTemplate; // Changed to TCGCardTemplate
  data: CardData;
  uniqueId: string; // For React keys
}
