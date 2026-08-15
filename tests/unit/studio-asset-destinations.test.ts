import { describe, expect, it } from 'vitest';

import {
  getCompatibleStudioAssetDestinations,
  getDefaultStudioAssetDestinations,
  normalizeStudioAssetDestinations,
} from '@/domain/templates';

describe('Studio asset destinations', () => {
  it('routes Templates by their front/back contract', () => {
    expect(getDefaultStudioAssetDestinations({
      kind: 'template',
      metadata: { template: { templateUsage: 'standard' } },
    })).toEqual(['template.front']);
    expect(getCompatibleStudioAssetDestinations({
      kind: 'template',
      metadata: { template: { templateUsage: 'back-preset' } },
    })).toEqual(['template.back']);
  });

  it('keeps pictures and full-card frames as explicit image destinations', () => {
    expect(getDefaultStudioAssetDestinations({ kind: 'image' })).toEqual(['image.picture']);
    expect(getDefaultStudioAssetDestinations({
      kind: 'image',
      metadata: { studioDefaultDestination: 'image.frame.front' },
    })).toEqual(['image.frame.front']);
    expect(getCompatibleStudioAssetDestinations({ kind: 'image' })).toEqual([
      'image.picture',
      'image.frame.front',
      'image.frame.back',
    ]);
  });

  it('routes payload-backed Styles with the same contract used by persistence', () => {
    expect(getCompatibleStudioAssetDestinations({
      kind: 'elementPreset',
      metadata: { payload: { kind: 'border' } },
    })).toEqual(['style.border']);
  });

  it('normalizes owner placement without accepting unknown shelves', () => {
    expect(normalizeStudioAssetDestinations([
      'element.icon',
      'unknown',
      'element.icon',
      'element.divider',
    ])).toEqual(['element.icon', 'element.divider']);
  });
});
