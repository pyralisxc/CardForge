import { describe, expect, it } from 'vitest';

import {
  BLANK_SHAPE_PRIMITIVES,
  BORDER_PRESET_RECIPES,
  DIVIDER_PRESET_RECIPES,
  ICON_STYLE_PRESET_RECIPES,
  SHAPE_ROLE_PRESET_RECIPES,
  TEXT_FRAME_PRESET_RECIPES,
  buildElementPresetElementUpdates,
  createRecipesFromAppearanceStyles,
  isElementPresetApplicable,
  mergeElementPresetRecipes,
} from '@/lib/elementPresetRecipes';
import type { FreeformCardElement } from '@/types';

const baseShape: FreeformCardElement = {
  id: 'shape-1',
  type: 'shape',
  name: 'Shape',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  zIndex: 1,
  shapeKind: 'rectangle',
  shapeRole: 'basic',
};

describe('element preset recipes', () => {
  it('keeps blank primitives as local shape tools with no pipeline contributor metadata', () => {
    expect(BLANK_SHAPE_PRIMITIVES.map((primitive) => primitive.value)).toEqual([
      'rectangle',
      'ellipse',
      'capsule',
      'diamond',
      'hexagon',
      'banner',
      'notch-panel',
      'bracket-frame',
      'corner-frame',
      'line',
    ]);
    expect(BLANK_SHAPE_PRIMITIVES.every((primitive) => primitive.updates.shapeRole === 'basic' || primitive.updates.shapeRole === 'divider')).toBe(true);
    expect(BLANK_SHAPE_PRIMITIVES.every((primitive) => primitive.updates.appearance === undefined)).toBe(true);
  });

  it('marks shape role recipes as starter pipeline presets', () => {
    expect(SHAPE_ROLE_PRESET_RECIPES).toHaveLength(6);
    expect(SHAPE_ROLE_PRESET_RECIPES.every((preset) => preset.kind === 'shapeRole')).toBe(true);
    expect(SHAPE_ROLE_PRESET_RECIPES.every((preset) => preset.status === 'published')).toBe(true);
    expect(SHAPE_ROLE_PRESET_RECIPES.every((preset) => preset.tier === 'free')).toBe(true);
    expect(SHAPE_ROLE_PRESET_RECIPES.every((preset) => preset.source === 'developer-pipeline')).toBe(true);
    expect(SHAPE_ROLE_PRESET_RECIPES.every((preset) => preset.contributorName === 'Cameron Locke')).toBe(true);
  });

  it('converts major preset families into typed pipeline recipes', () => {
    expect(TEXT_FRAME_PRESET_RECIPES.every((preset) => preset.kind === 'textFrame')).toBe(true);
    expect(BORDER_PRESET_RECIPES.every((preset) => preset.kind === 'borderTreatment')).toBe(true);
    expect(ICON_STYLE_PRESET_RECIPES.every((preset) => preset.kind === 'iconStyle')).toBe(true);
    expect(DIVIDER_PRESET_RECIPES.every((preset) => preset.kind === 'dividerRecipe')).toBe(true);
    expect([
      ...TEXT_FRAME_PRESET_RECIPES,
      ...BORDER_PRESET_RECIPES,
      ...ICON_STYLE_PRESET_RECIPES,
      ...DIVIDER_PRESET_RECIPES,
    ].every((preset) => preset.contributorName && preset.status && preset.tier && preset.appliesTo.surfaces.length > 0)).toBe(true);
  });

  it('filters pipeline recipes by element type while allowing shape recipes to replace existing roles', () => {
    const panelRecipe = SHAPE_ROLE_PRESET_RECIPES.find((preset) => preset.id === 'shape-role-panel');
    expect(panelRecipe).toBeDefined();

    expect(isElementPresetApplicable(panelRecipe!, baseShape)).toBe(true);
    expect(isElementPresetApplicable(panelRecipe!, { ...baseShape, shapeRole: 'statGem' })).toBe(true);
    expect(isElementPresetApplicable(panelRecipe!, { ...baseShape, type: 'text' })).toBe(false);
  });

  it('hydrates registry appearance styles into typed recipes', () => {
    const [recipe] = createRecipesFromAppearanceStyles([{
      id: 'developer-frame',
      name: 'Developer Frame',
      kind: 'textFrame',
      targets: ['text'],
      appearance: {
        material: { baseColor: '#123456', textColor: '#ffffff' },
        border: { kind: 'solid', color: '#abcdef', width: 2, radius: 6 },
      },
    }]);

    expect(recipe).toMatchObject({
      id: 'style-developer-frame',
      label: 'Developer Frame',
      kind: 'textFrame',
      source: 'registry-style',
      contributorName: 'Cameron Locke',
      preview: { background: '#123456', borderColor: '#abcdef' },
    });
    expect(isElementPresetApplicable(recipe, { ...baseShape, type: 'text' })).toBe(true);
  });

  it('dedupes seeded and registry recipes by kind and label while preferring registry-backed assets', () => {
    const [registryRecipe] = createRecipesFromAppearanceStyles([{
      id: 'frame-mtg-rules',
      name: 'MTG Rules Frame',
      kind: 'textFrame',
      targets: ['text'],
      appearance: {
        material: { baseColor: '#123456', textColor: '#ffffff' },
        border: { kind: 'solid', color: '#abcdef', width: 2, radius: 6 },
      },
    }]);
    const seededRecipe = TEXT_FRAME_PRESET_RECIPES.find((preset) => preset.label === 'MTG Rules Frame');
    expect(seededRecipe).toBeDefined();

    const merged = mergeElementPresetRecipes([seededRecipe!], [registryRecipe]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('style-frame-mtg-rules');
    expect(merged[0].source).toBe('registry-style');
  });

  it('does not wipe uploaded icon art when applying an icon style recipe', () => {
    const fireRecipe = ICON_STYLE_PRESET_RECIPES.find((preset) => preset.id === 'icon-style-fire');
    expect(fireRecipe).toBeDefined();

    const updates = buildElementPresetElementUpdates(fireRecipe!, {
      ...baseShape,
      type: 'icon',
      iconImageSource: 'data:image/svg+xml;base64,custom',
      iconName: undefined,
    });

    expect(updates.iconImageSource).toBeUndefined();
    expect(updates.iconName).toBeUndefined();
    expect(updates.strokeColor).toBe('#ffb35f');
    expect(updates.backgroundColor).toBe('#210b06');
  });

  it('applies border treatment recipes as structured element-aware edge styling', () => {
    const relicRecipe = BORDER_PRESET_RECIPES.find((preset) => preset.id === 'border-heavy-relic');
    expect(relicRecipe).toBeDefined();

    const iconUpdates = buildElementPresetElementUpdates(relicRecipe!, {
      ...baseShape,
      type: 'icon',
      strokeColor: '#abcdef',
      strokeWidth: 2,
    });
    const shapeUpdates = buildElementPresetElementUpdates(relicRecipe!, {
      ...baseShape,
      type: 'shape',
      strokeColor: '#abcdef',
      strokeWidth: 2,
    });

    expect(iconUpdates.appearance?.border?.kind).toBe('relic');
    expect(iconUpdates.strokeColor).toBe('#abcdef');
    expect(iconUpdates.strokeWidth).toBe(2);
    expect(shapeUpdates.appearance?.border?.kind).toBe('relic');
    expect(shapeUpdates.strokeColor).toBe('#9f742a');
    expect(shapeUpdates.strokeWidth).toBe(4);
  });
});
