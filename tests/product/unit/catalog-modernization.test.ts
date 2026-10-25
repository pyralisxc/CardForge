import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { prepareCatalogModernization } from '../../../scripts/prepare-pipeline-catalog-modernization.mjs';
import { buildStarterSetProject, buildDeterministicStarterSetPackage } from '../../../scripts/sync-pipeline-defaults.mjs';
import { CARDFORGE_USE_CASE_OPTIONS, hasRequiredPipelineClassification, normalizeSpecialtyTags, normalizeUseCaseTags } from '@/features/pipeline/lib/contentTaxonomy';
import { ControlledTaxonomySelect } from '@/features/pipeline/components/ControlledTaxonomySelect';
import { decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { TemplateThumbnail } from '@/features/card-rendering/client';
import { resolveTemplateCardFormat } from '@/domain/card-formats';
import type { TCGCardTemplate } from '@/domain/templates';
import { classifyPublishedPipelineAsset } from '@/features/pipeline/server/classifyPublishedAsset';

const classificationBoundary = vi.hoisted(() => ({ rpc: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: classificationBoundary.rpc }) }));

const read = (file: string) => JSON.parse(readFileSync(`data/pipeline-bootstrap/${file}`, 'utf8'));
const ids = ['default-name-card-theme', 'default-event-badge-theme'];
const templates = Object.fromEntries(ids.map((id) => [id, read(`templates/${id}.json`)]));
const classification = read('classification.json');
const input = () => ({
  inventory: [], classifications: classification, templates,
  formatInputs: ids.map((id) => {
    const { formatId: _format, trimWidthMm: _width, trimHeightMm: _height, ...payload } = templates[id];
    return { asset_id: id, name: payload.name, description: payload.templateDescription, source_payload: payload, submission_id: `${id}-revision`, lineage_id: `${id}-lineage`, registry_revision: null };
  }),
});

