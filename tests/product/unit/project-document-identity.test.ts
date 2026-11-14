import { instantiateProjectDocumentCopy } from '@/features/project/model/projectDocument';
import { getProjectFontValue } from '@/features/project/model/projectFont';
import { describe, expect, it } from 'vitest';
import { mapProjectDocumentIdentity, type ProjectDocumentIdentityMap } from '@/features/project/model/projectDocumentIdentity';
import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';

const document: ProjectDocumentV1 = {
  version: 1, cardSets: [{ id: 'portable-set', name: 'Same document' }], activeCardSetId: 'portable-set',
  userTemplates: [{ id: 'portable-template', name: 'Template', aspectRatio: '63:88', templateSource: 'user', freeformCanvas: { width: 630, height: 880, elements: [] } }],
  storedCards: [{ uniqueId: 'portable-card', setId: 'portable-set', templateId: 'portable-template', data: { title: 'portable-card' } }],
  appearanceStyles: [], exportSettings: {}, customAssets: {
    'cardforge-maker-custom-textures': [], 'cardforge-maker-custom-dividers': [], 'cardforge-maker-custom-icons': [], 'cardforge-maker-custom-images': [],
  },
};

describe('portable versus provider working document identity', () => {
  it('keeps prepared designs attached to an independent copy without rewriting external references', () => {
    const source = structuredClone(document);
    source.cardSets[0]!.templateIds = ['portable-template', 'external-template'];
    const copy = instantiateProjectDocumentCopy(source, (kind) => `${kind}-copied`);
    expect(copy.cardSets[0]!.templateIds).toEqual([copy.userTemplates[0]!.id, 'external-template']);
    expect(copy.userTemplates[0]!.id).not.toBe('portable-template');
    expect(source.cardSets[0]!.templateIds).toEqual(['portable-template', 'external-template']);
  });
  it('isolates files with the same portable IDs while preserving references and authored values', () => {
    const first: ProjectDocumentIdentityMap = {};
    const second: ProjectDocumentIdentityMap = {};
    const a = mapProjectDocumentIdentity(document, first, 'open');
    const b = mapProjectDocumentIdentity(document, second, 'open');
    expect(a.cardSets[0]!.id).not.toBe(b.cardSets[0]!.id);
    expect(a.storedCards[0]!.templateId).toBe(a.userTemplates[0]!.id);
    expect(a.storedCards[0]!.setId).toBe(a.cardSets[0]!.id);
    expect(a.storedCards[0]!.data.title).toBe('portable-card');
    expect(mapProjectDocumentIdentity(document, first, 'open')).toEqual(a);
    expect(mapProjectDocumentIdentity(a, first, 'save')).toMatchObject(document);
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
