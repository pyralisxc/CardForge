import { describe, expect, it } from 'vitest';

import {
  getTemplateDisplayName,
  getTemplateLibraryDescription,
  getTemplateLibraryLabel,
  getTemplateSourceLabel,
} from '@/lib/templateDisplay';

describe('template display labels', () => {
  it('uses product-facing library labels instead of storage names', () => {
    expect(getTemplateSourceLabel({ templateSource: 'default' })).toBe('Forge Library');
    expect(getTemplateSourceLabel({ templateSource: 'user' })).toBe('Personal Library');
    expect(getTemplateLibraryLabel({ templateSource: 'default', templateLibrarySource: 'base' })).toBe('Pipeline');
    expect(getTemplateLibraryLabel({ templateSource: 'default', templateLibrarySource: 'pipeline' })).toBe('Pipeline');
    expect(getTemplateLibraryDescription({ templateSource: 'default', templateLibrarySource: 'pipeline' })).toBe('Pipeline template');
    expect(getTemplateDisplayName({ id: 'base-card', name: 'Arcane Card', templateSource: 'default', templateLibrarySource: 'base' })).toBe('Arcane Card (Pipeline template)');
  });
});
