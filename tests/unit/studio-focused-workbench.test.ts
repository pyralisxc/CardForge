import { describe, expect, it } from 'vitest';

import { normalizeStudioView } from '@/features/project/store/workspaceDefaults';

describe('Studio focused workbench compatibility', () => {
  it('translates retired destinations into the two current authoring tools', () => {
    expect(normalizeStudioView('sets')).toBe('generate');
    expect(normalizeStudioView('desk')).toBe('generate');
    expect(normalizeStudioView('template-maker')).toBe('template');
    expect(normalizeStudioView('generator')).toBe('generate');
    expect(normalizeStudioView('unknown')).toBe('template');
  });
});
