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

  it('keeps pictures, foundations, and professional border overlays as explicit image destinations', () => {
    expect(getDefaultStudioAssetDestinations({ kind: 'image' })).toEqual(['image.picture']);
    expect(getDefaultStudioAssetDestinations({
      kind: 'image',
      metadata: { studioDefaultDestination: 'image.border.front' },
    })).toEqual(['image.border.front']);
    expect(getCompatibleStudioAssetDestinations({ kind: 'image' })).toEqual([
      'image.picture',
      'image.frame.front',
      'image.frame.back',
      'image.border.front',
      'image.border.back',
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
      'image.border.front',
    ])).toEqual(['element.icon', 'image.border.front']);
  });
});
