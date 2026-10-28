import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppearanceStylePreset } from '@/domain/templates';
import { isRepositoryStyle } from '@/features/pipeline/lib/registryContentValidation';
import { readRegistryContentAsset } from '@/features/pipeline/lib/registryContentAssets';
import { createRecipesFromAppearanceStyles } from '@/features/template-editor/lib/elementPresetRecipes';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
  getSupabaseServerConfigStatus: () => ({ configured: false }),
}));
afterEach(() => vi.unstubAllGlobals());

describe('element recipe catalog', () => {
  const validStyle = { id: 'valid', name: 'Valid', kind: 'material', targets: ['shape'], appearance: {} };
  it.each(['\t', '\n', '\u00a0'])('rejects whitespace-only identity before registry fallback (%j)', async (blank) => {
    const dependent = { ...validStyle, appearance: { assetSource: 'actual-target' } };
    const invalidCandidates = [
      { ...validStyle, id: blank }, { ...validStyle, name: blank },
      { ...validStyle, appearance: { material: { gradient: { type: 'linear', stops: [{ id: blank, color: '#fff', position: 0 }] } } } },
    ];
    for (const invalid of invalidCandidates) {
      expect(isRepositoryStyle(invalid)).toBe(false);
      expect(await readRegistryContentAsset({
        asset_id: 'consumer', name: 'Consumer', url: 'https://example.invalid/unused',
        content_payload: invalid, metadata: { style: invalid, elementPreset: dependent },
      }, ['style', 'elementPreset', 'payload'], isRepositoryStyle)).toEqual(dependent);
    }
  });
  it('uses external fallback after whitespace-invalid source/aliases; native inspection must stay opaque', async () => {
    const dependent = { ...validStyle, appearance: { assetSource: 'actual-target' } };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => dependent });
    vi.stubGlobal('fetch', fetch);
    const invalid = { ...validStyle, id: '\t' };
    expect(await readRegistryContentAsset({
      asset_id: 'consumer', name: 'Consumer', url: 'https://example.invalid/fallback.json',
      content_payload: invalid, metadata: { style: invalid },
    }, ['style', 'elementPreset', 'payload'], isRepositoryStyle)).toEqual(dependent);
    expect(fetch).toHaveBeenCalledWith('https://example.invalid/fallback.json', { cache: 'no-store' });
  });

  it('loads one unique, usable repository catalog for Studio and pipeline sync', async () => {
    const source = JSON.parse(await readFile(
      path.join(process.cwd(), 'data', 'pipeline-bootstrap', 'recipes', 'element-recipes.json'),
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

  it('recognizes the text-frame recipes already owned by the live Pipeline contract', () => {
    expect(isRepositoryStyle({
      id: 'text-frame-rules',
      name: 'Rules Frame',
      kind: 'textFrame',
      targets: ['text'],
      appearance: { material: { baseColor: '#17100b' } },
    })).toBe(true);
    expect(isRepositoryStyle({
      id: 'unknown-recipe',
      name: 'Unknown',
      kind: 'mystery',
      targets: ['text'],
      appearance: {},
    })).toBe(false);
    expect(isRepositoryStyle({
      id: 'broken-gradient',
      name: 'Broken Gradient',
      kind: 'material',
      targets: ['element'],
      appearance: { material: { gradient: { type: 'linear', stops: 'not-an-array' } } },
    })).toBe(false);
  });
});
