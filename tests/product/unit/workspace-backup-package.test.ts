import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';
import { createWorkspaceBackupDocument } from '@/features/project/model/workspaceBackupDocument';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage, decodeCardForgeProjectPackage } from '@/features/project/lib/projectPackageCodec';
import * as codec from '@/features/project/lib/workspaceBackupPackageCodec';

const plan = (purpose: string) => ({ version: 1 as const, decisionMode: 'confirmed' as const, purpose, deliverable: 'Cards', outputSize: { width: 1, height: 1, unit: 'px' as const }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] });
const document = () => createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });

describe('workspace backup package', () => {
  it('roundtrips real package bytes with multiple and zero-Set groups and rejects the old project reader', async () => {
    const groups = [{ setIds: ['a', 'b'], plan: plan('both') }, { setIds: [], plan: plan('zero') }];
    const backup = createWorkspaceBackupDocument(document(), groups);
    const bytes = await codec.encodeWorkspaceBackupPackage(backup, 'Backup');
    const decoded = await codec.decodeWorkspaceBackupPackage(bytes);
    expect(decoded.documentPlanGroups).toEqual(groups);
    expect(decoded.document.cardSets.map(set => set.id)).toEqual(['a', 'b']);
    await expect(decodeCardForgeProjectPackage(bytes)).rejects.toThrow(/version/i);
    const manifest = JSON.parse(await (await JSZip.loadAsync(bytes)).file('cardforge-project.json')!.async('string'));
    expect(manifest.cardforgeProject).not.toBe(1);
    expect(manifest.cardforgeProject).not.toBe(2);
  });

  it('rejects raw future plan fields in package bytes rather than normalizing them away', async () => {
    const bytes = await codec.encodeWorkspaceBackupPackage(createWorkspaceBackupDocument(document(), [{ setIds: ['a'], plan: plan('original') }]), 'Backup');
    const zip = await JSZip.loadAsync(bytes);
    const manifest = JSON.parse(await zip.file('cardforge-project.json')!.async('string'));
    manifest.documentPlanGroups[0].plan.futureField = 'must not disappear';
    zip.file('cardforge-project.json', JSON.stringify(manifest));
    await expect(codec.decodeWorkspaceBackupPackage(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/plan/i);
  });

  it('does not change existing V2 package encoding and decoding', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: document(), name: 'Set' });
    const decoded = await decodeCardForgeProjectPackage(await encodeCardForgeProjectPackage(snapshot));
    expect(decoded.manifest.cardforgeProject).toBe(2);
  });
  it('rejects unresolved browser references in plan-only assets', async () => {
    const p = { ...plan('asset'), assets: [{ id: 'asset', name: 'Art', kind: 'image' as const, role: 'cover', source: 'user-provided' as const, quantity: 1, status: 'selected' as const, assetUrl: 'cardforge-browser-asset://missing', targetElementIds: [] }] };
    const backup = createWorkspaceBackupDocument(document(), [{ setIds: [], plan: p }]);
    await expect(codec.encodeWorkspaceBackupPackage(backup, 'Backup')).rejects.toThrow(/asset|materializ/i);
  });

});
