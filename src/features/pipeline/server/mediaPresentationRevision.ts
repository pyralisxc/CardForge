import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { isPipelineEditorialReviewStatus } from '../lib/pipelineProgram';
import { isContributorAssetStatus } from '../lib/pipelineItems';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import {
  mediaPresentationSchema,
  mediaPresentationValuesSchema,
  mediaRevisionInputSchema,
  type MediaRevisionSnapshot,
  type PipelineMediaPresentation,
} from '../lib/pipelineMediaPresentation';

const baseSchema = z.object({
  assetId: z.string(), name: z.string(), parentSubmissionId: z.string().uuid(), lineageId: z.string().uuid(),
  baseRevisionNumber: z.number().int().nonnegative(), baseVersion: z.string(), registryVersion: z.string(),
  intendedAccessTier: mediaPresentationSchema.shape.intendedAccessTier,
  baseline: mediaPresentationValuesSchema, sourceBucket: z.string().min(1), sourcePath: z.string().min(1),
  sourceUrl: z.string().min(1), sourceMimeType: z.string().startsWith('image/'), sourceSize: z.number().int().min(1).max(50 * 1024 * 1024),
});
type Client = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
function fail(message: string, status = 503, code = 'pipeline_media_unavailable'): never {
  throw new PipelineRegistryCommandError(message, status, code);
}
const client = () => getSupabaseServerClient() ?? fail('Pipeline is unavailable. Try again.');
const hash = (bytes: ArrayBuffer) => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const mime = (value: string) => value.toLowerCase().split(';')[0].trim();
const same = (left: PipelineMediaPresentation, right: PipelineMediaPresentation) => JSON.stringify(left) === JSON.stringify(right);

async function readBase(db: Client, assetId: string) {
  const { data, error } = await db.rpc('cardforge_read_media_revision_base', { p_asset_id: assetId });
  if (error) {
    if (error.message.includes('pipeline_media_not_found')) fail('The published asset no longer exists.', 404, 'pipeline_media_not_found');
    if (error.message.includes('pipeline_media_not_permitted')) fail('Choose a published texture with an intact managed source and native presentation metadata.', 400, 'pipeline_media_not_permitted');
    fail('The current media revision could not be read. Try again.');
  }
  const parsed = baseSchema.safeParse(data);
  if (!parsed.success) fail('The current media source or presentation could not be verified.');
  return parsed.data;
}

async function sourceHash(db: Client, base: z.infer<typeof baseSchema>, path = base.sourcePath) {
  const { data, error } = await db.storage.from(base.sourceBucket).download(path);
  if (error || !data) fail('The exact managed source could not be read. Retry without changing the request.');
  if (data.size !== base.sourceSize || mime(data.type) !== mime(base.sourceMimeType)) {
    fail('The managed source size or MIME type changed. Reload before creating a revision.', 409, 'pipeline_media_conflict');
  }
  return hash(await data.arrayBuffer());
}

export async function readMediaPresentationRevision(assetId: string): Promise<MediaRevisionSnapshot> {
  if (!assetId.trim() || assetId.length > 200) fail('Choose a published texture.', 400, 'pipeline_media_invalid');
  const db = client();
  const base = await readBase(db, assetId);
  return {
    assetId: base.assetId, name: base.name, sourceUrl: base.sourceUrl,
    presentation: mediaPresentationSchema.parse({
      schemaVersion: 1, parentSubmissionId: base.parentSubmissionId, lineageId: base.lineageId,
      baseRevisionNumber: base.baseRevisionNumber, baseVersion: base.baseVersion, registryVersion: base.registryVersion,
      intendedAccessTier: base.intendedAccessTier, sourceSha256: await sourceHash(db, base), baseline: base.baseline, proposed: base.baseline,
    }),
  };
}

async function receipt(db: Client, assetId: string, submissionKey: string, presentation: PipelineMediaPresentation) {
  const { data, error } = await db.from('cardforge_contributor_asset_submissions')
    .select('id,target_registry_asset_id,submission_key,revision_number,status,editorial_review_status,media_presentation,source_storage_bucket,source_storage_path,trashed_at,purge_state')
    .eq('target_registry_asset_id', assetId).eq('submission_key', submissionKey).not('media_presentation', 'is', null).maybeSingle();
  if (error) fail('The revision receipt is unavailable. Read the exact saved receipt before any further write; no source copy has been removed.');
  if (!data) return null;
  const row = z.object({ id: z.string().uuid(), target_registry_asset_id: z.string(), submission_key: z.string().uuid(), revision_number: z.number().int().nonnegative(), status: z.string().refine(isContributorAssetStatus), editorial_review_status: z.string().refine(isPipelineEditorialReviewStatus), media_presentation: mediaPresentationSchema, source_storage_bucket: z.string().min(1), source_storage_path: z.string().min(1), trashed_at: z.string().nullable(), purge_state: z.string().nullable() }).safeParse(data);
  if (!row.success || row.data.target_registry_asset_id !== assetId || row.data.submission_key !== submissionKey) fail('The exact revision receipt could not be verified. This failed read does not establish absence.');
  if (!same(row.data.media_presentation, presentation) || row.data.trashed_at || row.data.purge_state) {
    fail('This attempt key already belongs to a different or unavailable revision. Reload before continuing.', 409, 'pipeline_media_conflict');
  }
  return row.data;
}

