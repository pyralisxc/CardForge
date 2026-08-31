import {
  DEFAULT_PIPELINE_PROGRAM_SETTINGS,
  isContributorAssetAccessTier,
  isContributorAssetAccessTierOverride,
  isContributorAssetStatus,
  isContributorAssetType,
  normalizePipelineProgramSettingsInput,
  type PipelineAccessTier,
  type PipelineAccessTierOverride,
  type PipelineMonthlyStats,
  type PipelineStatus,
  type PipelineType,
  type PipelineTypePipelineSummary,
  type ContributorSummary,
  type PipelineProgramSettings,
  type PipelineVoteValue,
} from './pipelineItems';
import { isStudioAssetDestination, type StudioAssetDestination } from '@/domain/templates';
import { getPipelineStudioDestinationOptions } from './pipelineAssetTaxonomy';
import { normalizeSpecialtyTags, normalizeUseCaseTags } from './contentTaxonomy';

export type PipelineSubmissionInputResult =
  | { ok: true; value: Pick<PipelineSubmission, 'assetType' | 'requestedStudioDestination' | 'specialtyTags' | 'useCaseTags' | 'name' | 'description' | 'previewUrl' | 'sourceUrl' | 'sourceFileSizeBytes' | 'sourceMimeType' | 'sourceStorageBucket' | 'sourceStoragePath'> }
  | { ok: false; message: string };

export type PipelineSubmissionEditInputResult =
  | { ok: true; value: {
      name: string;
      description: string;
      previewUrl: string;
      sourceNotes?: string;
      specialtyTags?: string[];
      useCaseTags?: string[];
      requestedStudioDestination?: StudioAssetDestination;
    } }
  | { ok: false; message: string };

export interface PipelineSubmission {
  id: string;
  lineageId?: string;
  contributorId: string;
  contributorEmail: string | null;
  contributorFirstName?: string | null;
  contributorLastName?: string | null;
  contributorDisplayName?: string | null;
  assetType: PipelineType;
  requestedStudioDestination: StudioAssetDestination | null;
  specialtyTags: string[];
  useCaseTags: string[];
  sourceNotes: string;
  name: string;
  description: string;
  previewUrl: string;
  sourceUrl: string | null;
  sourceFileSizeBytes: number | null;
  sourceMimeType: string | null;
  sourceStorageBucket: string | null;
  sourceStoragePath: string | null;
  registryAssetId: string | null;
  status: PipelineStatus;
  automatedStatus: Extract<PipelineStatus, 'voting' | 'publish_candidate' | 'published' | 'archived'>;
  ownerStatusOverride: PipelineStatus | null;
  calculatedAccessTier: PipelineAccessTier;
  automatedAccessTier: PipelineAccessTier;
  ownerAccessTierOverride: PipelineAccessTierOverride | null;
  qualityScore: number;
  tierDecisionReason: string | null;
  ownerNote?: string | null;
  decisionReason?: string | null;
  positiveVotes: number;
  negativeVotes: number;
  currentUserVote: PipelineVoteValue | null;
  sourcePayload: unknown | null;
  targetRegistryAssetId: string | null;
  baseRevisionNumber: number | null;
  revisionNumber: number | null;
  publishedAt: string | null;
  purgeState: 'pending' | null;
  submittedAt: string;
  updatedAt: string | null;
}

export interface PipelineProgramView {
  configured: boolean;
  settings: PipelineProgramSettings;
  currentUserId: string;
  currentContributorIds: string[];
  activeContributorCount: number;
  submissions: PipelineSubmission[];
  votingQueue: PipelineSubmission[];
  submissionPage: PipelinePageSummary;
  votingPage: PipelinePageSummary;
  totalSubmissionCount: number;
  totalVoteableCount: number;
  submissionStatusCounts: Record<PipelineStatus, number>;
  reviewStatusCounts: Record<PipelineStatus, number>;
  submissionTypeCounts: Record<PipelineType, number>;
  managedFileCount: number;
  managedStorageBytes: number;
  assetTypeSummaries: PipelineTypePipelineSummary[];
  contributions: ContributorSummary[];
  contributionStats: PipelineMonthlyStats;
  effectiveMonthlySubmissionLimit: number;
  effectiveMonthlyPublishedRequirement: number;
  contributorOwnerNote: string | null;
  remainingSubmissions: number;
}

