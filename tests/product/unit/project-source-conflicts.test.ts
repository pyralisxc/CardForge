import { describe, expect, it, vi } from 'vitest';

import {
  buildCardForgeProjectSnapshot,
  encodeCardForgeProjectPackage,
  type ProjectDocumentV1,
} from '@/features/project/client';
import { assertLocalProjectFolderRevisionCurrent } from '@/features/project/client/localProjectFolder';
import { getProjectSourceConflict } from '@/features/project/model/projectSourceConflict';

const createDocument = (name: string): ProjectDocumentV1 => ({
  version: 1,
  userTemplates: [{
    id: 'template-1',
    name: 'Conflict Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    freeformCanvas: { width: 630, height: 880, elements: [] },
  }],
  cardSets: [{ id: 'set-1', name }],
  activeCardSetId: 'set-1',
  storedCards: [{ uniqueId: 'card-1', templateId: 'template-1', setId: 'set-1', setName: name, data: { cardName: name } }],
  appearanceStyles: [],
  exportSettings: {},
  customAssets: {
    'cardforge-maker-custom-textures': [],
    'cardforge-maker-custom-dividers': [],
    'cardforge-maker-custom-icons': [],
    'cardforge-maker-custom-images': [],
  },
});

const toProjectFile = (bytes: Uint8Array) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return Object.assign(new Blob([copy.buffer], { type: 'application/vnd.cardforge.project+zip' }), {
    name: 'project.cardforge',
    lastModified: Date.now(),
  }) as File;
};

const createDirectory = (file: File) => ({
  name: 'Attached Project',
  getFileHandle: vi.fn(async () => ({ getFile: async () => file })),
}) as unknown as FileSystemDirectoryHandle;

describe('provider-neutral project source conflicts', () => {
  it('accepts the same exact package and provider revisions', () => {
    expect(getProjectSourceConflict({
      expected: { projectRevision: 'project-a', providerRevision: 'provider-7' },
      current: { projectRevision: 'project-a', providerRevision: 'provider-7' },
    })).toBeNull();
  });

  it.each([
    ['project-revision-changed', { projectRevision: 'project-a' }, { projectRevision: 'project-b' }],
    ['provider-revision-changed', { projectRevision: 'project-a', providerRevision: 'provider-7' }, { projectRevision: 'project-a', providerRevision: 'provider-8' }],
    ['missing-current-provider-revision', { projectRevision: 'project-a', providerRevision: 'provider-7' }, { projectRevision: 'project-a' }],
  ] as const)('distinguishes %s without flattening the source boundary', (kind, expectedRevision, currentRevision) => {
    expect(getProjectSourceConflict({ expected: expectedRevision, current: currentRevision })).toMatchObject({ kind });
  });
});

describe('local-folder project conflict preflight', () => {
  it('allows a save only while the attached package revision is still current', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createDocument('Current Work'), name: 'Current Work' });
    const directory = createDirectory(toProjectFile(await encodeCardForgeProjectPackage(snapshot)));

    await expect(assertLocalProjectFolderRevisionCurrent(directory, {
      handle: directory,
      folderName: directory.name,
      sourceRevision: snapshot.manifest.projectRevision,
      lastSavedAt: snapshot.manifest.savedAt,
    })).resolves.toBeUndefined();
    expect(directory.getFileHandle).toHaveBeenCalledWith('project.cardforge');
  });

  it('leaves externally changed folder work untouched and requires an explicit reopen', async () => {
    const expected = await buildCardForgeProjectSnapshot({ document: createDocument('Expected Work'), name: 'Expected Work' });
    const changed = await buildCardForgeProjectSnapshot({ document: createDocument('Changed Elsewhere'), name: 'Changed Elsewhere' });
    const directory = createDirectory(toProjectFile(await encodeCardForgeProjectPackage(changed)));

    await expect(assertLocalProjectFolderRevisionCurrent(directory, {
      handle: directory,
      folderName: directory.name,
      sourceRevision: expected.manifest.projectRevision,
      lastSavedAt: expected.manifest.savedAt,
    })).rejects.toThrow(/changed after revision|not overwritten/iu);
    expect(directory.getFileHandle).toHaveBeenCalledWith('project.cardforge');
  });

  it('does not recreate a missing attached package during conflict preflight', async () => {
    const directory = {
      name: 'Missing Project',
      getFileHandle: vi.fn(async () => { throw new DOMException('Missing', 'NotFoundError'); }),
    } as unknown as FileSystemDirectoryHandle;

    await expect(assertLocalProjectFolderRevisionCurrent(directory, {
      handle: directory,
      folderName: directory.name,
      sourceRevision: 'a'.repeat(64),
      lastSavedAt: null,
    })).rejects.toThrow(/no longer contains|left unchanged/iu);
    expect(directory.getFileHandle).toHaveBeenCalledWith('project.cardforge');
  });
});