describe('catalog modernization preparation', () => {
  const unclassified = () => ({
    asset_id: 'source-backed-texture', asset_type: 'texture', source_path: 'data/texture.json',
    contributor_submission_id: '63300e01-8d07-4f22-8221-a56de17221e5',
    lineage_id: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', registry_revision: 3,
    specialty_tags: [], use_case_tags: [], submission_specialty_tags: [], submission_use_case_tags: [],
    submission_semantic_role: 'texture', submission_visual_family: 'Authored family',
    submission_variant_kind: 'treatment', submission_variant_label: 'Authored variant',
    submission_compatibility_tags: ['digital'],
  });

  it('emits current native classification guards and preserves all non-target authored metadata', async () => {
    const item = unclassified();
    const entry = prepareCatalogModernization({ ...input(), inventory: [item] }).entries[0];
    expect(entry.action).toBe('classify-discovery-metadata');
    expect(entry.request.body).toMatchObject({
      expectedSemanticRole: 'texture', semanticRole: 'texture',
      expectedVisualFamily: 'Authored family', visualFamily: 'Authored family',
      expectedVariantKind: 'treatment', variantKind: 'treatment',
      expectedVariantLabel: 'Authored variant', variantLabel: 'Authored variant',
      expectedCompatibilityTags: ['digital'], compatibilityTags: ['digital'],
    });
    classificationBoundary.rpc.mockClear();
    await classifyPublishedPipelineAsset(entry.request.body);
    expect(classificationBoundary.rpc).toHaveBeenCalledWith('cardforge_classify_published_pipeline_asset', expect.objectContaining({
      p_expected_revision: 3, p_expected_semantic_role: 'texture',
      p_expected_visual_family: 'Authored family', p_visual_family: 'Authored family',
      p_expected_variant_kind: 'treatment', p_variant_kind: 'treatment',
      p_expected_compatibility_tags: ['digital'], p_compatibility_tags: ['digital'],
    }));
  });

  it.each([
    'contributor_submission_id', 'lineage_id', 'registry_revision',
    'submission_specialty_tags', 'submission_use_case_tags', 'submission_semantic_role',
    'submission_visual_family', 'submission_variant_kind', 'submission_variant_label', 'submission_compatibility_tags',
  ])('requires an exact current %s instead of inventing a write baseline', (field) => {
    const item: Record<string, unknown> = unclassified();
    delete item[field];
    const entry = prepareCatalogModernization({ ...input(), inventory: [item] }).entries[0];
    expect(entry.action).toBe('classification-review');
    expect(entry.reason).toContain('current classification snapshot');
    expect(entry).not.toHaveProperty('request');
  });

  it.each([['business', 'business-card', 'Business Card'], ['events', 'event-badge', 'Event Badge']])('retains and displays %s classification in the shared control', (specialty, useCase, label) => {
    expect(normalizeUseCaseTags([useCase, 'invented-category'])).toEqual([useCase]);
    expect(normalizeSpecialtyTags([useCase])).toEqual([]);
    expect(hasRequiredPipelineClassification('templates', [specialty], [useCase])).toBe(true);
    expect(hasRequiredPipelineClassification('sets', [specialty], [useCase])).toBe(true);
    const markup = renderToStaticMarkup(createElement(ControlledTaxonomySelect, { label: 'Use cases', selectedIds: [useCase], options: CARDFORGE_USE_CASE_OPTIONS, onChange: () => undefined }));
    expect(markup).toContain(`Remove ${label}`);
  });
  it('preserves General resources and never replaces partially authored classification', () => {
    const source = input();
    const base = { asset_id: 'texture', asset_type: 'texture', source_path: 'data/texture.json', specialty_tags: [], use_case_tags: [] };
    const manifest = prepareCatalogModernization({ ...source, inventory: [
      { ...base, specialty_tags: ['general'] }, { ...base, specialty_tags: ['games'] },
      { ...base, use_case_tags: ['tcg'] }, { ...base, submission_specialty_tags: ['events'] },
    ] });
    expect(manifest.entries.map((entry: { action: string }) => entry.action)).toEqual(['preserve', 'classification-review', 'classification-review', 'classification-review']);
    expect(manifest.entries.every((entry: object) => !('request' in entry))).toBe(true);
  });
  it('classifies business cards and event badges through the supported shared taxonomy', () => {
    for (const item of Object.values(classification) as Array<{ specialtyTags: string[]; useCaseTags: string[] }>) {
      expect(normalizeSpecialtyTags(item.specialtyTags)).toEqual(item.specialtyTags);
      expect(normalizeUseCaseTags(item.useCaseTags)).toEqual(item.useCaseTags);
    }
    for (const id of ['default-name-card-theme', 'default-cardforge-studio-back-us-business']) {
      expect(classification[id]).toEqual({ specialtyTags: ['business'], useCaseTags: ['business-card'] });
    }
    for (const id of ['default-event-badge-theme', 'default-cardforge-studio-back-event-badge']) {
      expect(classification[id]).toEqual({ specialtyTags: ['events'], useCaseTags: ['event-badge'] });
    }
  });

  it('patches only physical format using the exact baseline payload and native revision expectation', () => {
    const source = input();
    const manifest = prepareCatalogModernization(source);
    expect(manifest.formatRevisions).toHaveLength(2);
    manifest.formatRevisions.forEach((entry, index) => {
      expect(entry.arguments.p_expected_revision).toBe(0);
      expect(entry.arguments.p_template_payload).toEqual({ ...source.formatInputs[index].source_payload, ...entry.changedFields });
      expect(entry.arguments.p_submission_key).toContain(entry.baselinePayloadSha256.slice(0, 16));
      const template = entry.arguments.p_template_payload as TCGCardTemplate;
      expect(resolveTemplateCardFormat(template).formatId).toBe(templates[entry.assetId].formatId);
      expect(renderToStaticMarkup(createElement(TemplateThumbnail, { template }))).not.toContain('NaN');
    });
  });

  it('refuses to replace an already authored physical format and emits no repeat change', () => {
    const source = input();
    source.formatInputs[0].source_payload.formatId = 'custom';
    expect(() => prepareCatalogModernization(source)).toThrow('Review the existing physical format');
    source.formatInputs.forEach((entry) => { entry.source_payload = templates[entry.asset_id]; });
    expect(prepareCatalogModernization(source).formatRevisions).toEqual([]);
  });

  it('builds the original Standard52 through the production reader with every rank/suit and editable Template', async () => {
    const definition = read('sets/standard-playing-card-deck.json');
    const project = buildStarterSetProject(definition, read(`templates/${definition.templatePath}`));
    const assets: never[] = [];
    const bytes = await buildDeterministicStarterSetPackage({ cardforgeProject: 2, project, assets, savedAt: definition.savedAt, name: definition.name, projectRevision: createHash('sha256').update(JSON.stringify({ project, assets })).digest('hex') });
    const document = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(bytes));
    expect(document.storedCards).toHaveLength(52);
    expect(new Set(document.storedCards.map((card) => card.uniqueId)).size).toBe(52);
    expect(new Set(document.storedCards.map((card) => `${card.data.Rank}${card.data.Suit}`)).size).toBe(52);
    expect(document.userTemplates[0].templateSource).toBe('user');
    expect(document.cardSets[0].organization?.tags).toHaveLength(4);
    expect(renderToStaticMarkup(createElement(TemplateThumbnail, { template: document.userTemplates[0] as TCGCardTemplate }))).not.toContain('NaN');
  });
});
