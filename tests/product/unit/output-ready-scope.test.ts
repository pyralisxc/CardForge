import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ scope: 'guest' }));
vi.mock('@/features/project/client/persistence-workspace', () => ({ getProjectPersistenceScope: () => state.scope }));
import { createOutputStage, readReadyOutput, refreshReadyOutput, removeReadyOutput, ReadyOutputUnavailableError } from '@/features/card-generator/lib/outputReadyStorage';

afterEach(() => { state.scope = 'guest'; vi.unstubAllGlobals(); });

describe('prepared output scope', () => {
  it('does not publish a session artifact after switching workspaces', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    const stage = await createOutputStage('guest', 'PDF', 'output.pdf', false);
    const writer = stage.writable.getWriter();
    await writer.write(new Uint8Array([1, 2, 3]));
    await writer.close();
    state.scope = 'user-b';
    await expect(stage.publish()).rejects.toThrow(/workspace changed/i);
    await stage.abort();
  });

  it('does not publish after the Output owner invalidates its handle', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    let current = true;
    const stage = await createOutputStage('guest', 'PDF', 'output.pdf', false, () => current);
    const writer = stage.writable.getWriter();
    await writer.write(new Uint8Array([1, 2, 3]));
    await writer.close();
    current = false;
    await expect(stage.publish()).rejects.toThrow(/workspace changed/i);
    await stage.abort();
  });

  it('stops staging when the workspace changes before another write', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    const stage = await createOutputStage('guest', 'PDF', 'output.pdf', false);
    const writer = stage.writable.getWriter();
    state.scope = 'user-b';
    await expect(writer.write(new Uint8Array([1]))).rejects.toThrow(/workspace changed/i);
    await stage.abort();
  });
});

describe('device output publication', () => {
  it('does not replace a previously published file when preparing another', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guest'));
    const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    const manifest = { version: 1, scopeKey: key, file: `${key}-11111111-1111-1111-1111-111111111111.bin`, name: 'PDF', fileName: 'old.pdf', restricted: false, size: 3 };
    const removeEntry = vi.fn();
    const directory = { getFileHandle: async () => ({ getFile: async () => new File([JSON.stringify(manifest)], `${key}.json`) }), removeEntry };
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ quota: 8_000_000_000, usage: 0 }), getDirectory: async () => ({ getDirectoryHandle: async () => directory }) },
      locks: { request: async (_name: string, _options: unknown, callback: (lock: object) => Promise<unknown>) => callback({}) },
    });
    await expect(createOutputStage('guest', 'PDF', 'new.pdf', false)).rejects.toThrow(/Remove the previously prepared output/i);
    expect(removeEntry).not.toHaveBeenCalled();
  });

  it('rejects promptly when the browser refuses the writer lock', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ quota: 8_000_000_000, usage: 0 }), getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
      locks: { request: async () => { throw new Error('lock unavailable'); } },
    });
    await expect(createOutputStage('guest', 'PDF', 'output.pdf', false)).rejects.toThrow('lock unavailable');
  });

  it('releases the writer lock when cleanup cannot acquire its manifest lock', async () => {
    let released = false;
    const directory = {
      async *entries() {},
      async getFileHandle(_name: string, options?: { create?: boolean }) {
        if (!options?.create) throw new DOMException('missing', 'NotFoundError');
        return { createWritable: async () => new WritableStream<Uint8Array>() };
      },
      async removeEntry() {},
    };
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ quota: 8_000_000_000, usage: 0 }), getDirectory: async () => ({ getDirectoryHandle: async () => directory }) },
      locks: { request: async (name: string, _options: unknown, callback?: (lock: object) => Promise<unknown>) => {
        if (name !== 'cardforge-output-ready-writer') throw new Error('cleanup lock unavailable');
        try { return await callback?.({}); } finally { released = true; }
      } },
    });
    const stage = await createOutputStage('guest', 'PDF', 'output.pdf', false);
    await expect(stage.abort()).resolves.toBeUndefined();
    expect(released).toBe(true);
  });

  it('does not publish a completed file if the workspace changes before manifest commit', async () => {
    const files = new Map<string, Uint8Array>();
    const directory = {
      async getFileHandle(name: string, options?: { create?: boolean }) {
        if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError');
        if (!files.has(name)) files.set(name, new Uint8Array());
        return {
          async getFile() { return new Blob([new Uint8Array(files.get(name)!)]) },
          async createWritable() {
            let bytes = new Uint8Array();
            const stream = new WritableStream<Uint8Array>({
              write(chunk) { bytes = new Uint8Array(chunk); },
              close() { files.set(name, bytes); if (name.endsWith('.json')) state.scope = 'user-b'; },
            });
            return Object.assign(stream, {
              async write(text: string) { bytes = new TextEncoder().encode(text); },
              async close() { files.set(name, bytes); if (name.endsWith('.json')) state.scope = 'user-b'; },
              async abort() {},
            });
          },
        };
      },
      async removeEntry(name: string) { files.delete(name); },
      async *entries() { for (const name of files.keys()) yield [name, {}]; },
    };
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ quota: 8_000_000_000, usage: 0 }), getDirectory: async () => ({ getDirectoryHandle: async () => directory }) },
      locks: { request: async (_name: string, options: unknown, callback?: (lock: object) => Promise<unknown>) => typeof options === 'function' ? (options as (lock: object) => Promise<unknown>)({}) : callback?.({}) },
    });
    const stage = await createOutputStage('guest', 'PDF', 'output.pdf', false);
    const writer = stage.writable.getWriter();
    await writer.write(new Uint8Array([1, 2, 3]));
    await writer.close();
    await expect(stage.publish()).rejects.toThrow(/workspace changed/i);
    await stage.abort();
    expect([...files.keys()].filter(name => name.endsWith('.json') || name.endsWith('.bin'))).toEqual([]);
  });
});

