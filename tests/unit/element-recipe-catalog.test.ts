import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AppearanceStylePreset } from '@/domain/templates';
import { createRecipesFromAppearanceStyles } from '@/features/template-editor/lib/elementPresetRecipes';

describe('element recipe catalog', () => {
  it('loads one unique, usable repository catalog for Studio and pipeline sync', async () => {
    const source = JSON.parse(await readFile(
      path.join(process.cwd(), 'data', 'styles', 'element-recipes.json'),
      'utf8',
    )) as { version: number; styles: AppearanceStylePreset[] };

    expect(source.version).toBe(1);
    expect(source.styles).toHaveLength(25);
    expect(new Set(source.styles.map((style) => style.id)).size).toBe(source.styles.length);

    const recipes = createRecipesFromAppearanceStyles(source.styles);
    expect(recipes).toHaveLength(source.styles.length);
    expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(recipes.length);
    expect(new Set(recipes.map((recipe) => recipe.kind))).toEqual(new Set([
      'shapeRole',
      'borderTreatment',
      'dividerRecipe',
      'iconStyle',
    ]));
  });
});
