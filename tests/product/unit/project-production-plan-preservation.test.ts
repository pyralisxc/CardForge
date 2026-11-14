import { expect, it } from 'vitest';
import { createProjectDocumentFromState, parseProjectDocumentValue } from '@/features/project/model/projectDocument';
import { mapProjectDocumentIdentity } from '@/features/project/model/projectDocumentIdentity';

it('preserves an external library asset reference even when a local asset has the same id', () => {
  const source = createProjectDocumentFromState({
    userTemplates: [], storedCards: [], appearanceStyles: [],
    customImageAssets: [{ id: 'shared-id', name: 'Local', kind: 'image', url: 'https://example.com/local.png', tileMode: 'contain', seamless: false, allowedTargets: [] }],
    productionPlan: {
      version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Set',
      outputSize: { width: 630, height: 880, unit: 'px' },
      visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [],
      assets: [{ id: 'library', name: 'Library', role: 'Image', kind: 'image', source: 'cardforge-library', quantity: 1, status: 'selected', assetId: 'shared-id' }],
    },
  });
  const opened = mapProjectDocumentIdentity(source, {}, 'open');
  expect(opened.customAssets['cardforge-maker-custom-images'][0]!.id).not.toBe('shared-id');
  expect(opened.productionPlan!.assets[0]!.assetId).toBe('shared-id');
});

it('refuses ambiguous non-library plan asset identities instead of guessing their ownership', () => {
  const document = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], customImageAssets: [{ id: 'shared', name: 'Local', kind: 'image', url: 'https://example.com/local.png', tileMode: 'contain', seamless: false, allowedTargets: [] }], productionPlan: { version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Set', outputSize: { width: 1, height: 1, unit: 'px' }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [{ id: 'requirement', name: 'Asset', role: 'Image', kind: 'image', source: 'cardforge-output', quantity: 1, status: 'selected', assetId: 'shared' }] } });
  expect(() => mapProjectDocumentIdentity(document, {}, 'open')).toThrow(/ambiguous/i);
});


it('rejects an unsupported production plan instead of silently discarding it', () => {
  const document = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [] });
  const result = parseProjectDocumentValue({ ...document, productionPlan: { version: 999, futureData: 'must survive' } });
  expect(result.success).toBe(false);
});


it('rejects nested and invalid plan data that normalization would discard', () => {
  const base = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: { version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Set', outputSize: { width: 1, height: 1, unit: 'px' }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] } });
  const plan = base.productionPlan!;
  for (const candidate of [
    { ...plan, future: 'keep' },
    { ...plan, outputSize: { ...plan.outputSize, future: true } },
    { ...plan, assets: [{ id: 'broken' }] },
    { ...plan, visualDirection: { ...plan.visualDirection, palette: ['red', 42] } },
  ]) expect(parseProjectDocumentValue({ ...base, productionPlan: candidate }).success).toBe(false);
});


it('refuses to capture a future plan instead of silently dropping its fields', () => {
  const valid = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: { version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Set', outputSize: { width: 1, height: 1, unit: 'px' }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] } }).productionPlan!;
  const future = { ...valid, futureData: 'must survive' };
  expect(() => createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: future })).toThrow(/plan/i);
});
