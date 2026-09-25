import { describe, expect, it } from 'vitest';

import { deriveEnvironmentPresentation } from '@/features/app-shell/environment/model';

describe('Environment presentation', () => {
  it('derives Browse and Focus from the product-owned focus depth', () => {
    expect(deriveEnvironmentPresentation({ focusDepth: 'zone' })).toEqual({
      mode: 'browse',
      focusDepth: 'zone',
    });
    expect(deriveEnvironmentPresentation({ focusDepth: 'set' })).toEqual({
      mode: 'focus',
      focusDepth: 'set',
    });
    expect(deriveEnvironmentPresentation({ focusDepth: 'object' })).toEqual({
      mode: 'focus',
      focusDepth: 'object',
    });
  });

  it('projects Edit and Task without replacing the underlying product context', () => {
    expect(deriveEnvironmentPresentation({ focusDepth: 'artifact', activity: 'edit' })).toEqual({
      mode: 'edit',
      focusDepth: 'artifact',
    });
    expect(deriveEnvironmentPresentation({ focusDepth: 'tool', activity: 'task' })).toEqual({
      mode: 'task',
      focusDepth: 'tool',
    });
  });
});
