import { createHash } from 'node:crypto';
import type { TCGCardTemplate } from '@/domain/templates';
import { getImageFieldKeyForElement } from '@/domain/rendering';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from './pipelineRegistryCommandsError';
import { storePipelineTemplateAsset } from './pipelineTemplateAssets';

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
};

/** An authored selection is static only when the current Template cannot
 * resolve an image field or preview override ahead of its selected media slot.
 * No field contract, preview data or child content is silently removed.
 */
export function assertStaticManagedRasterSlot(
  template: TCGCardTemplate & { id: string },
  selection: ManagedRasterSelection,
): void {
  const elements = template.freeformCanvas?.elements ?? [];
  const chosen = elements.filter(element => element.id === selection.elementId);
  if (chosen.length !== 1 || chosen[0].type !== 'image') throw unavailable();
  const image = chosen[0];
  if (image.imageSource?.includes('{{') || image.content?.includes('{{')
    || template.fieldContracts?.some(contract => contract.type === 'image'
      && (contract.elementId === image.id || (!contract.elementId && contract.key === getImageFieldKeyForElement(image))))
    || template.templatePreviewData?.[getImageFieldKeyForElement(image)] !== undefined) throw unavailable();
}

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
    .select('asset_id,asset_type,status,access_tier,contributor_submission_id').eq('asset_id',selection.registryAssetId).maybeSingle();
  if (registryError) throw new PipelineRegistryCommandError('Published raster identity could not be checked.', 503);
  if (!registry || registry.asset_type !== 'image' || registry.status !== 'published' || registry.access_tier !== 'free'
    || registry.contributor_submission_id !== selection.publishedSubmissionId) throw unavailable();

  const { data: source, error: sourceError } = await db.from('cardforge_contributor_asset_submissions')
    .select('id,lineage_id,revision_number,status,published_at,target_registry_asset_id,source_storage_bucket,source_storage_path,source_mime_type,source_file_size_bytes')
    .eq('id',selection.publishedSubmissionId).maybeSingle();
  if (sourceError) throw new PipelineRegistryCommandError('Published raster revision could not be checked.', 503);
  const revision = source as PublishedRasterRecord | null;
  if (!revision || revision.id !== selection.publishedSubmissionId || !revision.lineage_id
    || revision.status !== 'published' || !revision.published_at
    || !Number.isInteger(revision.revision_number) || revision.revision_number < 1
    || revision.target_registry_asset_id !== selection.registryAssetId
    || revision.source_storage_bucket !== 'cardforge-contributor-assets'
    || !revision.source_storage_path || !revision.source_storage_path.startsWith('pipeline-owned-v1/')
    || !['image/png','image/jpeg','image/webp'].includes(revision.source_mime_type ?? '')) throw unavailable();

  const { data: lineage, error: lineageError } = await db.from('cardforge_pipeline_asset_lineages')
    .select('id,registry_asset_id,upload_state,upload_submission_id,upload_operation_token,upload_request,upload_source_path,catalog_trashed_at,purge_state,catalog_claim_token,catalog_claimed_at,catalog_destructive_uncertainty')
    .eq('id',revision.lineage_id).maybeSingle();
  if (lineageError) throw new PipelineRegistryCommandError('Raster ownership could not be verified.', 503);
  if (!lineage || lineage.id !== revision.lineage_id || lineage.registry_asset_id !== selection.registryAssetId
    || lineage.upload_state !== 'owned' || !lineage.upload_submission_id
    || !lineage.upload_operation_token || !lineage.upload_request
    || lineage.upload_source_path !== revision.source_storage_path
    || lineage.catalog_trashed_at || lineage.purge_state || lineage.catalog_claim_token || lineage.catalog_claimed_at
    || lineage.catalog_destructive_uncertainty) throw unavailable();
  // The upload receipt is immutable and may precede this published revision.
  // Match its original operation/lineage/Storage tuple, not its id to the
  // current publication submission.
  const { data: receipt, error: receiptError } = await db.from('cardforge_contributor_asset_submissions')
    .select('id,lineage_id,source_upload_token,source_storage_bucket,source_storage_path,source_content_sha256')
    .eq('id',lineage.upload_submission_id).maybeSingle();
  if (receiptError) throw new PipelineRegistryCommandError('Original upload receipt is unavailable.',503);
  if (!receipt || receipt.id !== lineage.upload_submission_id || receipt.lineage_id !== revision.lineage_id
    || receipt.source_upload_token !== lineage.upload_operation_token
    || receipt.source_storage_bucket !== revision.source_storage_bucket
    || receipt.source_storage_path !== revision.source_storage_path
    || !/^[a-f0-9]{64}$/u.test(receipt.source_content_sha256 ?? '')) throw unavailable();
  const { data: file, error: downloadError } = await db.storage.from(revision.source_storage_bucket)
    .download(revision.source_storage_path);
  if (downloadError || !file) throw new PipelineRegistryCommandError('Published raster bytes could not be verified.', 503);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > 2_400_000
    || (revision.source_file_size_bytes !== null && revision.source_file_size_bytes !== bytes.length)) throw unavailable();
  const originalSha256 = createHash('sha256').update(bytes).digest('hex');
  if (originalSha256 !== receipt.source_content_sha256) throw unavailable();

  // This read-only observation is never an adoption receipt. The matching
  // native locked source/consumer transaction remains the authority.
  return {
    registryAssetId: selection.registryAssetId, lineageId: revision.lineage_id,
    submissionId: revision.id, revisionNumber: revision.revision_number,
    elementId: selection.elementId, sourceBucket: revision.source_storage_bucket,
    sourcePath: revision.source_storage_path, originalSha256,
  };
}

/**
 * Server-owned authoring preparation. This is not a persisted attestation:
 * the native revision RPC locks and rechecks the source and the exact new
 * payload within one transaction before recording its binding.
 */
export async function prepareManagedRasterTemplateRevision(
  template: TCGCardTemplate & { id: string },
  selection: ManagedRasterSelection,
) {
  assertStaticManagedRasterSlot(template, selection);
  const observed = await verifySelectedPublishedManagedRaster(selection);
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineRegistryCommandError('Pipeline source storage is unavailable.', 503);
  const { data: file, error } = await db.storage.from(observed.sourceBucket).download(observed.sourcePath);
  if (error || !file) throw new PipelineRegistryCommandError('Published raster bytes are unavailable.', 503);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== observed.originalSha256) throw unavailable();
  // This creates an independently content-addressed normalized Template WebP.
  // Never delete it as compensation: other Templates may already share it.
  const reference = await storePipelineTemplateAsset(bytes);
  const normalizedSha256 = /^cardforge-pipeline-asset:\/\/([a-f0-9]{64})$/u.exec(reference)?.[1];
  if (!normalizedSha256) throw unavailable();
  const prepared: TCGCardTemplate & { id: string } = {
    ...template,
    freeformCanvas: {
      ...template.freeformCanvas!,
      elements: template.freeformCanvas!.elements.map(e => e.id === selection.elementId
        ? { ...e, imageSource: reference }
        : e),
    },
  };
  return {
    template: prepared,
    adoption: {
      assetId: observed.registryAssetId,
      submissionId: observed.submissionId,
      elementId: selection.elementId,
      originalSha256: observed.originalSha256,
      normalizedSha256,
    },
  };
}
