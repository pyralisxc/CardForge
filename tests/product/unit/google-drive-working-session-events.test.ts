import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as Array<{ phase: string; receipt: unknown; message: string }>,
  cleanups: [] as Array<(() => void) | undefined>,
  listeners: new Map<string, () => void>(),
  poll: null as null | (() => void),
  binding: {
    fileId: 'drive-file-12345',
    accountId: 'account-a',
    name: 'C',
    providerRevision: 'head:' + 'a'.repeat(64),
    projectRevision: 'a'.repeat(64),
    localProjectRevision: 'b'.repeat(64),
    packageScope: 'set' as const,
    workId: 'set-c',
    lastSavedAt: '2026-10-26T00:00:00Z',
    webViewLink: null,
  },
  lookup: vi.fn(),
  probe: vi.fn(),
  dirty: vi.fn(),
  save: vi.fn(),
  repair: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useCallback: (callback: unknown) => callback,
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => {
      // Simulate a rerendered callback reading the newest hook state.
      const current = { ...(initial as Record<string, unknown>) };
      return [current, (next: unknown) => {
        Object.assign(current, next as Record<string, unknown>);
        harness.states.push({ ...current } as { phase: string; receipt: unknown; message: string });
      }];
    },
    useEffect: (effect: () => (() => void) | undefined) => {
      harness.cleanups.push(effect());
    },
  };
});
vi.mock('@/features/project/store/workspaceStore', () => ({
  useProjectStore: { subscribe: () => () => undefined },
}));
vi.mock('@/features/project/client/projectWorkspaceDocument', () => ({
  hasProjectDocumentStateChanged: () => false,
}));
vi.mock('@/features/project/persistence/projectPersistenceScope', () => ({
  getScopedProjectStorageNamespace: () => 'test',
}));
vi.mock('@/features/project/client/googleDriveProjectTransfer', () => ({
  getGoogleDriveWorkBinding: harness.lookup,
  probeGoogleDriveProject: harness.probe,
  hasGoogleDriveWorkingChanges: harness.dirty,
  saveCardSetToGoogleDrive: harness.save,
  refreshGoogleDriveProject: vi.fn(),
  GoogleDriveUnknownCommitError: class GoogleDriveUnknownCommitError extends Error {
    code = 'source_commit_unknown';
    constructor() { super('Drive commit is unknown; do not upload again.'); }
  },
  GoogleDriveSaveLinkageError: class GoogleDriveSaveLinkageError extends Error {
    code = 'source_committed_linkage_refresh_required';
    sourceReceipt: unknown;
    constructor(receipt: unknown) {
      super('Drive saved the file but the browser link needs repair.');
      this.sourceReceipt = receipt;
    }
  },
}));
vi.mock('@/features/project/client/googleDriveLinkRepair', () => ({
  repairConfirmedGoogleDriveLink: harness.repair,
}));

import { useGoogleDriveWorkingSession } from '@/features/project/client/googleDriveWorkingSession';
import { getDriveSaveHold, holdDriveSaveForRecovery, clearDriveSaveHold, resetDriveSaveOwnerForTests } from '@/features/project/client/googleDriveSaveOwner';
import { GoogleDriveUnknownCommitError, GoogleDriveSaveLinkageError } from '@/features/project/client/googleDriveProjectTransfer';

const latest = () => harness.states.at(-1);
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const events = async () => {
  harness.listeners.get('focus')?.();
  harness.listeners.get('online')?.();
  harness.poll?.();
  await flush();
};

