import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  isDeveloperAssetAccessTierOverride,
  isDeveloperAssetStatus,
  normalizeDeveloperProgramSettingsInput,
  type DeveloperProgramSettings,
} from '@/features/developer-assets/lib/developerAssets';
import {
  countActiveDevelopers,
  DeveloperAccessStoreError,
  fetchDeveloperProfileRows,
  updateDeveloperAssetProfileRules,
} from '@/features/developer-access/server';
import {
  castDeveloperAssetVote,
  DeveloperAssetRegistryCommandError,
  purgeDeveloperAssetSubmission,
  saveDeveloperProgramSettings,
  setDeveloperAssetOwnerOverride,
  submitTemplatePipelineDraft,
} from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import {
  buildDeveloperAssetProgramView,
  mapDeveloperProgramSettingsRow,
  normalizeDeveloperAssetLongText,
  normalizeDeveloperAssetShortText,
  normalizeDeveloperAssetSubmissionEditInput,
  normalizeDeveloperAssetSubmissionInput,
  normalizeDeveloperProfileOverrideInput,
  type DeveloperAssetProgramView,
  type DeveloperProgramSettingsRow,
  type DeveloperProfileOverrideInput,
} from './developerAssetProgram';
import { DeveloperAssetStoreError } from './developerAssetStoreError';
import {
  fetchDeveloperAssetProgramAggregate,
  fetchDeveloperAssetSubmissionPage,
  type DeveloperAssetListQuery,
} from './developerAssetProjections';

export { DeveloperAssetStoreError } from './developerAssetStoreError';

const runRegistryCommand = async (command: () => Promise<void>): Promise<void> => {
  try {
    await command();
  } catch (error) {
    if (error instanceof DeveloperAssetRegistryCommandError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }
};

const PROGRAM_SETTINGS_ID = 'default';

const fetchDeveloperSettings = async (): Promise<{ configured: boolean; settings: DeveloperProgramSettings }> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  const settingsColumns = 'max_active_developers,monthly_submission_limit,monthly_published_requirement,minimum_votes_for_grading,free_asset_minimum_positive_vote_percent,paid_asset_minimum_positive_vote_percent,allow_contributor_self_voting,owner_vote_weight,tier_caps_by_type';
  const { data, error } = await supabase
    .from('cardforge_developer_program_settings')
    .select(settingsColumns)
    .eq('id', PROGRAM_SETTINGS_ID)
    .limit(1);

  if (error) {
    console.error('Failed to load developer asset program settings:', error);
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  return {
    configured: true,
    settings: mapDeveloperProgramSettingsRow(data?.[0] as DeveloperProgramSettingsRow | undefined),
  };
};

export const getDeveloperAssetProgramView = async (
  currentUserId: string,
  currentContributorIds: string[] = [currentUserId],
  {
    includeRegistryRecipePayloads = false,
    submissionQuery,
    votingQuery,
  }: {
    includeRegistryRecipePayloads?: boolean;
    submissionQuery?: DeveloperAssetListQuery;
    votingQuery?: DeveloperAssetListQuery;
  } = {},
): Promise<DeveloperAssetProgramView> => {
  const { configured, settings } = await fetchDeveloperSettings();
  const [profiles, activeDeveloperCount, aggregate] = await Promise.all([
    fetchDeveloperProfileRows(),
    countActiveDevelopers(),
    fetchDeveloperAssetProgramAggregate(currentUserId, settings.allowContributorSelfVoting),
  ]);
  const [submissionPage, votingPage] = await Promise.all([
    fetchDeveloperAssetSubmissionPage({
      currentUserId,
      profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: settings.allowContributorSelfVoting,
      query: submissionQuery ?? {
        scope: includeRegistryRecipePayloads ? 'all' : 'own',
        page: 1,
        pageSize: 12,
      },
    }),
    fetchDeveloperAssetSubmissionPage({
      currentUserId,
      profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: settings.allowContributorSelfVoting,
      query: votingQuery ?? { scope: 'review', page: 1, pageSize: 10 },
    }),
  ]);
  return buildDeveloperAssetProgramView({
    configured,
    settings,
    currentUserId,
    currentContributorIds,
    submissions: submissionPage.submissions,
    votingQueue: votingPage.submissions,
    submissionPage,
    votingPage,
    aggregate,
    profiles,
    activeDeveloperCount,
  });
};

export const getDeveloperAssetVotePolicy = async (
  submissionId: string,
): Promise<{ allowContributorSelfVoting: boolean; submissionDeveloperId: string | null }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const [{ settings }, { data, error }] = await Promise.all([
    fetchDeveloperSettings(),
    supabase
      .from('cardforge_developer_asset_submissions')
      .select('developer_id')
      .eq('id', submissionId)
      .limit(1),
  ]);

  if (error) {
    console.error('Failed to load developer asset vote policy:', error);
    throw new DeveloperAssetStoreError('Unable to load vote rules for this submission.', 500);
  }

  const row = data?.[0] as { developer_id?: string | null } | undefined;
  return {
    allowContributorSelfVoting: settings.allowContributorSelfVoting,
    submissionDeveloperId: row?.developer_id ?? null,
  };
};

