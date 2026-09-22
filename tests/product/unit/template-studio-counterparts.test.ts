import { describe, expect, it } from 'vitest';

import { reconstructMinimalTemplateObject, type AppearanceStylePreset } from '@/domain/templates';
import {
  createCompatibleFrameKitPresetRecipes,
  getAppearanceStyleStudioDestinations,
  isAppearanceStyleRoutedTo,
} from '@/features/template-editor/lib/elementPresetRecipes';

const makeStyle = (
  kind: AppearanceStylePreset['kind'],
  studioDestinations?: AppearanceStylePreset['studioDestinations'],
): AppearanceStylePreset => ({
  id: `${kind}-style`,
  name: `${kind} style`,
  kind,
  targets: ['text'],
  appearance: {},
  studioDestinations,
});

const makePublishedTemplate = ({
  id,
  formatId,
  usage,
}: {
  id: string;
  formatId: 'poker' | 'ttrpg-reference';
  usage?: 'standard' | 'back-preset';
}) => reconstructMinimalTemplateObject({
  id,
  name: id,
  formatId,
  templateUsage: usage,
  templateRegistryStatus: 'published',
  cardBackgroundImageUrl: `https://assets.example/${id}.webp`,
});

describe('Template Studio Pipeline counterparts', () => {
  it('uses the explicit Studio destination before the style kind fallback', () => {
    const defaultBorder = makeStyle('border');
    const ownerRoutedBorder = makeStyle('border', ['style.material']);

    expect(getAppearanceStyleStudioDestinations(defaultBorder)).toEqual(['style.border']);
    expect(isAppearanceStyleRoutedTo(defaultBorder, 'style.border')).toBe(true);
    expect(isAppearanceStyleRoutedTo(defaultBorder, 'style.material')).toBe(false);
    expect(isAppearanceStyleRoutedTo(ownerRoutedBorder, 'style.material')).toBe(true);
    expect(isAppearanceStyleRoutedTo(ownerRoutedBorder, 'style.border')).toBe(false);
  });

  it('offers card treatments only from the same face and physical format', () => {
    const pokerFront = makePublishedTemplate({ id: 'poker-front', formatId: 'poker' });
    const alternatePokerFront = makePublishedTemplate({ id: 'alternate-poker-front', formatId: 'poker' });
    const ttrpgFront = makePublishedTemplate({ id: 'ttrpg-front', formatId: 'ttrpg-reference' });
    const pokerBack = makePublishedTemplate({ id: 'poker-back', formatId: 'poker', usage: 'back-preset' });

    expect(createCompatibleFrameKitPresetRecipes([
      pokerFront,
      alternatePokerFront,
      ttrpgFront,
      pokerBack,
    ], pokerFront).map((recipe) => recipe.label)).toEqual([
      'poker-front',
      'alternate-poker-front',
    ]);

    expect(createCompatibleFrameKitPresetRecipes([
      pokerFront,
      alternatePokerFront,
      ttrpgFront,
      pokerBack,
    ], pokerBack).map((recipe) => recipe.label)).toEqual(['poker-back']);
  });
});
