import { describe, expect, it } from 'vitest';

import { createDefaultFreeformCanvas, type TCGCardTemplate } from '@/domain/templates';
import { resolveTemplateEditorInitialTemplate } from '@/features/template-editor/hooks/useTemplateEditorSession';

const template = (id: string): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  templateSource: 'user',
  freeformCanvas: createDefaultFreeformCanvas(),
});

describe('template editor session resolution', () => {
  it('prioritizes a recovered draft over selected and fallback templates', () => {
    const draft = template('recovered-draft');
    expect(resolveTemplateEditorInitialTemplate({
      recoveredDraft: draft,
      selectedTemplateId: 'selected',
      templates: [template('fallback'), template('selected')],
    })).toBe(draft);
  });

  it('uses the selected template and falls back to the first available template', () => {
    const fallback = template('fallback');
    const selected = template('selected');
    expect(resolveTemplateEditorInitialTemplate({
      recoveredDraft: null,
      selectedTemplateId: selected.id,
      templates: [fallback, selected],
    }).id).toBe(selected.id);
    expect(resolveTemplateEditorInitialTemplate({
      recoveredDraft: null,
      selectedTemplateId: 'missing',
      templates: [fallback, selected],
    }).id).toBe(fallback.id);
  });
});
