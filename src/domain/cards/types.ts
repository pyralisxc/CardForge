export type CardFace = 'front' | 'back';

export interface CardData {
  [key: string]: string | number | undefined;
}

export interface StoredDisplayCard {
  templateId: string;
  backingTemplateId?: string | null;
  backingData?: CardData;
  setId?: string;
  setName?: string;
  data: CardData;
  uniqueId: string;
}

export interface CardSet {
  id: string;
  name: string;
  frontTemplateId: string | null;
  backingTemplateId: string | null;
}
