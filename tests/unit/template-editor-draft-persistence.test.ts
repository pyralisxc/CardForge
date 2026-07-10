import { describe, expect, it } from 'vitest';

import {
  TEMPLATE_EDITOR_DRAFT_STORAGE_KEY,
  clearTemplateEditorDraft,
  readTemplateEditorDraft,
  writeTemplateEditorDraft,
} from '@/features/template-editor/lib/templateEditorDraftPersistence';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};

describe('template editor draft persistence', () => {
  it('round-trips unsaved template progress through storage', () => {
    const storage = createMemoryStorage();
    const template = {
      ...makeNewFreeformTemplate(),
      id: 'draft-progress',
      name: 'Unsigned-in progress',
    };

    writeTemplateEditorDraft(storage, template);

    expect(readTemplateEditorDraft(storage)).toMatchObject({
      id: 'draft-progress',
      name: 'Unsigned-in progress',
    });
  });

  it('clears the autosaved draft when the editor commits or opens a template', () => {
    const storage = createMemoryStorage();
    storage.setItem(TEMPLATE_EDITOR_DRAFT_STORAGE_KEY, '{"id":"draft-progress"}');

    clearTemplateEditorDraft(storage);

    expect(readTemplateEditorDraft(storage)).toBeNull();
  });
});
