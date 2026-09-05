import { describe, expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { isolateProjectDocumentToCard } from '@/features/project/client/package-document';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage, decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';

describe('one-card portable document', () => {
  it('keeps the selected front/back and authored values without sibling cards or layout positions', () => {
    const original = createProjectScaleFixture(100);
    const back = { ...original.userTemplates[0], id: 'back', name: 'Back', templateUsage: 'back-preset' as const };
    original.userTemplates.push(back, { ...back, id: 'unrelated' });
    original.storedCards[0].backingTemplateId = back.id;
    original.storedCards[0].backingData = { title: 'Authored back' };
    const snapshot = structuredClone(original);
    const document = isolateProjectDocumentToCard(original, 'scale-card-1');
    expect(document.storedCards).toHaveLength(1);
    expect(document.storedCards[0].backingData).toEqual({ title: 'Authored back' });
    expect(document.userTemplates.map((template) => template.id)).toEqual(['scale-template', 'back']);
    expect(Object.keys(document.cardSets[0].organization!.positions)).toEqual(['scale-card-1']);
    expect(document.storedCards[0].templateId).toBe('scale-template');
    expect(document.storedCards[0].backingTemplateId).toBe('back');
    expect(original).toEqual(snapshot);
  });

  it('rejects a deleted card or missing parent Set instead of exporting an empty file', () => {
    const document = createProjectScaleFixture(100);
    expect(() => isolateProjectDocumentToCard(document, 'missing')).toThrow('no longer available');
    document.cardSets = [];
    expect(() => isolateProjectDocumentToCard(document, 'scale-card-1')).toThrow('no longer available');
  });

  it('round-trips the isolated card artwork and back through the portable package codec', async () => {
    const source = createProjectScaleFixture(100, { uniqueArtwork: true });
    source.userTemplates.push({ ...source.userTemplates[0], id: 'back', templateUsage: 'back-preset' });
    source.storedCards[0].backingTemplateId = 'back';
    source.storedCards[0].backingData = { artwork: source.storedCards[0].data.artwork };
    const isolated = isolateProjectDocumentToCard(source, 'scale-card-1');
    const snapshot = await buildCardForgeProjectSnapshot({ document: isolated, name: 'One card' });
    const reopened = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(await encodeCardForgeProjectPackage(snapshot)));
    expect(reopened.storedCards).toHaveLength(1);
    expect(reopened.storedCards[0].data).toEqual(source.storedCards[0].data);
    expect(reopened.storedCards[0].backingData).toEqual(source.storedCards[0].backingData);
    expect(snapshot.assets.size).toBe(1);
  });
});

const boundary = vi.hoisted(() => ({ capture: vi.fn(), build: vi.fn(), save: vi.fn() }));
vi.mock('@/features/project/client/projectWorkspaceDocument', () => ({ captureCardProjectDocument: boundary.capture }));
vi.mock('@/features/project/client/browserProjectPackage', () => ({ buildBrowserCardForgeProjectSnapshot: boundary.build }));
vi.mock('@/features/project/client/projectPackageDeviceSave', () => ({ saveCardForgeProjectPackageToDevice: boundary.save }));
import { exportCardProjectPackage } from '@/features/project/client/cardPackageExport';

it('never downloads a partial card package when asset capture fails', async () => {
  boundary.capture.mockResolvedValue(isolateProjectDocumentToCard(createProjectScaleFixture(100), 'scale-card-1'));
  boundary.build.mockRejectedValue(new Error('Artwork is unavailable'));
  await expect(exportCardProjectPackage('scale-card-1')).rejects.toThrow('Artwork is unavailable');
  expect(boundary.save).not.toHaveBeenCalled();
});
