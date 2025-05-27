export interface SimplifiedCardTemplate {
  id: string;
  name: string;
  titlePlaceholder?: string; // e.g., "Happy {{occasion}}"
  bodyPlaceholder?: string;  // e.g., "Dear {{name}}, ..."
  imageSrc?: string; // URL for a placeholder or default image
  imageSlot?: boolean; // True if an image can be placed by user
  aspectRatio: string; // e.g., "3:2" or "5:7" (width:height)
  backgroundColor?: string; // Optional: background color for the card itself
  textColor?: string; // Optional: default text color
}

export interface CardData {
  // Flexible structure for variable replacement
  // e.g., { name: "John", occasion: "Birthday" }
  [key: string]: string | number;
}

export interface GeneratedCard extends CardData {
  id: string; // Unique ID for the generated card instance
}

export interface PaperSize {
  name: string;
  widthMm: number; // Paper width in millimeters
  heightMm: number; // Paper height in millimeters
}

// Represents a card to be displayed, combining template and specific data
export interface DisplayCard {
  template: SimplifiedCardTemplate;
  data: CardData;
  uniqueId: string; // For React keys
}
