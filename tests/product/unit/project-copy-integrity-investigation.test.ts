import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { instantiateProjectDocumentCopy, CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/model/projectDocument';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { applyProjectDocumentToWorkspace, captureCurrentProjectDocument } from '@/features/project/client/projectWorkspaceDocument';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow } from '@/features/project/store/workspaceStore';

it('copies a real document without leaving its production asset reference attached to the source', () => {
  const source = createProjectScaleFixture(100);
  source.cardSets[0]!.templateIds = [source.userTemplates[0]!.id!];
  source.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY] = [{ id: 'art', name: 'Art', kind: 'image', url: 'https://example.com/art.png', tileMode: 'contain', seamless: false, allowedTargets: [] }];
  source.appearanceStyles = [{ id: 'style', name: 'Style', kind: 'material', targets: ['template'], appearance: { assetSource: 'https://example.com/art.png' } }];
  source.productionPlan = { version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Set', outputSize: { width: 630, height: 880, unit: 'px' }, visualDirection: { summary: 'Cards', palette: [], typography: [] }, editableFieldKeys: [], assets: [{ id: 'requirement', name: 'Art', kind: 'image', role: 'artwork', source: 'user-provided', quantity: 1, status: 'selected', assetId: 'art' }] };
  const before = structuredClone(source);
  let id = 0;
  const copy = instantiateProjectDocumentCopy(source, (kind) => `${kind}-copy-${++id}`);
  expect(source).toEqual(before);
  expect(copy.productionPlan!.assets[0]!.assetId).toBe(copy.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY][0]!.id);
  expect(copy.cardSets[0]!.templateIds).toEqual([copy.userTemplates[0]!.id]);
});

it('retains the production plan after installing and recapturing an independent workspace copy', async () => {
  await hydrateProjectWorkspaceForScope('account:copy-integrity-investigation');
  await new Promise((resolve) => setTimeout(resolve, 1));
  await persistProjectWorkspaceNow();
  const source = createProjectScaleFixture(100);
  source.productionPlan = { version: 1, decisionMode: 'confirmed', purpose: 'Cards', deliverable: 'Set', outputSize: { width: 630, height: 880, unit: 'px' }, visualDirection: { summary: 'Cards', palette: [], typography: [] }, editableFieldKeys: [], assets: [] };
  await applyProjectDocumentToWorkspace(source, 'copy');
  const captured = await captureCurrentProjectDocument();
  expect(captured.productionPlan).toEqual(source.productionPlan);
});