describe('cross-tab output replacement', () => {
  it('does not restore another account’s prepared output', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('account:a'));
    const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    const manifest = { version: 1, scopeKey: key, file: `${key}-11111111-1111-1111-1111-111111111111.bin`, name: 'PDF', fileName: 'a.pdf', restricted: false, size: 3 };
    const directory = { getFileHandle: async (name: string) => {
      if (name !== `${key}.json`) throw new DOMException('missing', 'NotFoundError');
      return { getFile: async () => new File([JSON.stringify(manifest)], name) };
    } };
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => ({ getDirectoryHandle: async () => directory }) }, locks: { request: () => {} } });
    expect(await readReadyOutput('account:b')).toBeNull();
  });

  it('keeps a wrong-sized retained file visible for explicit exact removal', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guest'));
    const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    const fileName = `${key}-11111111-1111-1111-1111-111111111111.bin`;
    const manifest = { version: 1, scopeKey: key, file: fileName, name: 'PDF', fileName: 'old.pdf', restricted: false, size: 9 };
    const removed: string[] = [];
    const directory = {
      getFileHandle: async (name: string) => ({ getFile: async () => name.endsWith('.json') ? new File([JSON.stringify(manifest)], name) : new File(['bad'], name) }),
      removeEntry: async (name: string) => { removed.push(name); },
    };
    vi.stubGlobal('navigator', {
      storage: { getDirectory: async () => ({ getDirectoryHandle: async () => directory }) },
      locks: { request: async (_name: string, options: unknown, callback?: (lock: object) => Promise<unknown>) => typeof options === 'function' ? (options as (lock: object) => Promise<unknown>)({}) : callback?.({}) },
    });
    const unavailable = await readReadyOutput('guest');
    expect(unavailable).toMatchObject({ unavailable: true, canSaveAgain: false, storageFile: fileName, storageSize: 9 });
    await removeReadyOutput('guest', unavailable!);
    expect(removed).toEqual([fileName, `${key}.json`]);
  });

  it('refuses removal while another tab is preparing an output', async () => {
    const removeEntry = vi.fn();
    vi.stubGlobal('navigator', {
      storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({ removeEntry }) }) },
      locks: { request: async (_name: string, _options: unknown, callback: (lock: null) => Promise<unknown>) => callback(null) },
    });
    const selected = { name: 'PDF', fileName: 'old.pdf', blob: new File(['old'], 'selected.bin'), persistence: 'device' as const, restricted: false };
    await expect(removeReadyOutput('guest', selected)).rejects.toThrow(/another tab/i);
    expect(removeEntry).not.toHaveBeenCalled();
  });

  it('refuses to save an earlier file after another tab replaces its manifest', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guest'));
    const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    const originalName = `${key}-11111111-1111-1111-1111-111111111111.bin`;
    const replacedName = `${key}-22222222-2222-2222-2222-222222222222.bin`;
    const manifest = { version: 1, scopeKey: key, file: replacedName, name: 'PDF', fileName: 'new.pdf', restricted: false, size: 3 };
    vi.stubGlobal('navigator', {
      storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({ getFileHandle: async () => ({ getFile: async () => new File([JSON.stringify(manifest)], `${key}.json`) }) }) }) },
      locks: { request: () => {} },
    });
    const selected = { name: 'PDF', fileName: 'old.pdf', blob: new File(['old'], originalName), persistence: 'device' as const, restricted: false };
    await expect(refreshReadyOutput('guest', selected)).rejects.toBeInstanceOf(ReadyOutputUnavailableError);
  });
});

describe('multipart PDF staging boundary', () => {
  it('streams numbered simulated parts into one readable ZIP before publication', async () => {
    const { BlobReader, ZipWriter } = await import('@zip.js/zip.js');
    const JSZip = (await import('jszip')).default;
    vi.stubGlobal('navigator', { storage: {} });
    const stage = await createOutputStage('guest', 'PDF', 'output.zip', false);
    const zip = new ZipWriter(stage.writable, { useWebWorkers: false });
    await zip.add('output-part-001-of-002.pdf', new BlobReader(new Blob(['first simulated PDF'])), { level: 0 });
    await zip.add('output-part-002-of-002.pdf', new BlobReader(new Blob(['second simulated PDF'])), { level: 0 });
    await zip.close();
    const ready = await stage.publish();
    const archive = await JSZip.loadAsync(await ready.blob.arrayBuffer());
    expect(Object.keys(archive.files)).toEqual(['output-part-001-of-002.pdf', 'output-part-002-of-002.pdf']);
    expect(await archive.file('output-part-001-of-002.pdf')!.async('string')).toBe('first simulated PDF');
    expect(await archive.file('output-part-002-of-002.pdf')!.async('string')).toBe('second simulated PDF');
  });
});
