import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultFreeformCanvas, type TCGCardTemplate } from '@/domain/templates';
import { BROWSER_STORAGE_DATABASE } from '@/features/project/client/persistence-storage';
import {
  clearTemplateEditorDraft,
  readTemplateEditorDraft,
  writeTemplateEditorDraft,
} from '@/features/template-editor/lib/templateEditorDraftPersistence';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

const draft: TCGCardTemplate = {
  id: 'draft-persistence-test',
  name: 'Recovered Draft',
  aspectRatio: '63:88',
  templateSource: 'user',
  freeformCanvas: createDefaultFreeformCanvas(),
};

describe('template editor draft persistence', () => {
  beforeEach(deleteDatabase);

  it('recovers and clears a canonical IndexedDB draft', async () => {
    await writeTemplateEditorDraft(draft);
    await expect(readTemplateEditorDraft()).resolves.toMatchObject({
      id: draft.id,
      name: draft.name,
      templateSource: 'user',
    });

    await clearTemplateEditorDraft();
    await expect(readTemplateEditorDraft()).resolves.toBeNull();
  });
});
