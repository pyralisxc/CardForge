import {
  DEFAULT_PIPELINE_PROGRAM_SETTINGS,
  isContributorAssetAccessTierOverride,
  isContributorAssetStatus,
  normalizePipelineProgramSettingsInput,
  type PipelineStatus,
  type PipelineProgramSettings,
} from '@/features/pipeline/lib/pipelineItems';
import {
  countActiveContributors,
  ContributorAccessStoreError,
  fetchContributorProfileRow,
  fetchContributorProfileRows,
  updateContributorPipelineRules,
} from '@/features/contributor-access/server';
import {
  castPipelineVote,
  PipelineRegistryCommandError,
  purgePipelineSubmission,
  savePipelineProgramSettings,
  setPipelineOwnerOverride,
  submitTemplatePipelineDraft,
} from '@/features/pipeline/lib/pipelineRegistryCommands';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import {
  buildPipelineProgramView,
  mapPipelineProgramSettingsRow,
  normalizePipelineLongText,
  normalizePipelineShortText,
  normalizePipelineSubmissionEditInput,
  normalizePipelineSubmissionInput,
  normalizeContributorProfileOverrideInput,
  type PipelineProgramView,
  type PipelineProgramSettingsRow,
  type ContributorProfileOverrideInput,
} from './pipelineProgram';
import { PipelineStoreError } from './pipelineStoreError';
import { isPipelineRevisionVisibleToContributor } from './pipelineVisibility';
import {
  fetchPipelineProgramAggregate,
  fetchPipelineSubmissionPage,
  type PipelineListQuery,
} from './pipelineProjections';

export { PipelineStoreError } from './pipelineStoreError';

const runRegistryCommand = async (command: () => Promise<void>): Promise<void> => {
  try {
    await command();
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError) {
      throw new PipelineStoreError(error.message, error.status, {
        kind: error.status === 403 ? 'authorization' : undefined,
        code: error.code,
      });
    }
    throw error;
  }
};

const PROGRAM_SETTINGS_ID = 'default';

const fetchContributorSettings = async (): Promise<{ configured: boolean; settings: PipelineProgramSettings }> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return { configured: false, settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS };
  }

  const settingsColumns = 'max_active_developers,monthly_submission_limit,max_submission_file_size_mb,monthly_published_requirement,minimum_votes_for_grading,free_asset_minimum_positive_vote_percent,paid_asset_minimum_positive_vote_percent,allow_contributor_self_voting,owner_vote_weight,tier_caps_by_type';
  const { data, error } = await supabase
    .from('cardforge_developer_program_settings')
    .select(settingsColumns)
    .eq('id', PROGRAM_SETTINGS_ID)
    .limit(1);

  if (error) {
    console.error('Failed to load contributor Pipeline settings:', error);
    throw new PipelineStoreError('Contributor Pipeline settings are temporarily unavailable.', 503);
  }

  if (!data?.[0]) {
    throw new PipelineStoreError('Contributor Pipeline settings are not configured.', 503);
  }

  return {
    configured: true,
    settings: mapPipelineProgramSettingsRow(data[0] as PipelineProgramSettingsRow),
  };
};

export const getPipelineProgramContext = async (
  currentUserId: string,
): Promise<{
  configured: boolean;
  settings: PipelineProgramSettings;
  profiles: Awaited<ReturnType<typeof fetchContributorProfileRows>>;
  activeContributorCount: number;
  aggregate: Awaited<ReturnType<typeof fetchPipelineProgramAggregate>>;
}> => {
  const { configured, settings } = await fetchContributorSettings();
  const [profiles, activeContributorCount, aggregate] = await Promise.all([
    fetchContributorProfileRows(),
    countActiveContributors(),
    fetchPipelineProgramAggregate(currentUserId, settings.allowContributorSelfVoting),
  ]);
  return { configured, settings, profiles, activeContributorCount, aggregate };
};

export const getPipelineContributorSummary = async (
  currentUserId: string,
): Promise<import('./pipelineProgram').PipelineContributorSummary> => {
  const { settings } = await fetchContributorSettings();
  const [profile, aggregate] = await Promise.all([
    fetchContributorProfileRow(currentUserId),
    fetchPipelineProgramAggregate(currentUserId, settings.allowContributorSelfVoting),
  ]);
  const submissionLimit = profile?.monthly_submission_limit_override ?? settings.monthlySubmissionLimit;
  const publishedRequirement = profile?.monthly_published_requirement_override ?? settings.monthlyPublishedRequirement;
  const stats = aggregate.monthlyStatsByContributor[currentUserId];
  const submitted = stats?.submitted ?? 0;
  return {
    maxSubmissionFileSizeMb: settings.maxSubmissionFileSizeMb,
    monthlySubmissionLimit: submissionLimit,
    monthlyPublishedRequirement: publishedRequirement,
    submittedThisMonth: submitted,
    publishedThisMonth: stats?.published ?? 0,
    remainingSubmissions: Math.max(0, submissionLimit - submitted),
    ownerNote: profile?.owner_note ?? null,
  };
};

