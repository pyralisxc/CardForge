import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  localSets: [] as { id: string }[],
  read: vi.fn(),
  captureSet: vi.fn(async (id: string) => ({ cardSets: [{ id }] })),
  captureWorkspace: vi.fn(async () => ({ cardSets: [{ id: 'unrelated' }, { id: 'set-c' }] })),
  decode: vi.fn(),
  apply: vi.fn(async () => ({ activeSetId: 'set-c' })),
  build: vi.fn(async ({ document, name }: { document: unknown; name: string }) => ({ document, manifest: { name, projectRevision: 'b'.repeat(64), savedAt: '2026-09-05' } })),
}));
vi.mock('@/features/project/persistence/structuredBrowserStorage', () => ({
  readStructuredBrowserValue: mock.read,
  writeStructuredBrowserValue: async (key: string, value: unknown) => { mock.values.set(key, value); },
  removeStructuredBrowserValue: async (key: string) => { mock.values.delete(key); },
}));
vi.mock('@/features/project/persistence/projectPersistenceScope', () => ({ getScopedProjectStorageNamespace: () => 'test' }));
vi.mock('@/features/project/client/projectWorkspaceDocument', () => ({
  captureCardSetProjectDocument: mock.captureSet,
  captureCurrentProjectDocument: mock.captureWorkspace,
  applyProjectDocumentToWorkspace: mock.apply,
}));
vi.mock('@/features/project/client/browserProjectPackage', () => ({ buildBrowserCardForgeProjectSnapshot: mock.build, decodeBrowserProjectFile: mock.decode }));
vi.mock('@/features/project/lib/projectPackageCodec', () => ({
  ProjectPackageError: class extends Error {},
  createCardForgeProjectPackageBlob: async () => new Blob(['package']),
  writeCardForgeProjectPackage: async () => {},
  decodeProjectFile: mock.decode,
}));
vi.mock('@/features/analytics/client/tracking', () => ({ observeProviderBoundaryResponse: (_provider: string, _action: string, run: () => unknown) => run() }));
vi.mock('@/features/project/store/workspaceStore', () => ({ useProjectStore: { getState: () => ({ cardSets: mock.localSets }) } }));

import { deleteGoogleDriveProjectCopy, getGoogleDriveProjectBinding, openGoogleDriveProject, saveCardSetToGoogleDrive, saveCurrentProjectToGoogleDrive } from '@/features/project/client/googleDriveProjectTransfer';
import { disconnectLocalProjectFolder, getLocalProjectFolderStatus, saveCardSetToAttachedFolder, saveProjectToAttachedFolder } from '@/features/project/client/localProjectFolder';

const driveBinding = { fileId: 'drive-file-12345', name: 'C', providerRevision: '1', projectRevision: 'a'.repeat(64), workId: 'set-c' };
const folder = (name: string) => {
  const handle = {
    name,
    queryPermission: vi.fn(async () => 'granted'),
    isSameEntry: vi.fn(async (other: { name: string }) => other.name === name),
    getFileHandle: vi.fn(async () => ({ getFile: async () => new Blob(['package']), createWritable: async () => ({ abort: async () => {} }) })),
  };
  return handle;
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.values.clear();
  mock.localSets = [];
  mock.read.mockImplementation(async (key: string) => mock.values.get(key) ?? null);
  mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64) });
  vi.stubGlobal('window', { showDirectoryPicker: vi.fn() });
});

describe('one authoritative Set location across save entry points', () => {
  it.each([1, 2])('retains explicit package scope when opening a %i-Set historical package', async (count) => {
    const document = { cardSets: Array.from({ length: count }, (_, index) => ({ id: `old-${index}` })) };
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': '1', 'X-CardForge-Project-Revision': 'b'.repeat(64),
    } })));
    const binding = await openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C' });
    expect(mock.apply).toHaveBeenCalledWith(document, 'copy');
    expect(binding.workId).toBe(count === 1 ? 'set-c' : null);
    expect(mock.values.has('test:google-drive-work-binding:set-c')).toBe(count === 1);
    expect(await getGoogleDriveProjectBinding()).toEqual(binding);
  });

  it('keeps the same Drive file and one-Set scope when alternating Locations and Set saves', async () => {
    mock.values.set('test:google-drive-project-binding', { ...driveBinding, providerRevision: 'stale' });
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    let version = 1;
    const prepare: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        prepare.push(JSON.parse(options.body as string));
        return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' });
      }
      return Response.json({ id: driveBinding.fileId, version: String(++version), name: 'C' });
    }));
    await saveCurrentProjectToGoogleDrive({ name: 'C' });
    await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await saveCurrentProjectToGoogleDrive({ name: 'C' });
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
    expect(mock.captureSet).toHaveBeenCalledTimes(3);
    expect(prepare.map((value) => [value.fileId, value.workId, value.expectedProviderRevision])).toEqual([
      [driveBinding.fileId, 'set-c', '1'], [driveBinding.fileId, 'set-c', '2'], [driveBinding.fileId, 'set-c', '3'],
    ]);
    expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
    expect(await getGoogleDriveProjectBinding()).toMatchObject({ providerRevision: '4' });
  });

  it('saves a folder attachment using its canonical Set revision and scope', async () => {
    const handle = folder('C');
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c', sourceRevision: 'stale' });
    mock.values.set('test:local-work-folder-binding:set-c', { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) });
    await saveProjectToAttachedFolder();
    await saveCardSetToAttachedFolder('set-c');
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
    expect(mock.captureSet).toHaveBeenCalledTimes(2);
    expect(mock.values.get('test:local-project-folder-binding')).toEqual({ workId: 'set-c' });
  });

  it('preserves explicit legacy workspace backup saves', async () => {
    const handle = folder('backup');
    mock.values.set('test:local-project-folder-binding', { handle, folderName: 'backup', sourceRevision: 'b'.repeat(64) });
    await saveProjectToAttachedFolder();
    expect(mock.captureWorkspace).toHaveBeenCalledOnce();
    expect(mock.captureSet).not.toHaveBeenCalled();
  });
});

