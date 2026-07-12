import { describe, expect, it } from 'vitest';

import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';

describe('maker template factory', () => {
  it('creates user-owned freeform templates with a blank canvas', () => {
    const template = makeNewFreeformTemplate('Draft Layout');

    expect(template.name).toBe('Draft Layout');
    expect(template.templateSource).toBe('user');
    expect(template.templateUsage).toBe('standard');
    expect(template.freeformCanvas?.elements).toEqual([]);
    expect(template.aspectRatio).toBe('63:88');
  });

  it('creates explicit card back templates for the backing workflow', () => {
    const template = makeNewFreeformTemplate('Draft Back', 'back-preset');

    expect(template.name).toBe('Draft Back');
    expect(template.templateSource).toBe('user');
    expect(template.templateUsage).toBe('back-preset');
    expect(template.templateCategory).toBe('Card back');
    expect(template.freeformCanvas?.elements).toEqual([]);
  });
});
