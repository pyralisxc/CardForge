import { describe, expect, it } from 'vitest';
import type { TCGCardTemplate } from '@/types';
import { prepareTemplateForLibrarySave } from '@/features/template-library/hooks/useTemplateLibraryActions';

const defaultTemplate: TCGCardTemplate = {
  id: 'default-template',
  name: 'Default Template',
  templateSource: 'default',
  aspectRatio: '63:88',
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [],
  },
};

describe('template library actions', () => {
  it('saves paid-user edits to shipped templates as personal-library copies', () => {
    const prepared = prepareTemplateForLibrarySave(defaultTemplate, false, () => 'personal-copy');

    expect(prepared).toMatchObject({
      id: 'personal-copy',
      name: 'Default Template',
      templateSource: 'user',
      templateLibrarySource: 'personal',
    });
    expect(defaultTemplate).toMatchObject({
      id: 'default-template',
      templateSource: 'default',
    });
  });

  it('keeps shipped-template saves in the default lane for library writers', () => {
    const prepared = prepareTemplateForLibrarySave(defaultTemplate, true, () => 'personal-copy');

    expect(prepared).toMatchObject({
      id: 'default-template',
      templateSource: 'default',
    });
  });

  it('keeps personal templates in the personal-library lane', () => {
    const userTemplate = { ...defaultTemplate, id: 'user-template', templateSource: 'user' as const };
    const prepared = prepareTemplateForLibrarySave(userTemplate, false, () => 'unused-copy');

    expect(prepared).toMatchObject({
      id: 'user-template',
      templateSource: 'user',
      templateLibrarySource: 'personal',
    });
  });
});