export const getPipelineProgramView = async (
  currentUserId: string,
  currentContributorIds: string[] = [currentUserId],
  {
    includeRegistryRecipePayloads = false,
    submissionQuery,
    votingQuery,
  }: {
    includeRegistryRecipePayloads?: boolean;
    submissionQuery?: PipelineListQuery;
    votingQuery?: PipelineListQuery;
  } = {},
): Promise<PipelineProgramView> => {
  const { configured, settings, profiles, activeContributorCount, aggregate } = await getPipelineProgramContext(currentUserId);
  const [submissionPage, votingPage] = await Promise.all([
    fetchPipelineSubmissionPage({
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
    fetchPipelineSubmissionPage({
      currentUserId,
      profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: settings.allowContributorSelfVoting,
      query: votingQuery ?? { scope: 'review', page: 1, pageSize: 10 },
    }),
  ]);
  return buildPipelineProgramView({
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
    activeContributorCount,
  });
};

export const getPipelineVotePolicy = async (
  submissionId: string,
  viewer: { viewerId: string; contributor: boolean; owner: boolean },
): Promise<{ allowContributorSelfVoting: boolean; submissionContributorId: string | null; submissionStatus: string | null; visibleToViewer: boolean }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline database is not configured yet.', 503);

  const [{ settings }, { data, error }] = await Promise.all([
    fetchContributorSettings(),
    supabase
      .from('cardforge_developer_asset_submissions')
      .select('developer_id,status,purge_state')
      .eq('id', submissionId)
      .limit(1),
  ]);

  if (error) {
    console.error('Failed to load Pipeline vote policy:', error);
    throw new PipelineStoreError('Unable to load vote rules for this submission.', 500);
  }

  const row = data?.[0] as { developer_id?: string | null; status?: PipelineStatus | null; purge_state?: 'pending' | null } | undefined;
  return {
    allowContributorSelfVoting: settings.allowContributorSelfVoting,
    submissionContributorId: row?.developer_id ?? null,
    submissionStatus: row?.status ?? null,
    visibleToViewer: Boolean(row?.developer_id && row.status && isPipelineRevisionVisibleToContributor({
      contributorId: row.developer_id,
      status: row.status,
      purgeState: row.purge_state ?? null,
      viewerId: viewer.viewerId,
      contributor: viewer.contributor,
      owner: viewer.owner,
    })),
  };
};

export const updateContributorProfileOverrides = async ({
  contributorId,
  input,
  currentUserId = '',
  currentContributorIds = currentUserId ? [currentUserId] : [],
}: {
  contributorId: string;
  input: ContributorProfileOverrideInput;
  currentUserId?: string;
  currentContributorIds?: string[];
}): Promise<PipelineProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline database is not configured yet.', 503);
  const normalizedContributorId = normalizePipelineShortText(contributorId, 160);
  if (!normalizedContributorId) throw new PipelineStoreError('Choose a Contributor profile to update.', 400);

  const normalized = normalizeContributorProfileOverrideInput(input);
  const updateRow = {
    monthly_submission_limit_override: normalized.monthly_submission_limit_override,
    monthly_published_requirement_override: normalized.monthly_published_requirement_override,
    owner_note: normalized.owner_note,
    ...(normalized.status ? { status: normalized.status } : {}),
  };
  try {
    await updateContributorPipelineRules({
      contributorId: normalizedContributorId,
      rules: updateRow,
    });
  } catch (error) {
    if (error instanceof ContributorAccessStoreError) {
      throw new PipelineStoreError(error.message, error.status);
    }
    throw error;
  }

  return getPipelineProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const updatePipelineProgramSettings = async (
  input: Partial<Record<keyof PipelineProgramSettings, unknown>>,
  currentUserId = '',
  currentContributorIds: string[] = currentUserId ? [currentUserId] : [],
): Promise<PipelineProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline database is not configured yet.', 503);

  const normalized = normalizePipelineProgramSettingsInput(input);
  if (!currentUserId) throw new PipelineStoreError('Owner identity is required to update pipeline rules.', 403);
  await runRegistryCommand(() => savePipelineProgramSettings(normalized, currentUserId));
  return getPipelineProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const createPipelineSubmission = async ({
  contributorId,
  contributorEmail,
  input,
}: {
  contributorId: string;
  contributorEmail: string | null;
  input: {
    assetType?: unknown;
    studioDestination?: unknown;
    specialtyTags?: unknown;
    useCaseTags?: unknown;
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
    sourceUrl?: unknown;
    sourceFileSizeBytes?: unknown;
    sourceMimeType?: unknown;
    sourceStorageBucket?: unknown;
    sourceStoragePath?: unknown;
  };
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline database is not configured yet.', 503);

  const context = await getPipelineContributorSummary(contributorId);
  if (context.remainingSubmissions <= 0) {
    throw new PipelineStoreError(
      'This Contributor has reached the monthly Forge Review submission allowance.',
      409,
      {
        kind: 'limit',
        nextAction: 'Wait for the next calendar month or ask the owner to raise this Contributor’s submission allowance.',
        limit: {
          resource: 'developer_monthly_submissions',
          current: context.submittedThisMonth,
          maximum: context.monthlySubmissionLimit,
          unit: 'submissions_per_month',
        },
      },
    );
  }

  const normalized = normalizePipelineSubmissionInput(input);
  if (!normalized.ok) throw new PipelineStoreError(normalized.message, 400);

  const { error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .insert({
      developer_id: contributorId,
      developer_email: contributorEmail,
      asset_type: normalized.value.assetType,
      requested_studio_destination: normalized.value.requestedStudioDestination,
      specialty_tags: normalized.value.specialtyTags,
      use_case_tags: normalized.value.useCaseTags,
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
    console.error('Failed to create Pipeline submission:', error);
    throw new PipelineStoreError('Unable to submit Pipeline.', 500);
  }

};

export const voteOnPipelineSubmission = async ({
  submissionId,
  contributorId,
  voteValue,
  currentContributorIds = [contributorId],
  ownerContributorId,
}: {
  submissionId: string;
  contributorId: string;
  voteValue: unknown;
  currentContributorIds?: string[];
  ownerContributorId?: string | null;
}): Promise<PipelineProgramView> => {
  if (voteValue !== 'positive' && voteValue !== 'negative') {
    throw new PipelineStoreError('Choose a supported vote value.', 400);
  }
  await runRegistryCommand(() => castPipelineVote({
    submissionId,
    contributorId,
    voteValue,
    ownerContributorId,
  }));
  return getPipelineProgramView(contributorId, currentContributorIds, {
    includeRegistryRecipePayloads: Boolean(ownerContributorId),
  });
};

export const updatePipelineSubmissionDetails = async ({
  submissionId,
  contributorId,
  input,
  allowOwnerEdit = false,
}: {
  submissionId: string;
  contributorId: string;
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
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline database is not configured yet.', 503);

  const { data: rows, error: loadError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,status,source_url,asset_type')
    .eq('id', submissionId)
    .limit(1);

  if (loadError) {
    console.error('Failed to load editable Pipeline submission:', loadError);
    throw new PipelineStoreError('Unable to load Pipeline submission.', 500);
  }

  const row = rows?.[0] as { developer_id?: string; status?: unknown; source_url?: string | null; asset_type?: unknown } | undefined;
  if (!row) throw new PipelineStoreError('Pipeline submission was not found.', 404);
  if (!allowOwnerEdit && row.developer_id !== contributorId) {
    throw new PipelineStoreError('Only the uploader can edit this asset.', 403);
  }
  if (row.status === 'published' || row.status === 'rejected') {
    throw new PipelineStoreError('Published or rejected assets cannot be edited from the Pipeline.', 400);
  }

  const normalized = normalizePipelineSubmissionEditInput({ ...input, assetType: row.asset_type });
  if (!normalized.ok) throw new PipelineStoreError(normalized.message, 400);

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
    console.error('Failed to edit Pipeline submission:', error);
    if (error.message?.includes('developer_asset_lineage_purge_pending')) {
      throw new PipelineStoreError('This Pipeline object is being permanently deleted and can no longer be edited.', 409, {
        kind: 'conflict',
      });
    }
    throw new PipelineStoreError('Unable to edit Pipeline submission.', 500);
  }

};

export const finalizeContributorTemplatePipelineDraft = async ({
  submissionId,
  contributorId,
  input,
}: {
  submissionId: string;
  contributorId: string;
  input: {
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
    sourceNotes?: unknown;
    specialtyTags?: unknown;
    useCaseTags?: unknown;
    requestedStudioDestination?: unknown;
  };
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline database is not configured yet.', 503);
  const { data: rows, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,status,asset_type')
    .eq('id', submissionId)
    .limit(1);
  if (error) throw new PipelineStoreError('Unable to load the Template Pipeline draft.', 500);
  const row = rows?.[0] as { developer_id?: string; status?: unknown; asset_type?: unknown } | undefined;
  if (!row) throw new PipelineStoreError('Template Pipeline draft was not found.', 404);
  if (row.developer_id !== contributorId) throw new PipelineStoreError('Only the draft owner can submit this Template.', 403);
  if (row.status !== 'draft' || row.asset_type !== 'templates') {
    throw new PipelineStoreError('Only a new Template Pipeline draft can be submitted through this action.', 409);
  }
  const normalized = normalizePipelineSubmissionEditInput({ ...input, assetType: row.asset_type });
  if (!normalized.ok) throw new PipelineStoreError(normalized.message, 400);
  if (!normalized.value.description) throw new PipelineStoreError('Describe what this Template is designed to create.', 400);
  if (!normalized.value.sourceNotes) throw new PipelineStoreError('Add source and rights notes before submitting this Template.', 400);
  if (!normalized.value.specialtyTags?.length) throw new PipelineStoreError('Choose at least one specialty.', 400);
  if (!normalized.value.useCaseTags?.length) throw new PipelineStoreError('Choose at least one use-case tag.', 400);
  if (!normalized.value.requestedStudioDestination) throw new PipelineStoreError('Choose where this Template belongs in Studio.', 400);

  await runRegistryCommand(async () => {
    await submitTemplatePipelineDraft({
      submissionId,
      contributorId,
      name: normalized.value.name,
      description: normalized.value.description,
      previewUrl: normalized.value.previewUrl,
      sourceNotes: normalized.value.sourceNotes!,
      specialtyTags: normalized.value.specialtyTags!,
      useCaseTags: normalized.value.useCaseTags!,
      requestedStudioDestination: normalized.value.requestedStudioDestination!,
    });
  });
};

export const updatePipelineSubmissionStatus = async ({
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
}): Promise<PipelineProgramView> => {
  if (!currentUserId) throw new PipelineStoreError('Owner identity is required to override an asset.', 403);
  const normalizedStatusOverride = ownerStatusOverride === null || ownerStatusOverride === ''
    ? null
    : isContributorAssetStatus(ownerStatusOverride)
      ? ownerStatusOverride
      : undefined;
  if (ownerStatusOverride !== undefined && normalizedStatusOverride === undefined) {
    throw new PipelineStoreError('Choose a supported submission status override.', 400);
  }
  const normalizedTierOverride = ownerAccessTierOverride === null || ownerAccessTierOverride === ''
    ? null
    : isContributorAssetAccessTierOverride(ownerAccessTierOverride)
      ? ownerAccessTierOverride
      : undefined;
  if (ownerAccessTierOverride !== undefined && normalizedTierOverride === undefined) {
    throw new PipelineStoreError('Choose a supported asset access override.', 400);
  }
  await runRegistryCommand(() => setPipelineOwnerOverride({
    submissionId,
    ownerNote: normalizePipelineLongText(ownerNote, 280),
    ownerContributorId: currentUserId,
    ...(ownerStatusOverride !== undefined ? { ownerStatusOverride: normalizedStatusOverride ?? null } : {}),
    ...(ownerAccessTierOverride !== undefined ? { ownerAccessTierOverride: normalizedTierOverride ?? null } : {}),
  }));

  return getPipelineProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const permanentlyDeletePipelineSubmission = async ({
  submissionId,
  confirmationName,
  currentUserId,
  currentContributorIds = [currentUserId],
}: {
  submissionId: string;
  confirmationName: unknown;
  currentUserId: string;
  currentContributorIds?: string[];
}): Promise<PipelineProgramView> => {
  if (!currentUserId) throw new PipelineStoreError('Owner identity is required to delete an asset.', 403);
  const normalizedConfirmation = normalizePipelineShortText(confirmationName, 160);
  if (!normalizedConfirmation) {
    throw new PipelineStoreError('Type the exact asset name to confirm permanent deletion.', 400);
  }
  await runRegistryCommand(() => purgePipelineSubmission({
    submissionId,
    confirmationName: normalizedConfirmation,
  }));
  return getPipelineProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};
