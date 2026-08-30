import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CARDFORGE_SPECIALTY_OPTIONS,
  CARDFORGE_USE_CASE_OPTIONS,
  normalizeContentTaxonomyTags,
  normalizeSpecialtyTags,
  normalizeUseCaseTags,
} from '@/features/pipeline/lib/contentTaxonomy';
import { getPipelineStudioDestinationOptions } from '@/features/pipeline/lib/pipelineAssetTaxonomy';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('professional border pipeline and canonical taxonomy', () => {
  it('keeps contributor tags inside CardForge-controlled vocabularies', () => {
    expect(CARDFORGE_SPECIALTY_OPTIONS.map((option) => option.id)).toContain('games');
    expect(CARDFORGE_USE_CASE_OPTIONS.map((option) => option.id)).toContain('tcg');
    expect(normalizeSpecialtyTags(['games', 'invented-specialty'])).toEqual(['games']);
    expect(normalizeUseCaseTags(['tcg', 'invented-use-case'])).toEqual(['tcg']);
    expect(normalizeContentTaxonomyTags(['games', 'tcg', 'totally-made-up'])).toEqual(['games', 'tcg']);
  });

  it('routes raster/vector border artwork through dedicated image destinations rather than structural styles', () => {
    expect(getPipelineStudioDestinationOptions('imageAssets')).toEqual([
      'image.picture',
      'image.frame.front',
      'image.frame.back',
      'image.border.front',
      'image.border.back',
    ]);
  });

  it('uses controlled selectors instead of comma-separated free-form taxonomy inputs', () => {
    const rows = readSource('src/features/pipeline/components/PipelineSubmissionRows.tsx');
    expect(rows).toContain('ControlledTaxonomySelect');
    expect(rows).toContain('CARDFORGE_SPECIALTY_OPTIONS');
    expect(rows).toContain('CARDFORGE_USE_CASE_OPTIONS');
    expect(rows).not.toContain('placeholder="games, marketing"');
    expect(rows).not.toContain('placeholder="tcg, event-poster"');
  });

  it('keeps foundations below content and border overlays in the dedicated Template field', () => {
    const assetLibrary = readSource('src/features/template-editor/hooks/useTemplateAssetLibrary.ts');
    const settings = readSource('src/features/template-editor/components/TemplateSettingsPanel.tsx');
    const sidebar = readSource('src/features/template-editor/components/TemplateEditorLibrarySidebar.tsx');

    expect(assetLibrary).toContain("isRoutedTo(asset, 'image.border.front')");
    expect(assetLibrary).toContain("isRoutedTo(asset, 'image.border.back')");
    expect(settings).toContain('cardBackgroundImageUrl: asset.url');
    expect(settings).toContain("cardBorderImageSource: asset.url, frameStyle: 'custom'");
    expect(sidebar).toContain('borderAssets={currentTemplate.templateUsage');
  });

  it('renders true structural border styles separately from full-card professional overlays', () => {
    const preview = readSource('src/features/card-rendering/components/CardPreview.tsx');
    expect(preview).toContain("cardContainerStyle.borderStyle = structuralBorderStyle");
    expect(preview).toContain('data-card-border-overlay');
    expect(preview).toContain("backgroundSize: '100% 100%'");
    expect(preview).not.toContain('useImageBorderViaMultiBackground');
  });
});
