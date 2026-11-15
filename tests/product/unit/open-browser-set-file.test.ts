import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as codec from '@/features/project/lib/projectPackageCodec';
import { openBrowserSetFile } from '@/features/project/client/openBrowserSetFile';
import { setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { readStructuredBrowserValue } from '@/features/project/persistence/structuredBrowserStorage';
import { CARDFORGE_PROJECT_MANIFEST_FILE } from '@/features/project/model/projectPackage';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

const project = () => {
  const document = createProjectScaleFixture(100, { uniqueArtwork: true });
  document.version = 2;
  document.storedCards = document.storedCards.slice(0, 2);
  document.cardSets[0]!.templateIds = [document.userTemplates[0]!.id!];
  document.cardSets[0]!.plan = { version: 1, context: '  Authored context\nhttps://example.test/keep-literally  ' };
  return document;
};
const packageFor = async (document = project()) => {
  const snapshot = await codec.buildCardForgeProjectSnapshot({ document, name: 'Set File' });
  const file = new File([await codec.createCardForgeProjectPackageBlob(snapshot)], 'set.cardforge');
  return { snapshot, file };
};
let sequence = 0;
let scope: `account:${string}`;
beforeEach(async () => {
  scope = `account:set-file-test-${++sequence}`;
  await hydrateProjectWorkspaceForScope(scope);
  useProjectStore.setState({ ...useProjectStore.getInitialState(), cardSets: [], activeCardSet: null, storedCards: [], userTemplates: [], defaultTemplates: [] });
  await persistProjectWorkspaceNow();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('native single-Set file opening', () => {
  it('opens complete package bytes as an independent Set with literal context, Templates and scoped artwork', async () => {
    const source = project();
    const { file } = await packageFor(source);
    const id = await openBrowserSetFile(file, new AbortController().signal);
    const state = useProjectStore.getState();
    expect(state.cardSets).toHaveLength(1);
    expect(id).not.toBe(source.cardSets[0]!.id);
    expect(state.activeCardSet?.id).toBe(id);
    expect(state.activeCardSet?.plan).toEqual(source.cardSets[0]!.plan);
    expect(state.userTemplates).toHaveLength(1);
    expect(state.userTemplates[0]!.id).not.toBe(source.userTemplates[0]!.id);
    expect(state.storedCards).toHaveLength(2);
    expect(state.storedCards.every((card) => card.setId === id && card.templateId === state.userTemplates[0]!.id)).toBe(true);
    expect(state.storedCards[0]!.data.artwork).toMatch(/^cardforge-browser-asset:\/\//);
  });

  it('preserves colliding current work and output preferences, including on repeated opening', async () => {
    const source = project();
    useProjectStore.setState({ cardSets: source.cardSets, activeCardSet: source.cardSets[0]!, userTemplates: source.userTemplates, storedCards: source.storedCards, exportDpi: 600 });
    await persistProjectWorkspaceNow();
    const original = structuredClone(source);
    const { file } = await packageFor(source);
    const firstId = await openBrowserSetFile(file, new AbortController().signal);
    const secondId = await openBrowserSetFile(file, new AbortController().signal);
    const state = useProjectStore.getState();
    expect(new Set(state.cardSets.map((set) => set.id)).size).toBe(3);
    expect(firstId).not.toBe(secondId);
    expect(state.cardSets.find((set) => set.id === source.cardSets[0]!.id)).toEqual(original.cardSets[0]);
    expect(state.storedCards.filter((card) => card.setId === source.cardSets[0]!.id)).toEqual(original.storedCards);
    expect(state.userTemplates.find((template) => template.id === source.userTemplates[0]!.id)).toEqual(original.userTemplates[0]);
    expect(state.exportDpi).toBe(600);
  });

  it('accepts an empty Set and its prepared Template snapshots', async () => {
    const document = project();
    document.storedCards = [];
    document.cardSets[0]!.templateIds = [document.userTemplates[0]!.id!];
    const { file } = await packageFor(document);
    const id = await openBrowserSetFile(file, new AbortController().signal);
    expect(useProjectStore.getState().activeCardSet?.id).toBe(id);
    expect(useProjectStore.getState().activeCardSet?.templateIds).toEqual([useProjectStore.getState().userTemplates[0]!.id]);
  });

  it.each([0, 2])('refuses a %i-Set workspace package before materializing artwork', async (count) => {
    const document = project();
    document.cardSets = count ? [...document.cardSets, { id: 'other-set', name: 'Other' }] : [];
    if (!count) {
      document.userTemplates[0]!.cardBackgroundImageUrl = String(document.storedCards[0]!.data.artwork);
      document.storedCards = [];
      document.activeCardSetId = undefined;
    }
    const { file, snapshot } = await packageFor(document);
    await expect(openBrowserSetFile(file, new AbortController().signal)).rejects.toThrow('exactly one Set');
    expect(useProjectStore.getState().cardSets).toEqual([]);
    const key = `project-content-asset:${encodeURIComponent(scope)}:${snapshot.manifest.assets[0]!.id}`;
    expect(await readStructuredBrowserValue(key)).not.toBeInstanceOf(Blob);
  });

  it.each([{ registry: [] }, { registry: [{}] }, { registry: [{ id: ' ', name: 'Invalid identity' }] }])('does not infer a Set owner from cards for source registry %j', async ({ registry }) => {
    const { file } = await packageFor();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifest = JSON.parse(await zip.file(CARDFORGE_PROJECT_MANIFEST_FILE)!.async('string'));
    manifest.project.cardSets = registry;
    manifest.projectRevision = createHash('sha256').update(JSON.stringify({ project: manifest.project, assets: manifest.assets })).digest('hex');
    zip.file(CARDFORGE_PROJECT_MANIFEST_FILE, JSON.stringify(manifest));
    const source = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'legacy-registry.cardforge');
    await expect(openBrowserSetFile(source, new AbortController().signal)).rejects.toThrow(/exactly one Set|valid Set identity/);
    expect(useProjectStore.getState().cardSets).toEqual([]);
  });

  it.each(['front', 'back', 'prepared'])('refuses a missing required %s Template without changing work', async (kind) => {
    const document = project();
    if (kind === 'front') document.storedCards[0]!.templateId = 'missing-template';
    if (kind === 'back') document.storedCards[0]!.backingTemplateId = 'missing-template';
    if (kind === 'prepared') document.cardSets[0]!.templateIds = ['missing-template'];
    const { file } = await packageFor(document);
    await expect(openBrowserSetFile(file, new AbortController().signal)).rejects.toThrow('required Template');
    expect(useProjectStore.getState().cardSets).toEqual([]);
  });

  it('refuses cards assigned outside the one advertised Set', async () => {
    const document = project();
    document.storedCards[0]!.setId = 'other-set';
    const { file } = await packageFor(document);
    await expect(openBrowserSetFile(file, new AbortController().signal)).rejects.toThrow('outside its Set');
    expect(useProjectStore.getState().storedCards).toEqual([]);
  });

  it.each(['bad.cardforge', 'backup.json'])('leaves work unchanged for invalid %s input', async (name) => {
    await expect(openBrowserSetFile(new File(['not a package'], name), new AbortController().signal)).rejects.toThrow();
    expect(useProjectStore.getState().cardSets).toEqual([]);
  });

  it('honors cancellation before and during package decoding', async () => {
    const { file, snapshot } = await packageFor();
    await expect(openBrowserSetFile(file, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
    const controller = new AbortController();
    vi.spyOn(codec, 'decodeCardForgeProjectPackage').mockImplementationOnce(async () => { controller.abort(); return snapshot; });
    await expect(openBrowserSetFile(file, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(useProjectStore.getState().cardSets).toEqual([]);
  });

  it('refuses an account switch during decoding before writing artwork into the next account', async () => {
    const { file, snapshot } = await packageFor();
    const nextScope = `account:set-file-next-${sequence}` as const;
    vi.spyOn(codec, 'decodeCardForgeProjectPackage').mockImplementationOnce(async () => { setProjectPersistenceScope(nextScope); return snapshot; });
    await expect(openBrowserSetFile(file, new AbortController().signal)).rejects.toThrow('account changed');
    expect(useProjectStore.getState().cardSets).toEqual([]);
    expect(await readStructuredBrowserValue(`project-content-asset:${encodeURIComponent(nextScope)}:${snapshot.manifest.assets[0]!.id}`)).not.toBeInstanceOf(Blob);
  });

  it('keeps concurrent authored changes instead of committing a stale workspace snapshot', async () => {
    const { file, snapshot } = await packageFor();
    vi.spyOn(codec, 'decodeCardForgeProjectPackage').mockImplementationOnce(async () => {
      useProjectStore.getState().createCardSet();
      return snapshot;
    });
    await expect(openBrowserSetFile(file, new AbortController().signal)).rejects.toThrow(/changed|conflict/i);
    expect(useProjectStore.getState().cardSets).toHaveLength(1);
    expect(useProjectStore.getState().storedCards).toEqual([]);
  });
});
