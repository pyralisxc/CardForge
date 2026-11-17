import { instantiateProjectDocumentCopy, parseProjectDocumentValue } from '@/features/project/model/projectDocument';
import { getProjectFontValue } from '@/features/project/model/projectFont';
import { describe, expect, it } from 'vitest';
import { mapProjectDocumentIdentity, type ProjectDocumentIdentityMap } from '@/features/project/model/projectDocumentIdentity';
import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';
import { normalizeProjectProductionPlan } from '@/domain/cards';

const document: ProjectDocumentV1 = {
  version: 1, cardSets: [{ id: 'portable-set', name: 'Same document' }], activeCardSetId: 'portable-set',
  userTemplates: [{ id: 'portable-template', name: 'Template', aspectRatio: '63:88', templateSource: 'user', freeformCanvas: { width: 630, height: 880, elements: [] } }],
  storedCards: [{ uniqueId: 'portable-card', setId: 'portable-set', templateId: 'portable-template', data: { title: 'portable-card' } }],
  appearanceStyles: [], exportSettings: {}, customAssets: {
    'cardforge-maker-custom-textures': [], 'cardforge-maker-custom-dividers': [], 'cardforge-maker-custom-icons': [], 'cardforge-maker-custom-images': [],
  },
};

describe('portable versus provider working document identity', () => {
  it.each(['custom-generated', 'user-provided', 'cardforge-library', 'cardforge-output', 'placeholder'] as const)('round-trips Set brief %s artwork through exact provider identity mapping', (sourceKind) => {
    const source = structuredClone(document);
    source.version = 2;
    source.customAssets['cardforge-maker-custom-images'] = [{ id: 'shared-id', name: 'Local artwork', url: 'data:image/png;base64,YQ==', kind: 'image', tileMode: 'contain', seamless: false, allowedTargets: [] }];
    source.cardSets[0].plan = { version: 1, context: 'shared-id', custom: { literalAssetId: 'shared-id' }, brief: normalizeProjectProductionPlan({ version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Cards', outputSize: { width: 63, height: 88, unit: 'mm' }, visualDirection: { summary: 'Quiet', palette: [], typography: [] }, editableFieldKeys: [], assets: [{ id: 'art', name: 'Art', kind: 'image', role: 'Face', source: sourceKind, status: 'selected', quantity: 1, assetId: 'shared-id' }] }) };
    const identities: ProjectDocumentIdentityMap = {};
    const opened = mapProjectDocumentIdentity(source, identities, 'open');
    const expected = ['custom-generated', 'user-provided'].includes(sourceKind) ? opened.customAssets['cardforge-maker-custom-images'][0].id : 'shared-id';
    expect(opened.cardSets[0].plan?.brief?.assets[0].assetId).toBe(expected);
    expect(opened.cardSets[0].plan?.context).toBe('shared-id');
    expect(opened.cardSets[0].plan?.custom).toEqual({ literalAssetId: 'shared-id' });
    expect(mapProjectDocumentIdentity(opened, identities, 'save')).toEqual(source);
    expect(source.cardSets[0].plan?.brief?.assets[0].assetId).toBe('shared-id');
  });
  it('copies prepared designs with independent identity and exact source provenance without rewriting external references', () => {
    const source = structuredClone(document);
    source.cardSets[0]!.templateIds = ['portable-template', 'external-template'];
    Object.assign(source.userTemplates[0]!, {
      templateLineageId: 'source-lineage', templateRevision: 3, templateRevisionId: 'source-revision-3',
      templateParentRevisionId: 'source-revision-2', templateContributorName: 'Original creator',
      templateOriginLineageId: 'earlier-source', templateOriginRevisionId: 'earlier-revision',
      templatePipelineContext: { schemaVersion: 1, expectedBase: {
        assetId: 'pipeline-asset', parentSubmissionId: 'source-submission', lineageId: 'source-lineage',
        baseRevisionNumber: 3, revisionHighWater: 3, parentContentVersion: 'source-content', registryContentVersion: 'source-content',
      } },
    });
    const original = structuredClone(source);
    expect(() => instantiateProjectDocumentCopy(source, (kind) => `${kind}-copied`)).toThrow(/working snapshot.*external-template/i);
    expect(source).toEqual(original);
  });
  it('isolates files with the same portable IDs while preserving references and authored values', () => {
    const source = structuredClone(document);
    source.version = 4;
    Object.assign(source.userTemplates[0]!, {
      templateLineageId: 'portable-lineage', templateRevision: 1, templateRevisionId: 'portable-revision',
      templateOriginLineageId: 'source-lineage', templateOriginRevisionId: 'source-revision',
    });
    source.cardSets[0]!.templateIds = ['portable-template'];
    const review = {
      version: 1 as const, templateId: 'portable-template', sourceLineageId: 'source-lineage',
      sourceRevisionId: 'source-revision', sourceFingerprint: 'b'.repeat(64),
      outcome: 'reviewed' as const, decisions: [{ key: 'title', decision: 'keep' as const }],
    };
    source.cardSets[0]!.updateReviews = [review];
    const first: ProjectDocumentIdentityMap = {};
    const second: ProjectDocumentIdentityMap = {};
    const a = mapProjectDocumentIdentity(source, first, 'open');
    const b = mapProjectDocumentIdentity(source, second, 'open');
    expect(a.cardSets[0]!.id).not.toBe(b.cardSets[0]!.id);
    expect(a.storedCards[0]!.templateId).toBe(a.userTemplates[0]!.id);
    expect(a.storedCards[0]!.setId).toBe(a.cardSets[0]!.id);
    expect(a.cardSets[0]!.updateReviews).toEqual([{ ...review, templateId: a.userTemplates[0]!.id }]);
    expect(a.storedCards[0]!.data.title).toBe('portable-card');
    expect(mapProjectDocumentIdentity(source, first, 'open')).toEqual(a);
    expect(mapProjectDocumentIdentity(a, first, 'save')).toEqual(source);
    const independent = instantiateProjectDocumentCopy(a, (kind) => `${kind}-copy`);
    expect(independent.cardSets[0]!.updateReviews).toEqual([{ ...review, templateId: independent.userTemplates[0]!.id }]);
    expect(independent.cardSets[0]!.updateReviews?.[0]?.sourceLineageId).toBe(review.sourceLineageId);
    expect(independent.cardSets[0]!.updateReviews?.[0]?.sourceRevisionId).toBe(review.sourceRevisionId);
    expect(independent.cardSets[0]!.updateReviews?.[0]?.templateId).not.toBe(a.cardSets[0]!.updateReviews?.[0]?.templateId);
  });

  it('refuses Update Review metadata in a pre-v4 portable document', () => {
    const legacy = structuredClone(document);
    legacy.version = 3;
    legacy.cardSets[0]!.updateReviews = [{
      version: 1, templateId: 'portable-template', sourceLineageId: 'source-lineage',
      sourceRevisionId: 'source-revision', sourceFingerprint: 'c'.repeat(64),
      outcome: 'reviewed', decisions: [{ key: 'title', decision: 'keep' }],
    }];

    expect(parseProjectDocumentValue(legacy)).toMatchObject({ success: false });
  });

  it('keeps new authored runtime entities stable after save and refresh', () => {
    const identities: ProjectDocumentIdentityMap = {};
    const local = mapProjectDocumentIdentity(document, identities, 'open');
    local.storedCards.push({ ...local.storedCards[0]!, uniqueId: 'new-runtime-card' });
    const saved = mapProjectDocumentIdentity(local, identities, 'save');
    expect(saved.cardSets[0]!.id).toBe('portable-set');
    expect(mapProjectDocumentIdentity(saved, identities, 'open')).toEqual(local);
  });

  it('does not retarget a Library asset when an unrelated local asset has the same ID', () => {
    const source = structuredClone(document);
    source.customAssets['cardforge-maker-custom-images'] = [{ id: 'shared-id', name: 'Local artwork', url: 'data:image/png;base64,YQ==', kind: 'image', tileMode: 'contain', seamless: false, allowedTargets: [] }];
    source.productionPlan = {
      version: 1, decisionMode: 'confirmed', purpose: 'Make a Set', deliverable: 'Cards',
      outputSize: { width: 63, height: 88, unit: 'mm' }, visualDirection: { summary: 'Illustrated', palette: [], typography: [] }, editableFieldKeys: [],
      assets: [{ id: 'requirement', name: 'Library art', kind: 'image', role: 'art', source: 'cardforge-library', quantity: 1, status: 'selected', assetId: 'shared-id' }],
    };
    const identities: ProjectDocumentIdentityMap = {};
    const opened = mapProjectDocumentIdentity(source, identities, 'open');
    expect(opened.customAssets['cardforge-maker-custom-images'][0].id).not.toBe('shared-id');
    expect(opened.productionPlan!.assets[0].assetId).toBe('shared-id');

    expect(mapProjectDocumentIdentity(opened, identities, 'save')).toEqual(source);
  });
});

it('isolates personal fonts and typed references in ordinary and intentional copies', () => {
  const source = structuredClone(document);
  const value = getProjectFontValue('personal-font');
  source.customFonts = [{ id: 'personal-font', value, name: 'Font', mimeType: 'font/woff2', dataUrl: 'data:font/woff2;base64,AA==', fileSizeBytes: 1 }];
  source.userTemplates[0]!.fieldContracts = [{ key: 'title', fontFamily: value, defaultValue: value }];
  const identities: ProjectDocumentIdentityMap = {};
  const first = mapProjectDocumentIdentity(source, identities, 'open');
  const second = mapProjectDocumentIdentity(source, {}, 'open');
  expect(first.customFonts![0]!.id).not.toBe(second.customFonts![0]!.id);
  expect(first.userTemplates[0]!.fieldContracts![0]!.fontFamily).toBe(first.customFonts![0]!.value);
  expect(first.userTemplates[0]!.fieldContracts![0]!.defaultValue).toBe(value);
  expect(mapProjectDocumentIdentity(first, identities, 'save')).toEqual(source);
  const copy = instantiateProjectDocumentCopy(source, () => crypto.randomUUID());
  expect(copy.customFonts![0]!.id).not.toBe('personal-font');
  expect(copy.userTemplates[0]!.fieldContracts![0]!.fontFamily).toBe(copy.customFonts![0]!.value);
});
