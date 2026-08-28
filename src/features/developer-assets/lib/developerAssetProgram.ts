import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  isDeveloperAssetAccessTier,
  isDeveloperAssetAccessTierOverride,
  isDeveloperAssetStatus,
  isDeveloperAssetType,
  normalizeDeveloperProgramSettingsInput,
  type DeveloperAssetAccessTier,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetMonthlyStats,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
  type DeveloperAssetTypePipelineSummary,
  type DeveloperContributionSummary,
  type DeveloperProgramSettings,
  type DeveloperVoteValue,
} from './developerAssets';
import { isStudioAssetDestination, type StudioAssetDestination } from '@/domain/templates';
import { getDeveloperAssetStudioDestinationOptions } from './pipelineAssetTaxonomy';
import { normalizeSpecialtyTags, normalizeUseCaseTags } from './contentTaxonomy';

export type DeveloperAssetSubmissionInputResult =
  | { ok: true; value: Pick<DeveloperAssetSubmission, 'assetType' | 'requestedStudioDestination' | 'specialtyTags' | 'useCaseTags' | 'name' | 'description' | 'previewUrl' | 'sourceUrl' | 'sourceFileSizeBytes' | 'sourceMimeType' | 'sourceStorageBucket' | 'sourceStoragePath'> }
  | { ok: false; message: string };

export type DeveloperAssetSubmissionEditInputResult =
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

export interface DeveloperAssetSubmission {
  id: string;
  developerId: string;
  developerEmail: string | null;
  developerFirstName?: string | null;
  developerLastName?: string | null;
  developerDisplayName?: string | null;
  assetType: DeveloperAssetType;
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
  status: DeveloperAssetStatus;
  automatedStatus: Extract<DeveloperAssetStatus, 'voting' | 'publish_candidate' | 'published' | 'archived'>;
  ownerStatusOverride: DeveloperAssetStatus | null;
  calculatedAccessTier: DeveloperAssetAccessTier;
  automatedAccessTier: DeveloperAssetAccessTier;
  ownerAccessTierOverride: DeveloperAssetAccessTierOverride | null;
  qualityScore: number;
  tierDecisionReason: string | null;
  ownerNote?: string | null;
  decisionReason?: string | null;
  positiveVotes: number;
  negativeVotes: number;
  currentUserVote: DeveloperVoteValue | null;
  sourcePayload: unknown | null;
  targetRegistryAssetId: string | null;
  baseRevisionNumber: number | null;
  revisionNumber: number | null;
  publishedAt: string | null;
  purgeState: 'pending' | null;
  submittedAt: string;
  updatedAt: string | null;
}

export interface DeveloperAssetProgramView {
  configured: boolean;
  settings: DeveloperProgramSettings;
  currentUserId: string;
  currentContributorIds: string[];
  activeDeveloperCount: number;
  submissions: DeveloperAssetSubmission[];
  votingQueue: DeveloperAssetSubmission[];
  submissionPage: DeveloperAssetPageSummary;
  votingPage: DeveloperAssetPageSummary;
  totalSubmissionCount: number;
  totalVoteableCount: number;
  submissionStatusCounts: Record<DeveloperAssetStatus, number>;
  reviewStatusCounts: Record<DeveloperAssetStatus, number>;
  submissionTypeCounts: Record<DeveloperAssetType, number>;
  managedFileCount: number;
  managedStorageBytes: number;
  assetTypeSummaries: DeveloperAssetTypePipelineSummary[];
  developerContributions: DeveloperContributionSummary[];
  developerStats: DeveloperAssetMonthlyStats;
  effectiveMonthlySubmissionLimit: number;
  effectiveMonthlyPublishedRequirement: number;
  developerOwnerNote: string | null;
  remainingSubmissions: number;
}

export interface DeveloperAssetPageSummary {
  total: number;
  page: number;
  pageSize: number;
}

