import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { prepareCatalogModernization } from '../../../scripts/prepare-pipeline-catalog-modernization.mjs';
import { buildStarterSetProject, buildDeterministicStarterSetPackage } from '../../../scripts/sync-pipeline-defaults.mjs';
import { normalizeSpecialtyTags, normalizeUseCaseTags } from '@/features/pipeline/lib/contentTaxonomy';
import { decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { TemplateThumbnail } from '@/features/card-rendering/client';
import { resolveTemplateCardFormat } from '@/domain/card-formats';
import type { TCGCardTemplate } from '@/domain/templates';

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
  it('uses only supported taxonomy and leaves unsupported badge/business use cases explicit', () => {
    for (const item of Object.values(classification) as Array<{ specialtyTags: string[]; useCaseTags: string[] }>) {
      expect(normalizeSpecialtyTags(item.specialtyTags)).toEqual(item.specialtyTags);
      expect(normalizeUseCaseTags(item.useCaseTags)).toEqual(item.useCaseTags);
    }
    expect(classification['default-name-card-theme'].useCaseTags).toEqual([]);
    expect(classification['default-event-badge-theme'].reviewReason).toContain('badge');
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
