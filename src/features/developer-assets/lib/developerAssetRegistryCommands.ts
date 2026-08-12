import type {
  DeveloperAssetAccessTier,
  DeveloperAssetAccessTierOverride,
  DeveloperAssetStatus,
} from '@/features/developer-assets/lib/developerAssets';
import type { TCGCardTemplate } from '@/domain/templates';
import { getDeveloperProfileReferenceByEmail } from '@/features/developer-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export class DeveloperAssetRegistryCommandError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DeveloperAssetRegistryCommandError';
  }
}

export interface TransitionDeveloperAssetStatusInput {
  submissionId: string;
  status: DeveloperAssetStatus;
  ownerNote: string;
  ownerAccessTierOverride: DeveloperAssetAccessTierOverride | null;
  ownerAccessTierOverrideProvided: boolean;
  calculatedAccessTier: DeveloperAssetAccessTier;
  qualityScore: number;
  tierDecisionReason: string;
  registryMetadata: Record<string, unknown>;
}

export interface UpsertPipelineRegistryAssetInput {
  assetId: string;
  name: string;
  submissionAssetType: 'templates' | 'elementPresets';
  registryAssetType: 'template' | 'elementPreset';
  url: string;
  previewUrl?: string;
  description: string;
  fileSizeBytes: number;
  sourceMimeType?: string;
  storageBucket?: string | null;
  storagePath?: string | null;
  metadata: Record<string, unknown>;
}

export interface SubmitTemplateRevisionInput {
  template: TCGCardTemplate & { id: string };
  developerId: string;
  developerEmail: string | null;
  expectedRevision: number;
  submissionKey: string;
}

export interface SubmittedTemplateRevision {
  id: string;
  status: 'submitted';
  baseRevision: number;
  revisionNumber: number;
  assetId: string;
}

const requireSupabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new DeveloperAssetRegistryCommandError('Developer asset database is not configured yet.', 503);
  }
  return supabase;
};

const throwRegistryCommandError = (message: string, errorMessage?: string): never => {
  const status = errorMessage?.includes('pipeline_asset_not_found') ? 404 : 500;
  throw new DeveloperAssetRegistryCommandError(
    status === 404 ? 'The shared library asset was not found.' : message,
    status,
  );
};

const throwTemplateRevisionError = (errorMessage?: string): never => {
  if (errorMessage?.includes('template_revision_conflict')) {
    throw new DeveloperAssetRegistryCommandError(
      'This base card design changed after you opened it. Reload the shared library, review the latest version, and submit again.',
      409,
    );
  }
  if (errorMessage?.includes('invalid_template_revision')) {
    throw new DeveloperAssetRegistryCommandError('The template revision is incomplete or invalid.', 400);
  }
  throw new DeveloperAssetRegistryCommandError('Unable to submit the template revision.', 500);
};

export const submitTemplateRevision = async ({
  template,
  developerId,
  developerEmail,
  expectedRevision,
  submissionKey,
}: SubmitTemplateRevisionInput): Promise<SubmittedTemplateRevision> => {
  const supabase = requireSupabase();
  const { data: revisionId, error } = await supabase.rpc('cardforge_submit_template_revision', {
    p_asset_id: template.id,
    p_name: template.name,
    p_description: template.templateDescription ?? 'Base card design revision submitted from CardForge Studio.',
    p_developer_id: developerId,
    p_developer_email: developerEmail ?? '',
    p_template_payload: {
      ...template,
      templateSource: 'default',
      templateLibrarySource: 'pipeline',
      templateRegistryStatus: 'submitted',
    },
    p_expected_revision: expectedRevision,
    p_submission_key: submissionKey,
  });
  if (error || !revisionId) throwTemplateRevisionError(error?.message);

  const { data: rows, error: loadError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id,status,base_revision_number,revision_number,target_registry_asset_id')
    .eq('id', String(revisionId))
    .limit(1);
  if (loadError || !rows?.[0]) {
    throw new DeveloperAssetRegistryCommandError(
      'The revision was accepted, but its confirmation could not be loaded. Retry the same save to confirm it safely.',
      503,
    );
  }
  const row = rows[0] as {
    id: string;
    status: string;
    base_revision_number: number;
    revision_number: number;
    target_registry_asset_id: string;
  };
  return {
    id: row.id,
    status: 'submitted',
    baseRevision: row.base_revision_number,
    revisionNumber: row.revision_number,
    assetId: row.target_registry_asset_id,
  };
};

export const transitionDeveloperAssetStatus = async ({
  submissionId,
  status,
  ownerNote,
  ownerAccessTierOverride,
  ownerAccessTierOverrideProvided,
  calculatedAccessTier,
  qualityScore,
  tierDecisionReason,
  registryMetadata,
}: TransitionDeveloperAssetStatusInput): Promise<void> => {
  const supabase = requireSupabase();

  const { error } = await supabase.rpc('cardforge_transition_developer_asset', {
    p_submission_id: submissionId,
    p_status: status,
    p_owner_note: ownerNote,
    p_owner_access_tier_override: ownerAccessTierOverride,
    p_has_owner_access_tier_override: ownerAccessTierOverrideProvided,
    p_calculated_access_tier: calculatedAccessTier,
    p_quality_score: qualityScore,
    p_tier_decision_reason: tierDecisionReason,
    p_registry_metadata: registryMetadata,
  });

  if (error) {
    if (error.message?.includes('template_revision_conflict')) {
      throwTemplateRevisionError(error.message);
    }
    const statusCode = error.message?.includes('developer_asset_not_found') ? 404 : 500;
    throw new DeveloperAssetRegistryCommandError(
      statusCode === 404
        ? 'Developer asset submission was not found.'
        : 'Unable to update the developer submission and shared registry.',
      statusCode,
    );
  }
};

export const upsertPipelineRegistryAsset = async ({
  assetId,
  name,
  submissionAssetType,
  registryAssetType,
  url,
  previewUrl = url,
  description,
  fileSizeBytes,
  sourceMimeType = 'application/json',
  storageBucket = null,
  storagePath = null,
  metadata,
}: UpsertPipelineRegistryAssetInput): Promise<void> => {
  const ownerEmail = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL?.trim();
  if (!ownerEmail) {
    throw new DeveloperAssetRegistryCommandError(
      'CARDFORGE_PIPELINE_OWNER_EMAIL is required for shipped-library writes.',
      503,
    );
  }

  const ownerProfile = await getDeveloperProfileReferenceByEmail(ownerEmail);
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('cardforge_upsert_pipeline_registry_asset', {
    p_asset_id: assetId,
    p_name: name,
    p_submission_asset_type: submissionAssetType,
    p_registry_asset_type: registryAssetType,
    p_url: url,
    p_preview_url: previewUrl,
    p_description: description,
    p_developer_id: ownerProfile?.developerId || ownerEmail,
    p_developer_email: ownerProfile?.email || ownerEmail,
    p_file_size_bytes: fileSizeBytes,
    p_source_mime_type: sourceMimeType,
    p_storage_bucket: storageBucket,
    p_storage_path: storagePath,
    p_metadata: metadata,
  });

  if (error) {
    throwRegistryCommandError('Unable to save the shared library asset.', error.message);
  }
};

export const archivePipelineRegistryAsset = async (assetId: string): Promise<void> => {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('cardforge_archive_pipeline_registry_asset', {
    p_asset_id: assetId,
  });

  if (error) {
    throwRegistryCommandError('Unable to archive the shared library asset.', error.message);
  }
};