export interface DeveloperAssetProgramAggregate {
  totalSubmissionCount: number;
  totalVoteableCount: number;
  submissionStatusCounts: Partial<Record<DeveloperAssetStatus, number>>;
  reviewStatusCounts: Partial<Record<DeveloperAssetStatus, number>>;
  submissionTypeCounts: Partial<Record<DeveloperAssetType, number>>;
  managedFileCount: number;
  managedStorageBytes: number;
  assetTypeMetrics: Partial<Record<DeveloperAssetType, {
    published: number;
    starter: number;
    creatorPass: number;
    candidate: number;
    archived: number;
  }>>;
  monthlyStatsByDeveloper: Record<string, DeveloperAssetMonthlyStats & { total: number }>;
}

export interface DeveloperProgramSettingsRow {
  max_active_developers?: unknown;
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

export interface DeveloperAssetSubmissionRow {
  id: string;
  developer_id: string;
  developer_email: string | null;
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

export interface DeveloperAssetProfile {
  clerk_user_id: string;
  email: string | null;
  status?: 'invited' | 'active' | 'inactive' | 'suspended' | null;
  first_name?: string | null;
  last_name?: string | null;
  monthly_submission_limit_override?: number | null;
  monthly_published_requirement_override?: number | null;
  owner_note?: string | null;
}

export interface DeveloperProfileOverrideInput {
  status?: unknown;
  monthlySubmissionLimitOverride?: unknown;
  monthlyPublishedRequirementOverride?: unknown;
  ownerNote?: unknown;
}

export const normalizeDeveloperAssetShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

export const normalizeDeveloperAssetLongText = (value: unknown, maxLength: number): string =>
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

export const normalizeDeveloperProfileOverrideInput = (
  input: DeveloperProfileOverrideInput,
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
  owner_note: normalizeDeveloperAssetLongText(input.ownerNote, 280),
});

export const normalizeDeveloperAssetSubmissionInput = (value: {
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
}): DeveloperAssetSubmissionInputResult => {
  if (!isDeveloperAssetType(value.assetType)) {
    return { ok: false, message: 'Choose a supported asset type.' };
  }
  const requestedStudioDestination = value.assetType === 'sets'
    ? null
    : isStudioAssetDestination(value.studioDestination)
      ? value.studioDestination
      : null;
  if (value.assetType !== 'sets' && (
    !requestedStudioDestination
    || !getDeveloperAssetStudioDestinationOptions(value.assetType).includes(requestedStudioDestination)
  )) {
    return { ok: false, message: 'Choose a Studio destination compatible with this asset type.' };
  }
  const specialtyTags = normalizeSpecialtyTags(value.specialtyTags);
  if (!specialtyTags.length) return { ok: false, message: 'Choose at least one supported CardForge specialty.' };
  const useCaseTags = normalizeUseCaseTags(value.useCaseTags);
  if (!useCaseTags.length) return { ok: false, message: 'Choose at least one supported CardForge use case.' };
  const name = normalizeDeveloperAssetShortText(value.name, 96);
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
      description: normalizeDeveloperAssetLongText(value.description, 280),
      previewUrl: previewUrl || sourceUrl,
      sourceUrl,
      sourceFileSizeBytes: normalizeOptionalInteger(value.sourceFileSizeBytes, 1, 50 * 1024 * 1024),
      sourceMimeType: normalizeDeveloperAssetShortText(value.sourceMimeType, 120) || null,
      sourceStorageBucket: normalizeDeveloperAssetShortText(value.sourceStorageBucket, 80) || null,
      sourceStoragePath: normalizeUrl(value.sourceStoragePath) || null,
    },
  };
};

