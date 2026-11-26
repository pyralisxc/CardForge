import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

/** Output-owned temporary files. These are browser cache, never project storage. */
const DIRECTORY = 'cardforge-output-ready-v1';
const MAX_READY_BYTES = Number.MAX_SAFE_INTEGER;
const CAPACITY_CHECK_INTERVAL = 4 * 1024 * 1024;
const MIN_FREE_BYTES = 256 * 1024 * 1024;
const MEMORY_LIMIT = 256 * 1024 * 1024;

export interface ReadyOutput {
  name: string;
  fileName: string;
  blob: Blob;
  persistence: 'device' | 'session';
  restricted: boolean;
  clean?: boolean;
  canSaveAgain?: boolean;
  unavailable?: boolean;
  storageFile?: string;
  storageSize?: number;
}
interface ReadyManifest { version: 1; scopeKey: string; file: string; name: string; fileName: string; restricted: boolean; clean?: boolean; size: number }
export interface OutputStage {
  writable: WritableStream<Uint8Array>;
  publish: () => Promise<ReadyOutput>;
  abort: () => Promise<void>;
}

const scopeKey = async (scope: string) => {
  const bytes = new TextEncoder().encode(scope);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
};
const rootDirectory = async () => {
  if (!navigator.storage?.getDirectory || !navigator.locks?.request || !crypto?.subtle) return null;
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY, { create: true });
};
const readManifest = async (dir: FileSystemDirectoryHandle, key: string): Promise<ReadyManifest | null> => {
  let file: File;
  try { file = await (await dir.getFileHandle(`${key}.json`)).getFile(); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw new Error('The prepared output record could not be read. Try again before preparing another.');
  }
  let data: unknown;
  try { data = JSON.parse(await file.text()); }
  catch { throw new Error('The prepared output record could not be read.'); }
  if (!data || typeof data !== 'object') throw new Error('The prepared output record could not be read.');
  const value = data as Partial<ReadyManifest>;
  if (value.version !== 1 || value.scopeKey !== key || typeof value.file !== 'string'
    || !new RegExp(`^${key}-[a-f0-9-]+\\.bin$`, 'u').test(value.file)
    || typeof value.name !== 'string' || typeof value.fileName !== 'string'
    || typeof value.restricted !== 'boolean' || (value.clean !== undefined && typeof value.clean !== 'boolean')
    || !Number.isSafeInteger(value.size) || !value.size || value.size > MAX_READY_BYTES) {
    throw new Error('The prepared output record could not be read.');
  }
  return value as ReadyManifest;
};

/** Pinned work can be removed after reload, but cannot be saved without its live validator. */
export const readReadyOutput = async (scope: string): Promise<ReadyOutput | null> => {
  if (scope === 'unscoped-disabled') return null;
  const dir = await rootDirectory();
  if (!dir) return null;
  const key = await scopeKey(scope);
  const manifest = await readManifest(dir, key);
  if (!manifest) return null;
  try {
    const blob = await (await dir.getFileHandle(manifest.file)).getFile();
    if (blob.size === manifest.size) return { name: manifest.name, fileName: manifest.fileName, blob, persistence: 'device', restricted: manifest.restricted, clean: manifest.clean === true, canSaveAgain: !manifest.restricted };
  } catch { /* Keep the exact record addressable for explicit removal. */ }
  return { name: manifest.name, fileName: manifest.fileName, blob: new Blob(), persistence: 'device', restricted: manifest.restricted, clean: manifest.clean === true, canSaveAgain: false, unavailable: true, storageFile: manifest.file, storageSize: manifest.size };
};

export class ReadyOutputUnavailableError extends Error {
  constructor() { super('The prepared file is unavailable or changed. Reload to see the current prepared output.'); }
}

