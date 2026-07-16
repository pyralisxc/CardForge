import type { TCGCardTemplate } from '@/domain/templates';
import { reconstructMinimalTemplate } from '@/lib/templateModel';

export const TEMPLATE_EDITOR_DRAFT_STORAGE_KEY = 'cardforge-template-editor-draft-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const readTemplateEditorDraft = (storage: StorageLike): TCGCardTemplate | null => {
  try {
    const raw = storage.getItem(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return reconstructMinimalTemplate(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeTemplateEditorDraft = (storage: StorageLike, template: TCGCardTemplate): void => {
  try {
    storage.setItem(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(reconstructMinimalTemplate(template)));
  } catch {
    // Draft persistence should never block editing.
  }
};

export const clearTemplateEditorDraft = (storage: StorageLike): void => {
  try {
    storage.removeItem(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY);
  } catch {
    // Draft persistence should never block editing.
  }
};