export const updateDeveloperProfileOverrides = async ({
  developerId,
  input,
  currentUserId = '',
  currentContributorIds = currentUserId ? [currentUserId] : [],
}: {
  developerId: string;
  input: DeveloperProfileOverrideInput;
  currentUserId?: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);
  const normalizedDeveloperId = normalizeDeveloperAssetShortText(developerId, 160);
  if (!normalizedDeveloperId) throw new DeveloperAssetStoreError('Choose a developer profile to update.', 400);

  const normalized = normalizeDeveloperProfileOverrideInput(input);
  const updateRow = {
    monthly_submission_limit_override: normalized.monthly_submission_limit_override,
    monthly_published_requirement_override: normalized.monthly_published_requirement_override,
    owner_note: normalized.owner_note,
    ...(normalized.status ? { status: normalized.status } : {}),
  };
  try {
    await updateDeveloperAssetProfileRules({
      developerId: normalizedDeveloperId,
      rules: updateRow,
    });
  } catch (error) {
    if (error instanceof DeveloperAccessStoreError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const updateDeveloperProgramSettings = async (
  input: Partial<Record<keyof DeveloperProgramSettings, unknown>>,
  currentUserId = '',
  currentContributorIds: string[] = currentUserId ? [currentUserId] : [],
): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const normalized = normalizeDeveloperProgramSettingsInput(input);
  if (!currentUserId) throw new DeveloperAssetStoreError('Owner identity is required to update pipeline rules.', 403);
  await runRegistryCommand(() => saveDeveloperProgramSettings(normalized, currentUserId));
  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const createDeveloperAssetSubmission = async ({
  developerId,
  developerEmail,
  input,
  currentContributorIds = [developerId],
  includeRegistryRecipePayloads = false,
}: {
  developerId: string;
  developerEmail: string | null;
  currentContributorIds?: string[];
  includeRegistryRecipePayloads?: boolean;
  input: {
    assetType?: unknown;
    studioDestination?: unknown;
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
    sourceUrl?: unknown;
    sourceFileSizeBytes?: unknown;
    sourceMimeType?: unknown;
    sourceStorageBucket?: unknown;
    sourceStoragePath?: unknown;
  };
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const view = await getDeveloperAssetProgramView(developerId, currentContributorIds, { includeRegistryRecipePayloads });
  if (view.remainingSubmissions <= 0) {
    throw new DeveloperAssetStoreError('This developer has reached the monthly submission limit.', 400);
  }

  const normalized = normalizeDeveloperAssetSubmissionInput(input);
  if (!normalized.ok) throw new DeveloperAssetStoreError(normalized.message, 400);

  const { error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .insert({
      developer_id: developerId,
      developer_email: developerEmail,
      asset_type: normalized.value.assetType,
      requested_studio_destination: normalized.value.requestedStudioDestination,
      name: normalized.value.name,
      description: normalized.value.description,
      preview_url: normalized.value.previewUrl,
      source_url: normalized.value.sourceUrl,
      source_file_size_bytes: normalized.value.sourceFileSizeBytes,
      source_mime_type: normalized.value.sourceMimeType,
      source_storage_bucket: normalized.value.sourceStorageBucket,
      source_storage_path: normalized.value.sourceStoragePath,
      status: 'voting',
      automated_status: 'voting',
      owner_status_override: null,
      calculated_access_tier: 'developer',
      automated_access_tier: 'developer',
      owner_access_tier_override: null,
      quality_score: 0,
      tier_decision_reason: 'needs_more_votes',
      positive_votes: 0,
      negative_votes: 0,
    });

  if (error) {
    console.error('Failed to create developer asset submission:', error);
    throw new DeveloperAssetStoreError('Unable to submit developer asset.', 500);
  }

  try {
    return await getDeveloperAssetProgramView(developerId, currentContributorIds, { includeRegistryRecipePayloads });
  } catch (error) {
    console.error('Developer asset was submitted, but the refreshed program view was unavailable:', error);
    return view;
  }
};

export const voteOnDeveloperAssetSubmission = async ({
  submissionId,
  developerId,
  voteValue,
  currentContributorIds = [developerId],
  ownerDeveloperId,
}: {
  submissionId: string;
  developerId: string;
  voteValue: unknown;
  currentContributorIds?: string[];
  ownerDeveloperId?: string | null;
}): Promise<DeveloperAssetProgramView> => {
  if (voteValue !== 'positive' && voteValue !== 'negative') {
    throw new DeveloperAssetStoreError('Choose a supported vote value.', 400);
  }
  await runRegistryCommand(() => castDeveloperAssetVote({
    submissionId,
    developerId,
    voteValue,
    ownerDeveloperId,
  }));
  return getDeveloperAssetProgramView(developerId, currentContributorIds, {
    includeRegistryRecipePayloads: Boolean(ownerDeveloperId),
  });
};

export const updateDeveloperAssetSubmissionDetails = async ({
  submissionId,
  developerId,
  input,
  allowOwnerEdit = false,
  currentContributorIds = [developerId],
}: {
  submissionId: string;
  developerId: string;
  input: {
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
    sourceNotes?: unknown;
    specialtyTags?: unknown;
    useCaseTags?: unknown;
    requestedStudioDestination?: unknown;
  };
  allowOwnerEdit?: boolean;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const { data: rows, error: loadError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,status,source_url,asset_type')
    .eq('id', submissionId)
    .limit(1);

  if (loadError) {
    console.error('Failed to load editable developer asset submission:', loadError);
    throw new DeveloperAssetStoreError('Unable to load developer asset submission.', 500);
  }

  const row = rows?.[0] as { developer_id?: string; status?: unknown; source_url?: string | null; asset_type?: unknown } | undefined;
  if (!row) throw new DeveloperAssetStoreError('Developer asset submission was not found.', 404);
  if (!allowOwnerEdit && row.developer_id !== developerId) {
    throw new DeveloperAssetStoreError('Only the uploader can edit this asset.', 403);
  }
  if (row.status === 'published' || row.status === 'rejected') {
    throw new DeveloperAssetStoreError('Published or rejected assets cannot be edited from the developer hub.', 400);
  }

  const normalized = normalizeDeveloperAssetSubmissionEditInput({ ...input, assetType: row.asset_type });
  if (!normalized.ok) throw new DeveloperAssetStoreError(normalized.message, 400);

  const previewUrl = normalized.value.previewUrl || row.source_url || '';
  const { error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .update({
      name: normalized.value.name,
      description: normalized.value.description,
      preview_url: previewUrl,
      ...(normalized.value.sourceNotes !== undefined ? { source_notes: normalized.value.sourceNotes } : {}),
      ...(normalized.value.specialtyTags !== undefined ? { specialty_tags: normalized.value.specialtyTags } : {}),
      ...(normalized.value.useCaseTags !== undefined ? { use_case_tags: normalized.value.useCaseTags } : {}),
      ...(normalized.value.requestedStudioDestination !== undefined
        ? { requested_studio_destination: normalized.value.requestedStudioDestination }
        : {}),
    })
    .eq('id', submissionId);

  if (error) {
    console.error('Failed to edit developer asset submission:', error);
    throw new DeveloperAssetStoreError('Unable to edit developer asset submission.', 500);
  }

  return getDeveloperAssetProgramView(developerId, currentContributorIds, {
    includeRegistryRecipePayloads: allowOwnerEdit,
  });
};

export const finalizeDeveloperTemplatePipelineDraft = async ({
  submissionId,
  developerId,
  input,
  currentContributorIds = [developerId],
  includeRegistryRecipePayloads = false,
}: {
  submissionId: string;
  developerId: string;
  input: {
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
    sourceNotes?: unknown;
    specialtyTags?: unknown;
    useCaseTags?: unknown;
    requestedStudioDestination?: unknown;
  };
  currentContributorIds?: string[];
  includeRegistryRecipePayloads?: boolean;
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);
  const { data: rows, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,status,asset_type')
    .eq('id', submissionId)
    .limit(1);
  if (error) throw new DeveloperAssetStoreError('Unable to load the Template Pipeline draft.', 500);
  const row = rows?.[0] as { developer_id?: string; status?: unknown; asset_type?: unknown } | undefined;
  if (!row) throw new DeveloperAssetStoreError('Template Pipeline draft was not found.', 404);
  if (row.developer_id !== developerId) throw new DeveloperAssetStoreError('Only the draft owner can submit this Template.', 403);
  if (row.status !== 'draft' || row.asset_type !== 'templates') {
    throw new DeveloperAssetStoreError('Only a new Template Pipeline draft can be submitted through this action.', 409);
  }
  const normalized = normalizeDeveloperAssetSubmissionEditInput({ ...input, assetType: row.asset_type });
  if (!normalized.ok) throw new DeveloperAssetStoreError(normalized.message, 400);
  if (!normalized.value.description) throw new DeveloperAssetStoreError('Describe what this Template is designed to create.', 400);
  if (!normalized.value.sourceNotes) throw new DeveloperAssetStoreError('Add source and rights notes before submitting this Template.', 400);
  if (!normalized.value.specialtyTags?.length) throw new DeveloperAssetStoreError('Choose at least one specialty.', 400);
  if (!normalized.value.useCaseTags?.length) throw new DeveloperAssetStoreError('Choose at least one use-case tag.', 400);
  if (!normalized.value.requestedStudioDestination) throw new DeveloperAssetStoreError('Choose where this Template belongs in Studio.', 400);

  await runRegistryCommand(async () => {
    await submitTemplatePipelineDraft({
      submissionId,
      developerId,
      name: normalized.value.name,
      description: normalized.value.description,
      previewUrl: normalized.value.previewUrl,
      sourceNotes: normalized.value.sourceNotes!,
      specialtyTags: normalized.value.specialtyTags!,
      useCaseTags: normalized.value.useCaseTags!,
      requestedStudioDestination: normalized.value.requestedStudioDestination!,
    });
  });
  return getDeveloperAssetProgramView(developerId, currentContributorIds, { includeRegistryRecipePayloads });
};

export const updateDeveloperAssetSubmissionStatus = async ({
  submissionId,
  ownerStatusOverride,
  ownerNote,
  ownerAccessTierOverride,
  currentUserId = '',
  currentContributorIds = currentUserId ? [currentUserId] : [],
}: {
  submissionId: string;
  ownerStatusOverride?: unknown;
  ownerNote?: unknown;
  ownerAccessTierOverride?: unknown;
  currentUserId?: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  if (!currentUserId) throw new DeveloperAssetStoreError('Owner identity is required to override an asset.', 403);
  const normalizedStatusOverride = ownerStatusOverride === null || ownerStatusOverride === ''
    ? null
    : isDeveloperAssetStatus(ownerStatusOverride)
      ? ownerStatusOverride
      : undefined;
  if (ownerStatusOverride !== undefined && normalizedStatusOverride === undefined) {
    throw new DeveloperAssetStoreError('Choose a supported submission status override.', 400);
  }
  const normalizedTierOverride = ownerAccessTierOverride === null || ownerAccessTierOverride === ''
    ? null
    : isDeveloperAssetAccessTierOverride(ownerAccessTierOverride)
      ? ownerAccessTierOverride
      : undefined;
  if (ownerAccessTierOverride !== undefined && normalizedTierOverride === undefined) {
    throw new DeveloperAssetStoreError('Choose a supported asset access override.', 400);
  }
  await runRegistryCommand(() => setDeveloperAssetOwnerOverride({
    submissionId,
    ownerNote: normalizeDeveloperAssetLongText(ownerNote, 280),
    ownerDeveloperId: currentUserId,
    ...(ownerStatusOverride !== undefined ? { ownerStatusOverride: normalizedStatusOverride ?? null } : {}),
    ...(ownerAccessTierOverride !== undefined ? { ownerAccessTierOverride: normalizedTierOverride ?? null } : {}),
  }));

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const permanentlyDeleteDeveloperAssetSubmission = async ({
  submissionId,
  confirmationName,
  currentUserId,
  currentContributorIds = [currentUserId],
}: {
  submissionId: string;
  confirmationName: unknown;
  currentUserId: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  if (!currentUserId) throw new DeveloperAssetStoreError('Owner identity is required to delete an asset.', 403);
  const normalizedConfirmation = normalizeDeveloperAssetShortText(confirmationName, 160);
  if (!normalizedConfirmation) {
    throw new DeveloperAssetStoreError('Type the exact asset name to confirm permanent deletion.', 400);
  }
  await runRegistryCommand(() => purgeDeveloperAssetSubmission({
    submissionId,
    confirmationName: normalizedConfirmation,
  }));
  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};
