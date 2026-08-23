import { createHash } from 'node:crypto';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  CARDFORGE_RENDER_ARTIFACT_BUCKET,
  MAX_RENDER_ARTIFACT_BYTES,
  type RenderArtifact,
  type RenderArtifactDescriptor,
} from '../model';

export class RenderArtifactStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'RenderArtifactStoreError';
    this.status = status;
  }
}

const requireStore = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new RenderArtifactStoreError('CardForge render artifact storage is not configured yet.', 503);
  return supabase;
};

const descriptorKey = (descriptor: RenderArtifactDescriptor): string => [
  descriptor.rendererVersion,
  descriptor.sourceKind,
  descriptor.sourceId,
  descriptor.sourceRevision,
  descriptor.kind,
  descriptor.subjectId,
  descriptor.face,
  descriptor.profile,
].join('\n');

export const getRenderArtifactId = (descriptor: RenderArtifactDescriptor): string => (
  createHash('sha256').update(descriptorKey(descriptor)).digest('hex')
);

const documentPrefix = (ownerUserId: string, sourceId: string) => `${ownerUserId}/${sourceId}`;
const artifactPath = (ownerUserId: string, descriptor: RenderArtifactDescriptor): string => (
  `${documentPrefix(ownerUserId, descriptor.sourceId)}/${getRenderArtifactId(descriptor)}.png`
);

const isMissingStorageObject = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const record = error as { statusCode?: unknown; status?: unknown; message?: unknown };
  const status = Number(record.statusCode ?? record.status);
  const message = typeof record.message === 'string' ? record.message : '';
  return status === 404 || /not found|does not exist/i.test(message);
};

const toArtifact = (
  descriptor: RenderArtifactDescriptor,
  bytes: Buffer,
  cacheHit: boolean,
): RenderArtifact => ({
  ...descriptor,
  artifactId: getRenderArtifactId(descriptor),
  mimeType: 'image/png',
  byteLength: bytes.byteLength,
  cacheHit,
  bytes,
});

export const readRenderArtifact = async ({
  ownerUserId,
  descriptor,
}: {
  ownerUserId: string;
  descriptor: RenderArtifactDescriptor;
}): Promise<RenderArtifact | null> => {
  const { data, error } = await requireStore().storage
    .from(CARDFORGE_RENDER_ARTIFACT_BUCKET)
    .download(artifactPath(ownerUserId, descriptor));
  if (error) {
    if (isMissingStorageObject(error)) return null;
    console.error('Unable to read CardForge render artifact:', error);
    throw new RenderArtifactStoreError('Unable to read the cached CardForge render artifact.');
  }
  if (!data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  return toArtifact(descriptor, bytes, true);
};

export const writeRenderArtifact = async ({
  ownerUserId,
  descriptor,
  bytes,
}: {
  ownerUserId: string;
  descriptor: RenderArtifactDescriptor;
  bytes: Buffer;
}): Promise<RenderArtifact> => {
  if (bytes.byteLength < 1) throw new RenderArtifactStoreError('CardForge produced an empty render artifact.', 500);
  if (bytes.byteLength > MAX_RENDER_ARTIFACT_BYTES) {
    throw new RenderArtifactStoreError('This CardForge render artifact exceeds the 16 MB cache limit.', 413);
  }

  const existing = await readRenderArtifact({ ownerUserId, descriptor });
  if (existing) return existing;

  const path = artifactPath(ownerUserId, descriptor);
  const { error } = await requireStore().storage
    .from(CARDFORGE_RENDER_ARTIFACT_BUCKET)
    .upload(path, bytes, {
      contentType: 'image/png',
      cacheControl: '31536000',
      upsert: false,
    });
  if (error) {
    // Another request may have filled the immutable cache between our read and upload.
    const raced = await readRenderArtifact({ ownerUserId, descriptor });
    if (raced) return raced;
    console.error('Unable to store CardForge render artifact:', error);
    throw new RenderArtifactStoreError('Unable to cache the CardForge render artifact.');
  }
  return toArtifact(descriptor, bytes, false);
};

export const removeRenderArtifactsForStudioDocument = async ({
  ownerUserId,
  documentId,
}: {
  ownerUserId: string;
  documentId: string;
}): Promise<void> => {
  const prefix = documentPrefix(ownerUserId, documentId);
  const { data, error } = await requireStore().storage
    .from(CARDFORGE_RENDER_ARTIFACT_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new RenderArtifactStoreError('Unable to inspect cached CardForge renders for removal.');
  const paths = (data ?? [])
    .filter((item) => item.name.endsWith('.png'))
    .map((item) => `${prefix}/${item.name}`);
  if (paths.length === 0) return;
  const removed = await requireStore().storage.from(CARDFORGE_RENDER_ARTIFACT_BUCKET).remove(paths);
  if (removed.error) throw new RenderArtifactStoreError('Unable to remove cached CardForge renders.');
};
