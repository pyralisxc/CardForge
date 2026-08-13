import type {
  DeveloperAssetAccessTierOverride,
  DeveloperAssetStatus,
  DeveloperProgramSettings,
  DeveloperVoteValue,
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

export interface SetDeveloperAssetOwnerOverrideInput {
  submissionId: string;
  ownerStatusOverride?: DeveloperAssetStatus | null;
  ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null;
  ownerNote: string;
  ownerDeveloperId: string;
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

export interface PurgeDeveloperAssetSubmissionInput {
  submissionId: string;
  confirmationName: string;
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
  if (errorMessage?.includes('pipeline_asset_deleted_by_owner')) {
    throw new DeveloperAssetRegistryCommandError(
      'This shared template was permanently deleted by the owner and cannot accept new revisions.',
      409,
    );
  }
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

const throwDeveloperAssetPurgeError = (errorMessage?: string): never => {
  if (errorMessage?.includes('developer_asset_not_found')) {
    throw new DeveloperAssetRegistryCommandError('Developer asset submission was not found.', 404);
  }
  if (errorMessage?.includes('developer_asset_purge_confirmation_mismatch')) {
    throw new DeveloperAssetRegistryCommandError('Type the exact asset name to confirm permanent deletion.', 400);
  }
  if (errorMessage?.includes('developer_asset_storage_reference_incomplete')) {
    throw new DeveloperAssetRegistryCommandError(
      'This asset has an incomplete storage reference. Repair it before permanent deletion.',
      409,
    );
  }
  throw new DeveloperAssetRegistryCommandError('Unable to permanently delete this developer asset.', 500);
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

export const castDeveloperAssetVote = async ({
  submissionId,
  developerId,
  voteValue,
  ownerDeveloperId,
}: {
  submissionId: string;
  developerId: string;
  voteValue: DeveloperVoteValue;
  ownerDeveloperId?: string | null;
}): Promise<void> => {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('cardforge_cast_developer_asset_vote', {
    p_submission_id: submissionId,
    p_developer_id: developerId,
    p_vote_value: voteValue,
    p_owner_developer_id: ownerDeveloperId ?? null,
  });
  if (error) {
    if (error.message?.includes('template_revision_conflict')) {
      throwTemplateRevisionError(error.message);
    }
    const statusCode = error.message?.includes('developer_asset_not_found') ? 404 : 500;
    throw new DeveloperAssetRegistryCommandError(
      statusCode === 404
        ? 'Developer asset submission was not found.'
        : 'Unable to save the vote and automatic pipeline decision.',
      statusCode,
    );
  }
};

export const saveDeveloperProgramSettings = async (
  settings: DeveloperProgramSettings,
  ownerDeveloperId: string,
): Promise<void> => {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('cardforge_update_developer_program_settings', {
    p_settings: settings,
    p_owner_developer_id: ownerDeveloperId,
  });
  if (error) {
    throw new DeveloperAssetRegistryCommandError(
      'Unable to save the automatic developer pipeline rules.',
      500,
    );
  }
};

export const setDeveloperAssetOwnerOverride = async ({
  submissionId,
  ownerStatusOverride,
  ownerAccessTierOverride,
  ownerNote,
  ownerDeveloperId,
}: SetDeveloperAssetOwnerOverrideInput): Promise<void> => {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('cardforge_set_developer_asset_owner_override', {
    p_submission_id: submissionId,
    p_update_status_override: ownerStatusOverride !== undefined,
    p_status_override: ownerStatusOverride ?? null,
    p_update_tier_override: ownerAccessTierOverride !== undefined,
    p_tier_override: ownerAccessTierOverride ?? null,
    p_owner_note: ownerNote,
    p_owner_developer_id: ownerDeveloperId,
  });
  if (error) {
    if (error.message?.includes('template_revision_conflict')) {
      throwTemplateRevisionError(error.message);
    }
    const statusCode = error.message?.includes('developer_asset_not_found') ? 404 : 500;
    throw new DeveloperAssetRegistryCommandError(
      statusCode === 404
        ? 'Developer asset submission was not found.'
        : 'Unable to save the owner override and shared library state.',
      statusCode,
    );
  }
};

export const purgeDeveloperAssetSubmission = async ({
  submissionId,
  confirmationName,
}: PurgeDeveloperAssetSubmissionInput): Promise<void> => {
  const supabase = requireSupabase();
  const { data, error: prepareError } = await supabase.rpc('cardforge_prepare_developer_asset_purge', {
    p_submission_id: submissionId,
    p_expected_name: confirmationName,
  });
  if (prepareError) throwDeveloperAssetPurgeError(prepareError.message);

  const rawObjects = (data as { storageObjects?: unknown } | null)?.storageObjects;
  const objects = Array.isArray(rawObjects)
    ? rawObjects.filter((value): value is { storageBucket: string; storagePath: string } => {
        if (!value || typeof value !== 'object') return false;
        const candidate = value as { storageBucket?: unknown; storagePath?: unknown };
        return typeof candidate.storageBucket === 'string' && typeof candidate.storagePath === 'string';
      })
    : [];
  const pathsByBucket = new Map<string, Set<string>>();
  for (const object of objects) {
    const paths = pathsByBucket.get(object.storageBucket) ?? new Set<string>();
    paths.add(object.storagePath);
    pathsByBucket.set(object.storageBucket, paths);
  }

  for (const [storageBucket, storagePaths] of pathsByBucket) {
    const { error: storageError } = await supabase.storage.from(storageBucket).remove([...storagePaths]);
    if (storageError) {
      throw new DeveloperAssetRegistryCommandError(
        'Some asset storage still needs deletion. Retry this action; the asset lineage remains in a recoverable pending state.',
        503,
      );
    }
  }

  const { error: finalizeError } = await supabase.rpc('cardforge_finalize_developer_asset_purge', {
    p_submission_id: submissionId,
  });
  if (finalizeError) {
    throw new DeveloperAssetRegistryCommandError(
      'The file was removed, but the database cleanup still needs to finish. Retry permanent deletion for this asset.',
      503,
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
  const ownerEmail = process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS
    ?.split(',')
    .map((email) => email.trim().toLowerCase())
    .find(Boolean);
  if (!ownerEmail) {
    throw new DeveloperAssetRegistryCommandError(
      'CARDFORGE_OWNER_ACCOUNT_EMAILS must include the Pipeline owner for shared-library writes.',
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
