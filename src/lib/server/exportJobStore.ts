import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { nanoid } from 'nanoid';

import { EXPORT_JOB_STORAGE_ROOT } from '@/lib/server/exportJobPaths';
import type {
  ExportJobArtifact,
  ExportJobCreateInput,
  ExportJobProgress,
  ExportJobRecord,
  ExportJobStatus,
} from '@/lib/exportJobTypes';

const JOB_FILE_NAME = 'job.json';
const ARTIFACT_FILE_NAME = 'artifact';

const activeStatuses: ExportJobStatus[] = ['queued', 'running'];

const safeJoin = (root: string, ...parts: string[]): string => {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, ...parts);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Unsafe export job path.');
  }
  return resolvedPath;
};

const timestamp = () => new Date().toISOString();

export interface ExportJobStore {
  root: string;
  create: (input: ExportJobCreateInput) => Promise<ExportJobRecord>;
  get: (id: string) => Promise<ExportJobRecord | null>;
  listQueued: () => Promise<ExportJobRecord[]>;
  markRunning: (id: string) => Promise<ExportJobRecord | null>;
  updateProgress: (id: string, progress: ExportJobProgress) => Promise<ExportJobRecord | null>;
  complete: (id: string, artifact: Omit<ExportJobArtifact, 'bytes' | 'path'>, bytes: Uint8Array) => Promise<ExportJobRecord>;
  fail: (id: string, error: string) => Promise<ExportJobRecord | null>;
  requestCancel: (id: string) => Promise<ExportJobRecord | null>;
  cancelIfRequested: (id: string) => Promise<ExportJobRecord | null>;
  readArtifact: (id: string) => Promise<Uint8Array>;
}

export function createExportJobStore(root = EXPORT_JOB_STORAGE_ROOT): ExportJobStore {
  const jobDir = (id: string) => safeJoin(root, id);
  const jobFile = (id: string) => safeJoin(root, id, JOB_FILE_NAME);
  const artifactFile = (id: string) => safeJoin(root, id, ARTIFACT_FILE_NAME);

  const ensureRoot = async () => {
    await mkdir(root, { recursive: true });
  };

  const writeJob = async (job: ExportJobRecord): Promise<ExportJobRecord> => {
    await mkdir(jobDir(job.id), { recursive: true });
    const file = jobFile(job.id);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
    await rename(tmp, file);
    return job;
  };

  const mutate = async (
    id: string,
    updater: (job: ExportJobRecord) => ExportJobRecord | null
  ): Promise<ExportJobRecord | null> => {
    const current = await store.get(id);
    if (!current) return null;
    const next = updater(current);
    if (!next) return current;
    return writeJob({ ...next, updatedAt: timestamp() });
  };

  const store: ExportJobStore = {
    root,
    create: async (input) => {
      await ensureRoot();
      const id = nanoid();
      const now = timestamp();
      return writeJob({
        ...input,
        id,
        status: 'queued',
        progress: { done: 0, total: input.preflight.faceCount, label: 'Queued' },
        warnings: input.preflight.warnings,
        createdAt: now,
        updatedAt: now,
      });
    },
    get: async (id) => {
      try {
        const raw = await readFile(jobFile(id), 'utf8');
        return JSON.parse(raw) as ExportJobRecord;
      } catch {
        return null;
      }
    },
    listQueued: async () => {
      await ensureRoot();
      const entries = await readdir(root, { withFileTypes: true });
      const jobs = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => store.get(entry.name))
      );

      return jobs
        .filter((job): job is ExportJobRecord => Boolean(job && job.status === 'queued'))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    markRunning: async (id) => mutate(id, (job) => {
      if (job.status !== 'queued') return null;
      return {
        ...job,
        status: 'running',
        startedAt: timestamp(),
        progress: { ...job.progress, label: 'Starting worker render' },
      };
    }),
    updateProgress: async (id, progress) => mutate(id, (job) => {
      if (!activeStatuses.includes(job.status)) return null;
      return { ...job, progress };
    }),
    complete: async (id, artifact, bytes) => {
      const artifactPath = artifactFile(id);
      await mkdir(jobDir(id), { recursive: true });
      await writeFile(artifactPath, bytes);
      const stats = await stat(artifactPath);
      const completed = await mutate(id, (job) => ({
        ...job,
        status: 'completed',
        completedAt: timestamp(),
        artifact: {
          ...artifact,
          bytes: stats.size,
          path: artifactPath,
        },
        progress: { done: job.progress.total, total: job.progress.total, label: 'Completed' },
      }));
      if (!completed) throw new Error(`Unable to complete missing export job ${id}.`);
      return completed;
    },
    fail: async (id, error) => mutate(id, (job) => ({
      ...job,
      status: 'failed',
      completedAt: timestamp(),
      error,
      progress: { ...job.progress, label: 'Failed' },
    })),
    requestCancel: async (id) => mutate(id, (job) => {
      if (!activeStatuses.includes(job.status)) return { ...job, cancelRequested: true };
      return { ...job, cancelRequested: true };
    }),
    cancelIfRequested: async (id) => {
      const job = await store.get(id);
      if (!job?.cancelRequested || !activeStatuses.includes(job.status)) return job;
      return writeJob({
        ...job,
        status: 'cancelled',
        completedAt: timestamp(),
        updatedAt: timestamp(),
        progress: { ...job.progress, label: 'Cancelled' },
      });
    },
    readArtifact: async (id) => {
      const job = await store.get(id);
      if (!job?.artifact) throw new Error('Export artifact is not available.');
      return readFile(job.artifact.path);
    },
  };

  return store;
}

export const exportJobStore = createExportJobStore();
