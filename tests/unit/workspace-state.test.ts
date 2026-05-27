import { describe, expect, it } from 'vitest';

import {
  getGeneratorSelectedTemplateId,
  splitTemplatesForWorkspace,
} from '@/features/app-shell/lib/workspaceState';
import type { TCGCardTemplate } from '@/types';

const makeTemplate = (id: string, overrides: Partial<TCGCardTemplate> = {}): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  ...overrides,
});

describe('workspace state helpers', () => {
  it('splits default templates, back presets, and generator-safe templates', () => {
    const defaultTemplate = makeTemplate('default-card', { templateSource: 'default' });
    const backPreset = makeTemplate('back-preset', { templateSource: 'default', templateUsage: 'back-preset' });
    const userTemplate = makeTemplate('user-card', { templateSource: 'user' });

    const groups = splitTemplatesForWorkspace({
      defaultTemplates: [defaultTemplate, backPreset],
      allTemplates: [defaultTemplate, backPreset, userTemplate],
    });

    expect(groups.standardDefaultTemplates).toEqual([defaultTemplate]);
    expect(groups.backFacePresetTemplates).toEqual([backPreset]);
    expect(groups.freeformTemplatesForGenerator).toEqual([defaultTemplate, userTemplate]);
  });

  it('keeps the selected generator template when it is still available', () => {
    const selectedId = getGeneratorSelectedTemplateId(
      [makeTemplate('first'), makeTemplate('selected')],
      'selected',
    );

    expect(selectedId).toBe('selected');
  });

  it('falls back to the first generator-safe template when the selection is unavailable', () => {
    const selectedId = getGeneratorSelectedTemplateId(
      [makeTemplate('first'), makeTemplate('second')],
      'missing',
    );

    expect(selectedId).toBe('first');
  });

  it('returns null when no generator-safe templates exist', () => {
    expect(getGeneratorSelectedTemplateId([], 'missing')).toBeNull();
  });
});