/** Reopen the exact published file; another tab may have replaced it. */
export const refreshReadyOutput = async (scope: string, selected: ReadyOutput): Promise<ReadyOutput> => {
  if (!(selected.blob instanceof File)) return selected;
  const dir = await rootDirectory();
  if (!dir) throw new ReadyOutputUnavailableError();
  const key = await scopeKey(scope);
  const manifest = await readManifest(dir, key);
  if (!manifest || manifest.file !== selected.blob.name || manifest.size !== selected.blob.size) {
    throw new ReadyOutputUnavailableError();
  }
  try {
    const blob = await (await dir.getFileHandle(manifest.file)).getFile();
    if (blob.size !== manifest.size || blob.lastModified !== selected.blob.lastModified) throw new Error('changed');
    return { ...selected, blob };
  } catch { throw new ReadyOutputUnavailableError(); }
};

/** Remove only the exact selected output, after the creator confirms downloads are finished. */
export const removeReadyOutput = async (scope: string, selected: ReadyOutput, isCurrent: () => boolean = () => true): Promise<void> => {
  if (!(selected.blob instanceof File) && !selected.unavailable) return;
  const dir = await rootDirectory();
  if (!dir) throw new ReadyOutputUnavailableError();
  const key = await scopeKey(scope);
  await navigator.locks.request('cardforge-output-ready-writer', { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Another tab is preparing an output. Wait for it to finish.');
    await navigator.locks.request(`cardforge-output-ready:${key}`, async () => {
      if (getProjectPersistenceScope() !== scope || !isCurrent()) throw new Error('The active workspace changed.');
      const manifest = await readManifest(dir, key);
      const fileName = selected.unavailable ? selected.storageFile : (selected.blob as File).name;
      const fileSize = selected.unavailable ? selected.storageSize : selected.blob.size;
      if (!manifest || manifest.file !== fileName || manifest.size !== fileSize) throw new ReadyOutputUnavailableError();
      if (!selected.unavailable) {
        const file = await (await dir.getFileHandle(manifest.file)).getFile();
        if (file.size !== selected.blob.size || file.lastModified !== (selected.blob as File).lastModified) throw new ReadyOutputUnavailableError();
      }
      if (getProjectPersistenceScope() !== scope || !isCurrent()) throw new ReadyOutputUnavailableError();
      try { await dir.removeEntry(manifest.file); }
      catch (error) { if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error; }
      await dir.removeEntry(`${key}.json`);
    });
  });
};

