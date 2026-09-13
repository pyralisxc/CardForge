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

/**
 * Portable authored organization for a Set. These labels describe the work;
 * they never carry permissions, publication authority, or a storage binding.
 */
export type CardSetWorkflow = 'card-set';

export interface CardSetMetadata {
  /** The shipped authoring workflow that owns the Set. */
  workflow: CardSetWorkflow;
  /** A built-in descriptive type or a creator-defined label such as “Postcards”. */
  type?: string;
  /** Personal, portable labels for this Set only. They do not cascade to cards. */
  tags: string[];
}

export const CARD_SET_BUILT_IN_TYPES = [
  'Card set',
  'Playing deck',
  'Reference deck',
  'Trading card set',
] as const;

export interface CardSet {
  id: string;
  name: string;
  /**
   * Reusable Templates intentionally participating in this Set. The Set
   * references these identities but does not own or clone them. This lets a
   * creator prepare designs before generating the first Artifact and lets a
   * portable Set snapshot include those exact design dependencies.
   */
  templateIds?: string[];
  organization?: CardSetOrganization;
  metadata?: CardSetMetadata;
}