export interface PipelineContributorSummary {
  maxSubmissionFileSizeMb: number;
  monthlySubmissionLimit: number;
  monthlyPublishedRequirement: number;
  submittedThisMonth: number;
  publishedThisMonth: number;
  remainingSubmissions: number;
  ownerNote: string | null;
}

export interface PipelinePageSummary {
  total: number;
  page: number;
  pageSize: number;
}

export interface PipelineProgramAggregate {
  totalSubmissionCount: number;
  totalVoteableCount: number;
  submissionStatusCounts: Partial<Record<PipelineStatus, number>>;
  reviewStatusCounts: Partial<Record<PipelineStatus, number>>;
  submissionTypeCounts: Partial<Record<PipelineType, number>>;
  managedFileCount: number;
  managedStorageBytes: number;
  assetTypeMetrics: Partial<Record<PipelineType, {
    published: number;
    starter: number;
    creatorPass: number;
    candidate: number;
    archived: number;
  }>>;
  monthlyStatsByContributor: Record<string, PipelineMonthlyStats & { total: number }>;
}

export interface PipelineProgramSettingsRow {
  max_active_contributors?: unknown;
  monthly_submission_limit?: unknown;
  max_submission_file_size_mb?: unknown;
  monthly_published_requirement?: unknown;
  minimum_votes_for_grading?: unknown;
  free_asset_minimum_positive_vote_percent?: unknown;
  paid_asset_minimum_positive_vote_percent?: unknown;
  allow_contributor_self_voting?: unknown;
  owner_vote_weight?: unknown;
  tier_caps_by_type?: unknown;
}

export interface PipelineSubmissionRow {
  id: string;
  lineage_id?: string;
  contributor_id: string;
  contributor_email: string | null;
  asset_type: unknown;
  requested_studio_destination: unknown;
  specialty_tags?: unknown;
  use_case_tags?: unknown;
  source_notes?: string | null;
  name: string;
  description: string | null;
  preview_url: string | null;
  source_url: string | null;
  source_file_size_bytes: number | null;
  source_mime_type: string | null;
  source_storage_bucket: string | null;
  source_storage_path: string | null;
  registry_asset_id: string | null;
  status: unknown;
  automated_status: unknown;
  owner_status_override: unknown;
  calculated_access_tier: unknown;
  automated_access_tier: unknown;
  owner_access_tier_override: unknown;
  quality_score: number | null;
  tier_decision_reason: string | null;
  owner_note: string | null;
  decision_reason: string | null;
  positive_votes: number | null;
  negative_votes: number | null;
  source_payload: unknown | null;
  target_registry_asset_id: string | null;
  base_revision_number: number | null;
  revision_number: number | null;
  published_at: string | null;
  purge_state: unknown;
  submitted_at: string;
  updated_at: string | null;
}

export interface PipelineProfile {
  clerk_user_id: string;
  email: string | null;
  status?: 'invited' | 'active' | 'inactive' | 'suspended' | null;
  first_name?: string | null;
  last_name?: string | null;
  monthly_submission_limit_override?: number | null;
  monthly_published_requirement_override?: number | null;
  owner_note?: string | null;
}

export interface ContributorProfileOverrideInput {
  status?: unknown;
  monthlySubmissionLimitOverride?: unknown;
  monthlyPublishedRequirementOverride?: unknown;
  ownerNote?: unknown;
}

export const normalizePipelineShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

export const normalizePipelineLongText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const normalizeUrl = (value: unknown, maxLength = 2048): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const normalizeOptionalInteger = (value: unknown, min: number, max: number): number | null => {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return rounded >= min && rounded <= max ? rounded : null;
};

export const normalizeContributorProfileOverrideInput = (
  input: ContributorProfileOverrideInput,
): {
  status?: 'invited' | 'active' | 'inactive' | 'suspended';
  monthly_submission_limit_override: number | null;
  monthly_published_requirement_override: number | null;
  owner_note: string;
} => ({
  status:
    input.status === 'invited'
    || input.status === 'active'
    || input.status === 'inactive'
    || input.status === 'suspended'
      ? input.status
      : undefined,
  monthly_submission_limit_override: normalizeOptionalInteger(input.monthlySubmissionLimitOverride, 1, 250),
  monthly_published_requirement_override: normalizeOptionalInteger(input.monthlyPublishedRequirementOverride, 0, 100),
  owner_note: normalizePipelineLongText(input.ownerNote, 280),
});