export const createOutputStage = async (scope: string, name: string, fileName: string, restricted: boolean, isCurrent: () => boolean = () => true, clean = false): Promise<OutputStage> => {
  const ensureScope = () => { if (scope === 'unscoped-disabled' || getProjectPersistenceScope() !== scope || !isCurrent()) throw new Error('The active workspace changed. Start the export again.'); };
  ensureScope();
  let dir: FileSystemDirectoryHandle | null = null;
  try { dir = await rootDirectory(); } catch { /* session-only fallback */ }
  if (!dir) {
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    let closed = false;
    const writable = new WritableStream<Uint8Array>({
      write(chunk) { ensureScope(); size += chunk.byteLength; if (size > MEMORY_LIMIT) throw new Error('This browser cannot retain an export larger than 256 MB in this session. Use a smaller batch or a browser with device staging.'); chunks.push(new Uint8Array(chunk).buffer); },
      close() { ensureScope(); closed = true; },
      abort() { chunks.length = 0; },
    });
    return { writable, publish: async () => { ensureScope(); if (!closed || !size) throw new Error('The output is incomplete.'); return { name, fileName, blob: new Blob(chunks), persistence: 'session', restricted, clean }; }, abort: async () => { chunks.length = 0; } };
  }
  ensureScope();
  const estimate = await navigator.storage.estimate();
  ensureScope();
  if (!Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage) || !estimate.quota) throw new Error('Browser storage capacity is unavailable. Your Set is unchanged; try again when storage can be checked.');
  const limit = Math.min(MAX_READY_BYTES, Math.floor(estimate.quota * 0.75 - estimate.usage!), Math.floor(estimate.quota - estimate.usage! - MIN_FREE_BYTES));
  if (limit <= 0) throw new Error('Browser storage is too full to prepare this output safely. Free space or export a smaller batch; your Set is unchanged.');
  const key = await scopeKey(scope);
  ensureScope();
  let releaseLock!: () => void;
  let signalLock!: (acquired: boolean) => void;
  const acquired = new Promise<boolean>(resolve => { signalLock = resolve; });
  const held = new Promise<void>(resolve => { releaseLock = resolve; });
  const lockTask = navigator.locks.request('cardforge-output-ready-writer', { ifAvailable: true }, async lock => {
    signalLock(Boolean(lock));
    if (lock) await held;
  });
  if (!await Promise.race([acquired, lockTask.then(() => false)])) { await lockTask; throw new Error('Another tab is preparing an output. Wait for it to finish before preparing another.'); }
  try {
    ensureScope();
    if (await readManifest(dir, key)) throw new Error('Remove the previously prepared output before preparing another copy on this device.');
    ensureScope();
  } catch (error) { releaseLock(); await lockTask; throw error; }
  const file = `${key}-${crypto.randomUUID()}.bin`;
  let target: FileSystemFileHandle;
  let fileStream: FileSystemWritableFileStream;
  try { ensureScope(); target = await dir.getFileHandle(file, { create: true }); ensureScope(); fileStream = await target.createWritable(); ensureScope(); }
  catch (error) { await dir.removeEntry(file).catch(() => undefined); releaseLock(); await lockTask; throw error; }
  const writer = fileStream.getWriter();
  let size = 0;
  let checkedAt = 0;
  let closed = false;
  const writable = new WritableStream<Uint8Array>({
    async write(chunk) {
      ensureScope();
      size += chunk.byteLength;
      if (size > limit) throw new Error('This output exceeds the safe browser storage budget. Export a smaller batch; your Set is unchanged.');
      if (size - checkedAt >= CAPACITY_CHECK_INTERVAL) {
        const current = await navigator.storage.estimate();
        if (!Number.isFinite(current.quota) || !Number.isFinite(current.usage) || !current.quota
          || Math.max(current.usage!, estimate.usage! + size) > Math.min(current.quota * 0.75, current.quota - MIN_FREE_BYTES)) {
          throw new Error('Browser storage no longer has enough free space to prepare this output safely. Your Set is unchanged.');
        }
        ensureScope();
        checkedAt = size;
      }
      await writer.write(chunk);
      ensureScope();
    },
    async close() { ensureScope(); await writer.close(); ensureScope(); closed = true; },
    async abort(reason) { await writer.abort(reason); },
  });
  const directory = dir;
  return {
    writable,
    publish: async () => {
      try {
      ensureScope();
      if (!closed || !size) throw new Error('The output is incomplete.');
      const blob = await target.getFile();
      ensureScope();
      if (blob.size !== size) throw new Error('The output could not be verified.');
      await navigator.locks.request(`cardforge-output-ready:${key}`, async () => {
        ensureScope();
        const previous = await readManifest(directory, key);
        ensureScope();
        const manifest: ReadyManifest = { version: 1, scopeKey: key, file, name, fileName, restricted, clean, size };
        const metadata = await (await directory.getFileHandle(`${key}.json`, { create: true })).createWritable();
        await metadata.write(JSON.stringify(manifest));
        try { ensureScope(); await metadata.close(); ensureScope(); }
        catch (error) { await metadata.abort().catch(() => undefined); if (previous) { const rollback = await (await directory.getFileHandle(`${key}.json`, { create: true })).createWritable(); await rollback.write(JSON.stringify(previous)); await rollback.close(); } else await directory.removeEntry(`${key}.json`).catch(() => undefined); throw error; }
      });
      ensureScope();
      return { name, fileName, blob, persistence: restricted ? 'session' : 'device', restricted, clean };
      } finally { releaseLock(); await lockTask; }
    },
    abort: async () => {
      try {
        await writer.abort().catch(() => undefined);
        await directory.removeEntry(file).catch(() => undefined);
        await navigator.locks.request(`cardforge-output-ready:${key}`, async () => { const current = await readManifest(directory, key); if (current?.file === file) await directory.removeEntry(`${key}.json`).catch(() => undefined); }).catch(() => undefined);
      } finally { releaseLock(); await lockTask; }
    },
  };
};