describe('real working-session hook transitions with owner holds', () => {
  beforeEach(() => {
    resetDriveSaveOwnerForTests();
    vi.clearAllMocks();
    harness.states = [];
    harness.cleanups = [];
    harness.listeners.clear();
    harness.poll = null;
    harness.lookup.mockResolvedValue(harness.binding);
    harness.probe.mockResolvedValue({
      fileId: harness.binding.fileId,
      accountId: harness.binding.accountId,
      providerRevision: harness.binding.providerRevision,
      projectRevision: harness.binding.projectRevision,
      capabilities: { canEdit: true, canModifyContent: true },
    });
    harness.dirty.mockResolvedValue(true);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('window', {
      setInterval: (callback: () => void) => { harness.poll = callback; return 1; },
      clearInterval: () => undefined,
      addEventListener: (name: string, callback: () => void) => { harness.listeners.set(name, callback); },
      removeEventListener: (name: string) => { harness.listeners.delete(name); },
    });
  });
  afterEach(() => {
    for (const clean of harness.cleanups.toReversed()) clean?.();
    vi.unstubAllGlobals();
  });

  it('an unknown upload keeps the same attempt paused across focus, polling and online events even when metadata stays writable', async () => {
    harness.save.mockImplementation(async () => {
      const error = new GoogleDriveUnknownCommitError();
      holdDriveSaveForRecovery('test', 'set-c', harness.binding, error, 'unknown-commit');
      throw error;
    });
    const session = useGoogleDriveWorkingSession({ setId: 'set-c', name: 'C' });
    await flush();
    expect(latest()?.phase).toBe('dirty');
    await session.saveNow();
    expect(latest()?.phase).toBe('error');
    const hold = getDriveSaveHold('test', 'set-c', harness.binding);
    expect(hold).toMatchObject({ reason: 'unknown-commit', attemptId: expect.any(Number) });
    const probes = harness.probe.mock.calls.length;
    await events();
    await session.reconcile();
    expect(harness.probe).toHaveBeenCalledTimes(probes);
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(getDriveSaveHold('test', 'set-c', harness.binding)?.attemptId).toBe(hold?.attemptId);
    expect(latest()?.phase).toBe('error');
  });

  it('preserves the confirmed receipt through refresh events and repairs only the local link, with no second upload', async () => {
    const confirmed = { ...harness.binding, projectRevision: 'c'.repeat(64), providerRevision: 'head:' + 'c'.repeat(64) };
    harness.save.mockImplementation(async () => {
      const error = new GoogleDriveSaveLinkageError(confirmed);
      holdDriveSaveForRecovery('test', 'set-c', harness.binding, error, 'confirmed-receipt');
      throw error;
    });
    harness.repair.mockImplementation(async () => {
      clearDriveSaveHold('test', 'set-c', harness.binding);
      return confirmed;
    });
    const session = useGoogleDriveWorkingSession({ setId: 'set-c', name: 'C' });
    await flush();
    await session.saveNow();
    expect(latest()).toMatchObject({ phase: 'recovery-required', receipt: confirmed });
    await events();
    expect(latest()).toMatchObject({ phase: 'recovery-required', receipt: confirmed });
    await session.repairLink();
    expect(latest()).toMatchObject({ phase: 'clean', receipt: confirmed });
    expect(harness.repair).toHaveBeenCalledExactlyOnceWith(confirmed);
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(getDriveSaveHold('test', 'set-c', harness.binding)).toBeNull();
  });

  it('holds dirty remote changes through ordinary refresh; explicit recovery is distinct', async () => {
    harness.probe.mockResolvedValueOnce({
      fileId: harness.binding.fileId,
      accountId: harness.binding.accountId,
      providerRevision: 'head:' + 'f'.repeat(64),
      projectRevision: 'f'.repeat(64),
      capabilities: { canEdit: true, canModifyContent: true },
    });
    const session = useGoogleDriveWorkingSession({ setId: 'set-c', name: 'C' });
    await flush();
    expect(latest()?.phase).toBe('remote-changed');
    const hold = getDriveSaveHold('test', 'set-c', harness.binding);
    expect(hold?.reason).toBe('remote-dirty');
    await events();
    expect(latest()?.phase).toBe('remote-changed');
    expect(getDriveSaveHold('test', 'set-c', harness.binding)?.attemptId).toBe(hold?.attemptId);
    expect(harness.save).not.toHaveBeenCalled();
    // Only the existing explicit provider-reconciled refresh may clear this hold.
    clearDriveSaveHold('test', 'set-c', harness.binding);
    harness.dirty.mockResolvedValue(false);
    await session.reconcile();
    expect(latest()?.phase).toBe('clean');
    expect(harness.save).not.toHaveBeenCalled();
  });
});
