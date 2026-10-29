import { createHash } from 'node:crypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from './pipelineRegistryCommandsError';

/** Author-selected source identity. A URL, asset digest or registry alias alone never supplies authority. */
export interface ManagedRasterSelection {
  registryAssetId: string;
  publishedSubmissionId: string;
  elementId: string;
}

export interface ObservedManagedRasterSource {
  registryAssetId: string;
  lineageId: string;
  submissionId: string;
  revisionNumber: number;
  elementId: string;
  sourceBucket: string;
  sourcePath: string;
  /** Exact original source digest recorded by a trusted upload commitment. */
  originalSha256: string;
}

const unavailable = () => new PipelineRegistryCommandError(
  'The selected published raster revision or its exact managed bytes are unavailable.', 409,
  'managed_raster_adoption_unavailable',
);

type PublishedRasterRecord = {
  id: string;
  lineage_id: string;
  revision_number: number;
  status: string;
  published_at: string | null;
  target_registry_asset_id: string | null;
  source_storage_bucket: string | null;
  source_storage_path: string | null;
  source_mime_type: string | null;
  source_file_size_bytes: number | null;
  source_content_sha256: string | null;
  source_upload_token: string | null;
};

/**
 * Source-owner preflight for one deliberately chosen published managed raster.
 * This is deliberately read-only. It does not normalize/upload bytes,
 * modify a Template or produce a revision-atomic dependency. It requires a
 * trusted immutable upload digest; legacy source rows without one fail closed.
 * The native upload commitment and Template revision transaction must establish
 * that stored digest before this may authorize any adoption.
 */
export async function verifySelectedPublishedManagedRaster(
  selection: ManagedRasterSelection,
): Promise<ObservedManagedRasterSource> {
  if (!selection.registryAssetId?.trim() || !selection.publishedSubmissionId?.trim() || !selection.elementId?.trim()) throw unavailable();
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineRegistryCommandError('Pipeline source storage is unavailable.', 503);
  const { data: registry, error: registryError } = await db.from('cardforge_asset_registry')
    .select('asset_id,asset_type,status,contributor_submission_id').eq('asset_id',selection.registryAssetId).maybeSingle();
  if (registryError) throw new PipelineRegistryCommandError('Published raster identity could not be checked.', 503);
  if (!registry || registry.asset_type !== 'image' || registry.status !== 'published'
    || registry.contributor_submission_id !== selection.publishedSubmissionId) throw unavailable();

  const { data: source, error: sourceError } = await db.from('cardforge_contributor_asset_submissions')
    .select('id,lineage_id,revision_number,status,published_at,target_registry_asset_id,source_storage_bucket,source_storage_path,source_mime_type,source_file_size_bytes,source_content_sha256,source_upload_token')
    .eq('id',selection.publishedSubmissionId).maybeSingle();
  if (sourceError) throw new PipelineRegistryCommandError('Published raster revision could not be checked.', 503);
  const revision = source as PublishedRasterRecord | null;
  if (!revision || revision.id !== selection.publishedSubmissionId || !revision.lineage_id
    || revision.status !== 'published' || !revision.published_at
    || !Number.isInteger(revision.revision_number) || revision.revision_number < 1
    || revision.target_registry_asset_id !== selection.registryAssetId
    || revision.source_storage_bucket !== 'cardforge-contributor-assets'
    || !revision.source_storage_path || !revision.source_upload_token
    || !/^[a-f0-9]{64}$/u.test(revision.source_content_sha256 ?? '')
    || !['image/png','image/jpeg','image/webp'].includes(revision.source_mime_type ?? '')) throw unavailable();

  const { data: lineage, error: lineageError } = await db.from('cardforge_pipeline_asset_lineages')
    .select('id,registry_asset_id,upload_state,upload_submission_id,upload_operation_token,upload_source_path,catalog_trashed_at,purge_state,catalog_claim_token,catalog_destructive_uncertainty')
    .eq('id',revision.lineage_id).maybeSingle();
  if (lineageError) throw new PipelineRegistryCommandError('Raster ownership could not be verified.', 503);
  if (!lineage || lineage.id !== revision.lineage_id || lineage.registry_asset_id !== selection.registryAssetId
    || lineage.upload_state !== 'owned' || lineage.upload_submission_id !== revision.id
    || lineage.upload_operation_token !== revision.source_upload_token
    || lineage.upload_source_path !== revision.source_storage_path
    || lineage.catalog_trashed_at || lineage.purge_state || lineage.catalog_claim_token
    || lineage.catalog_destructive_uncertainty) throw unavailable();
  const { data: file, error: downloadError } = await db.storage.from(revision.source_storage_bucket)
    .download(revision.source_storage_path);
  if (downloadError || !file) throw new PipelineRegistryCommandError('Published raster bytes could not be verified.', 503);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > 2_400_000
    || (revision.source_file_size_bytes !== null && revision.source_file_size_bytes !== bytes.length)) throw unavailable();
  const originalSha256 = createHash('sha256').update(bytes).digest('hex');
  if (originalSha256 !== revision.source_content_sha256) throw unavailable();

  // This read-only observation is never an adoption receipt. The matching
  // native locked source/consumer transaction remains the authority.
  return {
    registryAssetId: selection.registryAssetId, lineageId: revision.lineage_id,
    submissionId: revision.id, revisionNumber: revision.revision_number,
    elementId: selection.elementId, sourceBucket: revision.source_storage_bucket,
    sourcePath: revision.source_storage_path, originalSha256,
  };
}
