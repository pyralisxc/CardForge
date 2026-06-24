import { describe, expect, it } from 'vitest';

import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';

describe('maker template factory', () => {
  it('creates user-owned freeform templates with a blank canvas', () => {
    const template = makeNewFreeformTemplate('Draft Layout');

    expect(template.name).toBe('Draft Layout');
    expect(template.templateSource).toBe('user');
    expect(template.freeformCanvas?.elements).toEqual([]);
    expect(template.aspectRatio).toBe('63:88');
  });
});