/** Exact receipt observation only: no allocation, download, copy or compensation. */
export async function readMediaPresentationReceipt(value: unknown) {
  const parsed = mediaRevisionInputSchema.safeParse(value);
  if (!parsed.success) fail('Provide the exact saved asset, UUID key and presentation.', 400, 'pipeline_media_invalid');
  const saved = await receipt(client(), parsed.data.assetId, parsed.data.submissionKey, parsed.data.presentation);
  return { assetId: parsed.data.assetId, submissionKey: parsed.data.submissionKey, receipt: saved ? {
    id: saved.id, assetId: parsed.data.assetId, revisionNumber: saved.revision_number, status: saved.status, editorialReviewStatus: saved.editorial_review_status,
  } : null };
}

// Delete only this attempt's UUID-owned copy, and only after a readable reference
// check. Unknown transaction outcomes retain bytes for exact-key receipt reconciliation.
async function compensate(db: Client, bucket: string, path: string) {
  try {
    const { data, error } = await db.from('cardforge_contributor_asset_submissions').select('id')
      .eq('source_storage_bucket', bucket).eq('source_storage_path', path).limit(1);
    if (error || !data || data.length) return false;
    const result = await db.storage.from(bucket).remove([path]);
    return !result.error;
  } catch { return false; }
}

export async function createMediaPresentationRevision(value: unknown) {
  const parsed = mediaRevisionInputSchema.safeParse(value);
  if (!parsed.success) fail('Provide the exact base and a supported presentation change.', 400, 'pipeline_media_invalid');
  const input = parsed.data;
  const db = client();
  const existing = await receipt(db, input.assetId, input.submissionKey, input.presentation);
  if (existing) return { id: existing.id, revisionNumber: existing.revision_number, status: existing.status, editorialReviewStatus: existing.editorial_review_status, reused: true, cleanupPending: false };
  const base = await readBase(db, input.assetId);
  const p = input.presentation;
  if (base.parentSubmissionId !== p.parentSubmissionId || base.lineageId !== p.lineageId
    || base.baseRevisionNumber !== p.baseRevisionNumber || base.baseVersion !== p.baseVersion
    || base.intendedAccessTier !== p.intendedAccessTier || base.registryVersion !== p.registryVersion || JSON.stringify(base.baseline) !== JSON.stringify(p.baseline)
    || await sourceHash(db, base) !== p.sourceSha256) {
    fail('The source, classification or published presentation changed. Reload before creating a revision.', 409, 'pipeline_media_conflict');
  }
  const candidateId = randomUUID();
  const extension = ({ 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' } as Record<string, string>)[base.sourceMimeType] ?? 'bin';
  const path = `media-revisions/${candidateId}/${p.sourceSha256}.${extension}`;
  const storage = db.storage.from(base.sourceBucket);
  let commitAttempted = false;
  try {
    const { error: copyError } = await storage.copy(base.sourcePath, path);
    if (copyError) fail('The source copy could not be confirmed. Read the exact saved receipt before any further write.');
    if (await sourceHash(db, base, path) !== p.sourceSha256) {
      fail('The copied bytes do not match the exact source. No revision was created.', 409, 'pipeline_media_conflict');
    }
    const sourceUrl = storage.getPublicUrl(path).data.publicUrl;
    commitAttempted = true;
    const { error } = await db.rpc('cardforge_create_media_presentation_revision', {
      p_asset_id: input.assetId, p_submission_key: input.submissionKey, p_candidate_id: candidateId,
      p_presentation: p, p_source_url: sourceUrl, p_source_path: path,
    }).then((result) => result, () => ({ error: { code: undefined, message: 'transport_unavailable' } }));
    const saved = await receipt(db, input.assetId, input.submissionKey, p);
    if (saved) {
      const cleanupPending = saved.source_storage_path !== path
        ? !await compensate(db, base.sourceBucket, path) : false;
      return { id: saved.id, revisionNumber: saved.revision_number, status: saved.status, editorialReviewStatus: saved.editorial_review_status, reused: saved.id !== candidateId, cleanupPending };
    }
    // SQL exceptions are definitive rollbacks; transport failures are not.
    if (error && ['P0001', '55P03', '23505', '23514', '23503', '22023'].includes(error.code ?? '')) {
      commitAttempted = false;
      if (error.message.includes('conflict')) fail('The base or another candidate changed. Reload before continuing.', 409, 'pipeline_media_conflict');
      if (error.message.includes('invalid')) fail('The presentation candidate was rejected without changing the published asset.', 400, 'pipeline_media_invalid');
    }
    fail(commitAttempted
      ? 'The revision outcome could not be confirmed. Read the exact saved receipt before any further write; its copy has been retained.'
      : 'This invocation was rejected. Read the exact saved receipt and current base before any further write.');
  } catch (error) {
    if (!commitAttempted) {
      if (!await compensate(db, base.sourceBucket, path)) console.error('Media revision copy cleanup pending:', { candidateId, bucket: base.sourceBucket, path });
    } else {
      console.error('Media revision outcome uncertain; preserving owned copy:', { candidateId, assetId: input.assetId, submissionKey: input.submissionKey, bucket: base.sourceBucket, path });
    }
    throw error;
  }
}