export const normalizeDeveloperAssetSubmissionEditInput = (value: {
  assetType?: unknown;
  name?: unknown;
  description?: unknown;
  previewUrl?: unknown;
  sourceNotes?: unknown;
  specialtyTags?: unknown;
  useCaseTags?: unknown;
  requestedStudioDestination?: unknown;
}): DeveloperAssetSubmissionEditInputResult => {
  const name = normalizeDeveloperAssetShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };
  let requestedStudioDestination: StudioAssetDestination | undefined;
  const hasRequestedStudioDestination = typeof value.requestedStudioDestination === 'string'
    ? value.requestedStudioDestination.trim() !== ''
    : value.requestedStudioDestination !== undefined && value.requestedStudioDestination !== null;
  if (hasRequestedStudioDestination) {
    if (
      !isDeveloperAssetType(value.assetType)
      || !isStudioAssetDestination(value.requestedStudioDestination)
      || !getDeveloperAssetStudioDestinationOptions(value.assetType).includes(value.requestedStudioDestination)
    ) {
      return { ok: false, message: 'Choose a Studio destination compatible with this asset type.' };
    }
    requestedStudioDestination = value.requestedStudioDestination;
  }
  return {
    ok: true,
    value: {
      name,
      description: normalizeDeveloperAssetLongText(value.description, 280),
      previewUrl: normalizeUrl(value.previewUrl),
      ...(value.sourceNotes !== undefined
        ? { sourceNotes: normalizeDeveloperAssetLongText(value.sourceNotes, 600) }
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

export const mapDeveloperProgramSettingsRow = (
  row: DeveloperProgramSettingsRow | null | undefined,
): DeveloperProgramSettings => normalizeDeveloperProgramSettingsInput(row
  ? {
      maxActiveDevelopers: row.max_active_developers,
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
  : DEFAULT_DEVELOPER_PROGRAM_SETTINGS);

export const resolveDeveloperAssetSourcePayload = (
  submissionPayload: unknown | null,
  registrySourcePayload?: unknown,
): unknown | null => submissionPayload ?? registrySourcePayload ?? null;

export const mapDeveloperAssetSubmissionRow = (
  row: DeveloperAssetSubmissionRow,
  currentUserVotes: Record<string, DeveloperVoteValue> = {},
  profile?: DeveloperAssetProfile | null,
  registrySourcePayload?: unknown,
): DeveloperAssetSubmission => ({
  id: row.id,
  developerId: row.developer_id,
  developerEmail: profile?.email ?? row.developer_email,
  developerFirstName: profile?.first_name ?? null,
  developerLastName: profile?.last_name ?? null,
  developerDisplayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || row.developer_email,
  assetType: isDeveloperAssetType(row.asset_type) ? row.asset_type : 'imageAssets',
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
  status: isDeveloperAssetStatus(row.status) ? row.status : 'submitted',
  automatedStatus: row.automated_status === 'publish_candidate'
    || row.automated_status === 'published'
    || row.automated_status === 'archived'
    ? row.automated_status
    : 'voting',
  ownerStatusOverride: isDeveloperAssetStatus(row.owner_status_override) ? row.owner_status_override : null,
  calculatedAccessTier: isDeveloperAssetAccessTier(row.calculated_access_tier) ? row.calculated_access_tier : 'developer',
  automatedAccessTier: isDeveloperAssetAccessTier(row.automated_access_tier) ? row.automated_access_tier : 'developer',
  ownerAccessTierOverride: isDeveloperAssetAccessTierOverride(row.owner_access_tier_override) ? row.owner_access_tier_override : null,
  qualityScore: row.quality_score ?? 0,
  tierDecisionReason: row.tier_decision_reason,
  ownerNote: row.owner_note,
  decisionReason: row.decision_reason,
  positiveVotes: row.positive_votes ?? 0,
  negativeVotes: row.negative_votes ?? 0,
  currentUserVote: currentUserVotes[row.id] ?? null,
  sourcePayload: resolveDeveloperAssetSourcePayload(row.source_payload, registrySourcePayload),
  targetRegistryAssetId: row.target_registry_asset_id,
  baseRevisionNumber: row.base_revision_number,
  revisionNumber: row.revision_number,
  publishedAt: row.published_at,
  purgeState: row.purge_state === 'pending' ? 'pending' : null,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
});

export { buildDeveloperAssetProgramView, projectDeveloperAssetProgramForViewer } from './developerAssetProgramView';
