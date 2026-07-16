import type { CardData } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';

export interface DisplayCard {
  template: TCGCardTemplate;
  backingTemplateId?: string | null;
  backingTemplate?: TCGCardTemplate | null;
  setId?: string;
  setName?: string;
  data: CardData;
  uniqueId: string;
}

export type PdfDuplexLayout = 'separate-pages' | 'same-page';
export type ExportMode = 'physical' | 'virtual';

export interface PaperSize {
  name: string;
  widthMm: number;
  heightMm: number;
}