export const normalizePipelineSubmissionInput = (value: {
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
}): PipelineSubmissionInputResult => {
  if (!isContributorAssetType(value.assetType)) {
    return { ok: false, message: 'Choose a supported asset type.' };
  }
  const requestedStudioDestination = value.assetType === 'sets'
    ? null
    : isStudioAssetDestination(value.studioDestination)
      ? value.studioDestination
      : null;
  if (value.assetType !== 'sets' && (
    !requestedStudioDestination
    || !getPipelineStudioDestinationOptions(value.assetType).includes(requestedStudioDestination)
  )) {
    return { ok: false, message: 'Choose a Studio destination compatible with this asset type.' };
  }
  const specialtyTags = normalizeSpecialtyTags(value.specialtyTags);
  if (!specialtyTags.length) return { ok: false, message: 'Choose at least one supported CardForge specialty.' };
  const useCaseTags = normalizeUseCaseTags(value.useCaseTags);
  if (!useCaseTags.length) return { ok: false, message: 'Choose at least one supported CardForge use case.' };
  const name = normalizePipelineShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };
  const previewUrl = normalizeUrl(value.previewUrl);
  const sourceUrl = normalizeUrl(value.sourceUrl);
  if (!sourceUrl) return { ok: false, message: 'Upload a source file before submitting this asset.' };

  return {
    ok: true,
    value: {
      assetType: value.assetType,
      requestedStudioDestination,
      specialtyTags,
      useCaseTags,
      name,
      description: normalizePipelineLongText(value.description, 280),
      previewUrl: previewUrl || sourceUrl,
      sourceUrl,
      sourceFileSizeBytes: normalizeOptionalInteger(value.sourceFileSizeBytes, 1, 50 * 1024 * 1024),
      sourceMimeType: normalizePipelineShortText(value.sourceMimeType, 120) || null,
      sourceStorageBucket: normalizePipelineShortText(value.sourceStorageBucket, 80) || null,
      sourceStoragePath: normalizeUrl(value.sourceStoragePath) || null,
    },
  };
};

export const normalizePipelineSubmissionEditInput = (value: {
  assetType?: unknown;
  name?: unknown;
  description?: unknown;
  previewUrl?: unknown;
  sourceNotes?: unknown;
  specialtyTags?: unknown;
  useCaseTags?: unknown;
  requestedStudioDestination?: unknown;
}): PipelineSubmissionEditInputResult => {
  const name = normalizePipelineShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };
  let requestedStudioDestination: StudioAssetDestination | undefined;
  const hasRequestedStudioDestination = typeof value.requestedStudioDestination === 'string'
    ? value.requestedStudioDestination.trim() !== ''
    : value.requestedStudioDestination !== undefined && value.requestedStudioDestination !== null;
  if (hasRequestedStudioDestination) {
    if (
      !isContributorAssetType(value.assetType)
      || !isStudioAssetDestination(value.requestedStudioDestination)
      || !getPipelineStudioDestinationOptions(value.assetType).includes(value.requestedStudioDestination)
    ) {
      return { ok: false, message: 'Choose a Studio destination compatible with this asset type.' };
    }
    requestedStudioDestination = value.requestedStudioDestination;
  }
  return {
    ok: true,
    value: {
      name,
      description: normalizePipelineLongText(value.description, 280),
      previewUrl: normalizeUrl(value.previewUrl),
      ...(value.sourceNotes !== undefined
        ? { sourceNotes: normalizePipelineLongText(value.sourceNotes, 600) }
        : {}),
      ...(value.specialtyTags !== undefined
        ? { specialtyTags: normalizeSpecialtyTags(value.specialtyTags) }
        : {}),
      ...(value.useCaseTags !== undefined
        ? { useCaseTags: normalizeUseCaseTags(value.useCaseTags) }
        : {}),
      ...(requestedStudioDestination ? { requestedStudioDestination } : {}),
    },
  };
};

