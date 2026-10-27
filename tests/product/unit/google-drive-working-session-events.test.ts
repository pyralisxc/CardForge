import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as Array<{ phase: string; receipt: unknown; message: string }>,
  cleanups: [] as Array<(() => void) | undefined>,
  listeners: new Map<string, () => void>(),
  poll: null as null | (() => void),
  current: {
    fileId: 'drive-file-F', accountId: 'account-a', name: 'F', workId: 'set-c',
    providerRevision: 'head:' + 'a'.repeat(64), projectRevision: 'a'.repeat(64),
    localProjectRevision: 'b'.repeat(64), packageScope: 'set' as const,
    lastSavedAt: '2026-10-26T00:00:00Z', webViewLink: null,
  },
  holds: new Map<string, Error>(),
  lookup: vi.fn(), probe: vi.fn(), dirty: vi.fn(), save: vi.fn(), repair: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useCallback: (callback: unknown) => callback,
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => {
      const value = { ...(initial as Record<string, unknown>) };
      return [value, (next: unknown) => {
        Object.assign(value, typeof next === 'function' ? next(value) : next as Record<string, unknown>);
        harness.states.push({ ...value } as { phase: string; receipt: unknown; message: string });
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
vi.mock('@/features/project/client/googleDriveProjectTransfer', () => ({
  getGoogleDriveWorkBinding: harness.lookup,
  probeGoogleDriveProject: harness.probe,
  hasGoogleDriveWorkingChanges: harness.dirty,
  saveCardSetToGoogleDrive: harness.save,
  refreshGoogleDriveProject: vi.fn(),
  waitForGoogleDriveTargetSave: async () => undefined,
  isSameGoogleDriveTarget: (a: { fileId?: string; accountId?: string } | null, b: { fileId?: string; accountId?: string } | null) =>
    a?.fileId === b?.fileId && a?.accountId === b?.accountId,
  getGoogleDriveSaveBarrier: (binding: { fileId?: string } | null) => binding ? harness.holds.get(binding.fileId ?? '') ?? null : null,
  GoogleDriveUnknownCommitError: class GoogleDriveUnknownCommitError extends Error {
    code = 'source_commit_unknown';
    constructor() { super('Drive commit outcome unknown; do not upload again.'); }
  },
  GoogleDriveSaveLinkageError: class GoogleDriveSaveLinkageError extends Error {
    code = 'source_committed_linkage_refresh_required';
    sourceReceipt: unknown;
    constructor(receipt: unknown) { super('Drive saved, browser link needs repair.'); this.sourceReceipt = receipt; }
  },
}));
vi.mock('@/features/project/client/googleDriveLinkRepair', () => ({
  repairConfirmedGoogleDriveLink: harness.repair,
}));

import { useGoogleDriveWorkingSession } from '@/features/project/client/googleDriveWorkingSession';
import { GoogleDriveUnknownCommitError, GoogleDriveSaveLinkageError } from '@/features/project/client/googleDriveProjectTransfer';

const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const latest = () => harness.states.at(-1);
const dispatchRefresh = async () => {
  harness.listeners.get('focus')?.();
  harness.listeners.get('online')?.();
  harness.poll?.();
  await flush();
};

describe('Drive hook recovery barriers and independent copies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.states = []; harness.cleanups = [];
    harness.listeners.clear(); harness.poll = null; harness.holds.clear();
    harness.current = {
      fileId: 'drive-file-F', accountId: 'account-a', name: 'F', workId: 'set-c',
      providerRevision: 'head:' + 'a'.repeat(64), projectRevision: 'a'.repeat(64),
      localProjectRevision: 'b'.repeat(64), packageScope: 'set',
      lastSavedAt: '2026-10-26T00:00:00Z', webViewLink: null,
    };
    harness.lookup.mockImplementation(async () => harness.current);
    harness.probe.mockImplementation(async (binding: typeof harness.current) => ({
      fileId: binding.fileId, accountId: binding.accountId,
      providerRevision: binding.providerRevision, projectRevision: binding.projectRevision,
      capabilities: { canEdit: true, canModifyContent: true },
    }));
    harness.dirty.mockResolvedValue(false);
    harness.save.mockResolvedValue(harness.current);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('window', {
      setInterval: (callback: () => void) => { harness.poll = callback; return 1; },
      clearInterval: () => undefined,
      addEventListener: (name: string, cb: () => void) => { harness.listeners.set(name, cb); },
      removeEventListener: (name: string) => { harness.listeners.delete(name); },
    });
  });

  afterEach(() => {
    for (const clean of harness.cleanups.toReversed()) clean?.();
    vi.unstubAllGlobals();
  });

  it('moves from held F to independently saved F2 on focus without clearing F’s hold', async () => {
    useGoogleDriveWorkingSession({ setId: 'set-c', name: 'F' });
    await flush();
    expect(latest()).toMatchObject({ phase: 'clean', receipt: { fileId: 'drive-file-F' } });
    const unknown = new GoogleDriveUnknownCommitError();
    harness.holds.set('drive-file-F', unknown);
    harness.current = {
      ...harness.current, fileId: 'drive-file-F2', name: 'F2',
      providerRevision: 'head:' + 'c'.repeat(64), projectRevision: 'c'.repeat(64),
    };
    harness.listeners.get('focus')?.();
    await flush();
    expect(latest()).toMatchObject({ phase: 'clean', receipt: { fileId: 'drive-file-F2' } });
    expect(harness.holds.get('drive-file-F')).toBe(unknown);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('does not publish stale clean/dirty when a manual unknown-commit hold arrives during a dirty check', async () => {
    let release!: (value: boolean) => void;
    harness.dirty.mockImplementation(() => new Promise<boolean>((resolve) => { release = resolve; }));
    useGoogleDriveWorkingSession({ setId: 'set-c', name: 'F' });
    await flush();
    expect(harness.dirty).toHaveBeenCalledOnce();
    const unknown = new GoogleDriveUnknownCommitError();
    harness.holds.set('drive-file-F', unknown);
    release(false);
    await flush();
    expect(latest()?.phase).toBe('error');
    const seen = harness.states.length;
    await dispatchRefresh();
    expect(latest()?.phase).toBe('error');
    expect(harness.states.slice(seen).every(s => s.phase !== 'clean' && s.phase !== 'dirty')).toBe(true);
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.holds.get('drive-file-F')).toBe(unknown);
  });

  it('preserves the confirmed provider receipt through focus/online/poll until verified local repair', async () => {
    const session = useGoogleDriveWorkingSession({ setId: 'set-c', name: 'F' });
    await flush();
    const confirmed = {
      ...harness.current,
      providerRevision: 'head:' + 'd'.repeat(64), projectRevision: 'd'.repeat(64),
    };
    const failure = new GoogleDriveSaveLinkageError(confirmed, new Error('local IndexedDB link failed'));
    harness.holds.set('drive-file-F', failure);
    await dispatchRefresh();
    expect(latest()).toMatchObject({ phase: 'recovery-required', receipt: confirmed });
    harness.repair.mockImplementation(async () => { harness.holds.delete('drive-file-F'); return confirmed; });
    await session.repairLink();
    expect(latest()).toMatchObject({ phase: 'clean', receipt: confirmed });
    expect(harness.holds.has('drive-file-F')).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
  });
  it('reports initial binding read failure instead of staying Checking', async () => {
    harness.lookup.mockRejectedValue(new Error('IndexedDB read unavailable'));
    useGoogleDriveWorkingSession({setId:'set-c',name:'F'});
    await flush();
    expect(latest()?.phase).toBe('error');
    expect(latest()?.message).toContain('IndexedDB read unavailable');
  });
  it('reports polling binding read failure instead of retaining Saved', async () => {
    useGoogleDriveWorkingSession({setId:'set-c',name:'F'});
    await flush();
    expect(latest()?.phase).toBe('clean');
    harness.lookup.mockRejectedValue(new Error('IndexedDB read unavailable'));
    harness.poll?.();
    await flush();
    expect(latest()?.phase).toBe('error');
  });

  it.each(['direct', 'idle'] as const)('reports %s save binding-read rejection without an unhandled promise', async (entry) => {
    vi.useFakeTimers();
    try {
      harness.dirty.mockResolvedValue(true);
      const session = useGoogleDriveWorkingSession({ setId: 'set-c', name: 'F' });
      await flush();
      expect(latest()?.phase).toBe('dirty');
      harness.lookup.mockRejectedValue(new Error('IndexedDB save read unavailable'));
      if (entry === 'direct') await expect(session.saveNow()).resolves.toBeUndefined();
      else await vi.advanceTimersByTimeAsync(4_000);
      await flush();
      expect(latest()?.phase).toBe('error');
      expect(latest()?.message).toContain('IndexedDB save read unavailable');
      expect(harness.save).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it.each(['save', 'repair'] as const)('keeps a confirmed recovery receipt if %s cannot read browser linkage', async (entry) => {
    const session = useGoogleDriveWorkingSession({ setId: 'set-c', name: 'F' });
    await flush();
    const failure = new GoogleDriveSaveLinkageError(harness.current, new Error('local link failed'));
    harness.holds.set('drive-file-F', failure);
    await dispatchRefresh();
    expect(latest()?.phase).toBe('recovery-required');
    harness.lookup.mockRejectedValue(new Error('IndexedDB read unavailable'));
    await expect(entry === 'save' ? session.saveNow() : session.repairLink()).resolves.toBeUndefined();
    expect(latest()).toMatchObject({ phase: 'recovery-required', receipt: harness.current });
    expect(harness.save).not.toHaveBeenCalled();
  });

});
