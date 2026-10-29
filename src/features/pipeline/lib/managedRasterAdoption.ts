import { createHash } from 'node:crypto';
import type { TCGCardTemplate } from '@/domain/templates';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from './pipelineRegistryCommandsError';
import { storePipelineTemplateAsset } from './pipelineTemplateAssets';

/** Author-selected source identity. A URL, asset digest or registry alias alone never supplies authority. */
export interface ManagedRasterSelection {
  registryAssetId: string;
  publishedSubmissionId: string;
  elementId: string;
}

export interface VerifiedManagedRasterAdoption {
  registryAssetId: string;
  lineageId: string;
  submissionId: string;
  revisionNumber: number;
  elementId: string;
  sourceBucket: string;
  sourcePath: string;
  /** SHA-256 of the published managed source bytes, before Template normalization. */
  originalSha256: string;
  /** Separate SHA-256 of the normalized Template WebP bytes. */
  templateWebpSha256: string;
  normalizedReference: string;
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

export function applyVerifiedManagedRasterToTemplate(
  template: TCGCardTemplate & { id: string },
  selection: ManagedRasterSelection,
  result: VerifiedManagedRasterAdoption,
): TCGCardTemplate & { id: string } {
  if (!selection.elementId || result.elementId !== selection.elementId
    || result.registryAssetId !== selection.registryAssetId
    || result.submissionId !== selection.publishedSubmissionId
    || !template.freeformCanvas) throw unavailable();
  const matches = template.freeformCanvas.elements.filter(e => e.id === selection.elementId);
  if (matches.length !== 1 || matches[0].type !== 'image') throw unavailable();
  return {
    ...template,
    freeformCanvas: {
      ...template.freeformCanvas,
      elements: template.freeformCanvas.elements.map(element => element.id === selection.elementId
        ? { ...element, imageSource: result.normalizedReference }
        : element),
    },
  };
}

/**
 * Source-owner preflight for one deliberately chosen published managed raster.
 * This does not record a durable dependency or change Template publication state.
 * A native, revision-atomic binding must be written before this preflight may
 * be used as catalog admission evidence.
 */
export async function verifySelectedPublishedManagedRaster(
  selection: ManagedRasterSelection,
): Promise<VerifiedManagedRasterAdoption> {
  if (!selection.registryAssetId?.trim() || !selection.publishedSubmissionId?.trim() || !selection.elementId?.trim()) throw unavailable();
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineRegistryCommandError('Pipeline source storage is unavailable.', 503);
  const { data: registry, error: registryError } = await db.from('cardforge_asset_registry')
    .select('asset_id,asset_type,status,contributor_submission_id').eq('asset_id',selection.registryAssetId).maybeSingle();
  if (registryError) throw new PipelineRegistryCommandError('Published raster identity could not be checked.', 503);
  if (!registry || registry.asset_type !== 'image' || registry.status !== 'published'
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
    || !revision.source_storage_bucket || !revision.source_storage_path
    || !['image/png','image/jpeg','image/webp'].includes(revision.source_mime_type ?? '')) throw unavailable();

  const { data: file, error: downloadError } = await db.storage.from(revision.source_storage_bucket)
    .download(revision.source_storage_path);
  if (downloadError || !file) throw new PipelineRegistryCommandError('Published raster bytes could not be verified.', 503);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > 2_400_000
    || (revision.source_file_size_bytes !== null && revision.source_file_size_bytes !== bytes.length)) throw unavailable();
  const originalSha256 = createHash('sha256').update(bytes).digest('hex');

  // Normalization produces distinct owned bytes: the digest cannot confer
  // the original source's lineage or future deletion authority.
  const normalizedReference = await storePipelineTemplateAsset(bytes);
  const templateWebpSha256 = /^cardforge-pipeline-asset:\/\/([a-f0-9]{64})$/u.exec(normalizedReference)?.[1];
  if (!templateWebpSha256) throw unavailable();

  const { data: current, error: currentError } = await db.from('cardforge_asset_registry')
    .select('contributor_submission_id,status').eq('asset_id',selection.registryAssetId).maybeSingle();
  if (currentError) throw new PipelineRegistryCommandError('Published raster changed during adoption.', 503);
  if (!current || current.status !== 'published'
    || current.contributor_submission_id !== selection.publishedSubmissionId) throw unavailable();

  return {
    registryAssetId: selection.registryAssetId, lineageId: revision.lineage_id,
    submissionId: revision.id, revisionNumber: revision.revision_number,
    elementId: selection.elementId, sourceBucket: revision.source_storage_bucket,
    sourcePath: revision.source_storage_path, originalSha256,
    templateWebpSha256, normalizedReference,
  };
}