export const mapPipelineProgramSettingsRow = (
  row: PipelineProgramSettingsRow | null | undefined,
): PipelineProgramSettings => normalizePipelineProgramSettingsInput(row
  ? {
      maxActiveContributors: row.max_active_contributors,
      monthlySubmissionLimit: row.monthly_submission_limit,
      maxSubmissionFileSizeMb: row.max_submission_file_size_mb,
      monthlyPublishedRequirement: row.monthly_published_requirement,
      minimumVotesForGrading: row.minimum_votes_for_grading,
      freeAssetMinimumPositiveVotePercent: row.free_asset_minimum_positive_vote_percent,
      paidAssetMinimumPositiveVotePercent: row.paid_asset_minimum_positive_vote_percent,
      allowContributorSelfVoting: row.allow_contributor_self_voting,
      ownerVoteWeight: row.owner_vote_weight,
      tierCapsByType: row.tier_caps_by_type,
    }
  : DEFAULT_PIPELINE_PROGRAM_SETTINGS);

export const resolvePipelineSourcePayload = (
  submissionPayload: unknown | null,
  registrySourcePayload?: unknown,
): unknown | null => submissionPayload ?? registrySourcePayload ?? null;

export const mapPipelineSubmissionRow = (
  row: PipelineSubmissionRow,
  currentUserVotes: Record<string, PipelineVoteValue> = {},
  profile?: PipelineProfile | null,
  registrySourcePayload?: unknown,
): PipelineSubmission => ({
  id: row.id,
  lineageId: row.lineage_id,
  contributorId: row.contributor_id,
  contributorEmail: profile?.email ?? row.contributor_email,
  contributorFirstName: profile?.first_name ?? null,
  contributorLastName: profile?.last_name ?? null,
  contributorDisplayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || row.contributor_email,
  assetType: isContributorAssetType(row.asset_type) ? row.asset_type : 'imageAssets',
  requestedStudioDestination: isStudioAssetDestination(row.requested_studio_destination)
    ? row.requested_studio_destination
    : null,
  specialtyTags: normalizeSpecialtyTags(row.specialty_tags),
  useCaseTags: normalizeUseCaseTags(row.use_case_tags),
  sourceNotes: row.source_notes ?? '',
  name: row.name,
  description: row.description ?? '',
  previewUrl: row.preview_url ?? '',
  sourceUrl: row.source_url,
  sourceFileSizeBytes: row.source_file_size_bytes,
  sourceMimeType: row.source_mime_type,
  sourceStorageBucket: row.source_storage_bucket,
  sourceStoragePath: row.source_storage_path,
  registryAssetId: row.registry_asset_id,
  status: isContributorAssetStatus(row.status) ? row.status : 'submitted',
  automatedStatus: row.automated_status === 'publish_candidate'
    || row.automated_status === 'published'
    || row.automated_status === 'archived'
    ? row.automated_status
    : 'voting',
  ownerStatusOverride: isContributorAssetStatus(row.owner_status_override) ? row.owner_status_override : null,
  calculatedAccessTier: isContributorAssetAccessTier(row.calculated_access_tier) ? row.calculated_access_tier : 'contributor',
  automatedAccessTier: isContributorAssetAccessTier(row.automated_access_tier) ? row.automated_access_tier : 'contributor',
  ownerAccessTierOverride: isContributorAssetAccessTierOverride(row.owner_access_tier_override) ? row.owner_access_tier_override : null,
  qualityScore: row.quality_score ?? 0,
  tierDecisionReason: row.tier_decision_reason,
  ownerNote: row.owner_note,
  decisionReason: row.decision_reason,
  positiveVotes: row.positive_votes ?? 0,
  negativeVotes: row.negative_votes ?? 0,
  currentUserVote: currentUserVotes[row.id] ?? null,
  sourcePayload: resolvePipelineSourcePayload(row.source_payload, registrySourcePayload),
  targetRegistryAssetId: row.target_registry_asset_id,
  baseRevisionNumber: row.base_revision_number,
  revisionNumber: row.revision_number,
  publishedAt: row.published_at,
  purgeState: row.purge_state === 'pending' ? 'pending' : null,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
});

export { buildPipelineProgramView, projectPipelineProgramForViewer } from './pipelineProgramView';
