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
  tagIds?: string[];
  updatedAt?: string;
}

export type CardSetArrangement = 'manual' | 'grid' | 'stack';
export type CardSetGrouping = 'none' | 'tag' | 'field' | 'template' | 'content-type' | 'batch';
export type CardSetSort = 'manual' | 'name' | 'field-value' | 'recently-changed';

export interface CardSetTag {
  id: string;
  label: string;
}

export interface CardSetCardPosition {
  x: number;
  y: number;
}

export interface CardSetOrganization {
  arrangement: CardSetArrangement;
  groupBy: CardSetGrouping;
  groupField?: string;
  groupTagId?: string;
  sort: CardSetSort;
  sortField?: string;
  tags: CardSetTag[];
  positions: Record<string, CardSetCardPosition>;
}

export interface CardSet {
  id: string;
  name: string;
  frontTemplateId: string | null;
  backingTemplateId: string | null;
  organization?: CardSetOrganization;
}