describe('location failure and detach safety', () => {
  it('clears only matching local bindings after the exact Drive file is deleted', async () => {
    mock.localSets = [{ id: 'set-c' }, { id: 'other' }];
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    mock.values.set('test:google-drive-work-binding:other', { ...driveBinding, workId: 'other', fileId: 'other-file-12345' });
    vi.stubGlobal('fetch', vi.fn(async () => {
      expect(mock.values.has('test:google-drive-work-binding:set-c')).toBe(true);
      return new Response(null, { status: 204 });
    }));
    await deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision });
    expect(mock.values.has('test:google-drive-work-binding:set-c')).toBe(false);
    expect(mock.values.has('test:google-drive-project-binding')).toBe(false);
    expect(mock.values.has('test:google-drive-work-binding:other')).toBe(true);
  });

  it('does not delete a Drive file when local attachment metadata cannot be read', async () => {
    mock.read.mockRejectedValue(new Error('Storage unavailable'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision })).rejects.toThrow('Storage unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains local bindings if the Drive deletion fails', async () => {
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Revision conflict' } }, { status: 409 })));
    await expect(deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision })).rejects.toThrow();
    expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(driveBinding);
    expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
  });

  it('forgets all links to the selected folder but keeps other folders and all source files', async () => {
    const handle = folder('selected');
    const other = folder('other');
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c' });
    mock.values.set('test:local-work-folder-binding-index', ['set-c', 'set-d', 'set-other']);
    for (const id of ['set-c', 'set-d', 'set-other']) mock.values.set(`test:local-work-folder-binding:${id}`, { workId: id, handle: id === 'set-other' ? other : handle });
    await disconnectLocalProjectFolder();
    expect(mock.values.has('test:local-project-folder-binding')).toBe(false);
    expect(mock.values.has('test:local-work-folder-binding:set-c')).toBe(false);
    expect(mock.values.has('test:local-work-folder-binding:set-d')).toBe(false);
    expect(mock.values.get('test:local-work-folder-binding-index')).toEqual(['set-other']);
    expect(mock.values.has('test:local-work-folder-binding:set-other')).toBe(true);
    expect(handle.getFileHandle).not.toHaveBeenCalled();
  });

  it('does not turn unreadable bindings into new provider saves or folder selection', async () => {
    mock.read.mockRejectedValue(new Error('Storage unavailable'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).rejects.toThrow('Storage unavailable');
    await expect(saveCardSetToAttachedFolder('set-c')).rejects.toThrow('Storage unavailable');
    await expect(getLocalProjectFolderStatus()).rejects.toThrow('Storage unavailable');
    expect(fetch).not.toHaveBeenCalled();
    expect((window as unknown as { showDirectoryPicker: ReturnType<typeof vi.fn> }).showDirectoryPicker).not.toHaveBeenCalled();
  });

  it('refuses an unresolved old attachment rather than expanding it to a workspace backup', async () => {
    mock.values.set('test:google-drive-project-binding', driveBinding);
    await expect(saveCurrentProjectToGoogleDrive({ name: 'C' })).rejects.toThrow('Reopen');
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
  });

  it('leaves files untouched when the saved folder index is corrupt', async () => {
    const handle = folder('C');
    mock.values.set('test:local-work-folder-binding:set-c', { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) });
    mock.values.set('test:local-work-folder-binding-index', { damaged: true });
    await expect(saveCardSetToAttachedFolder('set-c')).rejects.toThrow('index is unreadable');
    expect(handle.getFileHandle).not.toHaveBeenCalled();
    expect(mock.values.get('test:local-work-folder-binding-index')).toEqual({ damaged: true });
  });
});
