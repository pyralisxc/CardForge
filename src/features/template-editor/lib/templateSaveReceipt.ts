import type { TCGCardTemplate } from '@/domain/templates';

/** Captured by the persistence owner immediately after the local commit. */
export interface TemplateSaveReceipt {
  id: string;
  template: TCGCardTemplate | null;
}
