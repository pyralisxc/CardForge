import type { TCGCardTemplate } from '@/domain/templates';
import { reconstructMinimalTemplate } from '@/domain/templates';
import { readProjectPreference, removeProjectPreference, writeProjectPreference } from '@/features/project/client/persistence-preferences';

export const TEMPLATE_EDITOR_DRAFT_STORAGE_KEY = 'cardforge-template-editor-draft-v1';

export const readTemplateEditorDraft = async (): Promise<TCGCardTemplate | null> => {
  try {
    const draft = await readProjectPreference<TCGCardTemplate>(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY);
    return draft ? reconstructMinimalTemplate(draft) : null;
  } catch {
    return null;
  }
};

export const writeTemplateEditorDraft = async (template: TCGCardTemplate): Promise<void> => {
  try {
    await writeProjectPreference(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY, reconstructMinimalTemplate(template));
  } catch {
    // Draft persistence should never block editing.
  }
};

export const clearTemplateEditorDraft = async (): Promise<void> => {
  try {
    await removeProjectPreference(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY);
  } catch {
    // Draft persistence should never block editing.
  }
};
