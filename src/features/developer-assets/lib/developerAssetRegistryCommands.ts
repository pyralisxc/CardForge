import type {
  DeveloperAssetAccessTier,
  DeveloperAssetAccessTierOverride,
  DeveloperAssetStatus,
} from '@/features/developer-assets/lib/developerAssets';
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
