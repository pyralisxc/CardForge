import {
  DEFAULT_PIPELINE_UPLOAD_MAX_MB,
  PIPELINE_UPLOAD_HARD_MAX_MB,
} from './pipelineUploadPolicy';

export const PIPELINE_TYPES = [
  'templates',
  'elementPresets',
  'textures',
  'dividers',
  'icons',
  'imageAssets',
  'fonts',
  'sets',
] as const;

export const CONTRIBUTOR_UPLOAD_ASSET_TYPES = [
  'textures',
  'dividers',
  'icons',
  'imageAssets',
  'fonts',
  'sets',
] as const;

export const PIPELINE_STATUSES = [
  'draft',
  'submitted',
  'voting',
  'publish_candidate',
  'published',
  'archived',
  'rejected',
] as const;

export type PipelineType = typeof PIPELINE_TYPES[number];
export type ContributorUploadAssetType = typeof CONTRIBUTOR_UPLOAD_ASSET_TYPES[number];
export type PipelineStatus = typeof PIPELINE_STATUSES[number];
export type PipelineVoteValue = 'positive' | 'negative';
export type PipelineAccessTier = 'hidden' | 'free' | 'paid' | 'developer';
export type PipelineAccessTierOverride = 'hidden' | 'free' | 'paid';

export type PipelinePublishCapsByType = Record<PipelineType, number>;
export type PipelineTierCapsByType = Record<PipelineType, { free: number; paid: number }>;

export interface PipelineProgramSettings {
  maxActiveContributors: number;
  monthlySubmissionLimit: number;
  maxSubmissionFileSizeMb: number;
  monthlyPublishedRequirement: number;
  minimumVotesForGrading: number;
  freeAssetMinimumPositiveVotePercent: number;
  paidAssetMinimumPositiveVotePercent: number;
  allowContributorSelfVoting: boolean;
  ownerVoteWeight: number;
  publishCapsByType: PipelinePublishCapsByType;
  tierCapsByType: PipelineTierCapsByType;
}

export type PipelineVotingPreset = 'solo' | 'currentRoster' | 'launchRoster' | 'fullCouncil';

export interface PipelineSubmissionSummary {
  id: string;
  status: PipelineStatus;
  submittedAt: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

export interface PipelineMonthlyStats {
  submitted: number;
  published: number;
  archived: number;
  rejected: number;
}

export interface PipelineTypePipelineSummary {
  assetType: PipelineType;
  publishedCount: number;
  starterCount: number;
  creatorPassCount: number;
  candidateCount: number;
  archiveCount: number;
  publishCap: number;
  starterCap: number;
  creatorPassCap: number;
  openPublishSlots: number;
  overPublishCapBy: number;
  overStarterCapBy: number;
  overCreatorPassCapBy: number;
}

export interface ContributorSummary {
  contributorId: string;
  contributorEmail: string | null;
  contributorName: string | null;
  profileStatus: 'invited' | 'active' | 'inactive' | 'suspended';
  submitted: number;
  published: number;
  archived: number;
  rejected: number;
  effectiveSubmissionLimit: number;
  effectivePublishedRequirement: number;
  submissionLimitOverride: number | null;
  publishedRequirementOverride: number | null;
  remainingSubmissions: number;
  requiredPublished: number;
  missingPublished: number;
  ownerNote: string | null;
  isOwnerDefaultContributor: boolean;
}

export const DEFAULT_PIPELINE_TIER_CAPS_BY_TYPE: PipelineTierCapsByType = {
  templates: { free: 6, paid: 3 },
  elementPresets: { free: 16, paid: 8 },
  textures: { free: 16, paid: 8 },
  dividers: { free: 16, paid: 8 },
  icons: { free: 20, paid: 10 },
  imageAssets: { free: 16, paid: 8 },
  fonts: { free: 8, paid: 4 },
  sets: { free: 4, paid: 2 },
};

export const derivePipelinePublishCapsByType = (
  tierCaps: PipelineTierCapsByType
): PipelinePublishCapsByType => PIPELINE_TYPES.reduce<PipelinePublishCapsByType>((caps, type) => {
  caps[type] = Math.max(0, tierCaps[type].free) + Math.max(0, tierCaps[type].paid);
  return caps;
}, {} as PipelinePublishCapsByType);

export const DEFAULT_PIPELINE_PUBLISH_CAPS_BY_TYPE: PipelinePublishCapsByType =
  derivePipelinePublishCapsByType(DEFAULT_PIPELINE_TIER_CAPS_BY_TYPE);

export const DEFAULT_PIPELINE_PROGRAM_SETTINGS: PipelineProgramSettings = {
  maxActiveContributors: 25,
  monthlySubmissionLimit: 25,
  maxSubmissionFileSizeMb: DEFAULT_PIPELINE_UPLOAD_MAX_MB,
  monthlyPublishedRequirement: 5,
  minimumVotesForGrading: 5,
  freeAssetMinimumPositiveVotePercent: 60,
  paidAssetMinimumPositiveVotePercent: 80,
  allowContributorSelfVoting: true,
  ownerVoteWeight: 1,
  publishCapsByType: DEFAULT_PIPELINE_PUBLISH_CAPS_BY_TYPE,
  tierCapsByType: DEFAULT_PIPELINE_TIER_CAPS_BY_TYPE,
};

export const PIPELINE_STORAGE_ESTIMATE_BYTES: Record<PipelineType, number> = {
  templates: 80 * 1024,
  elementPresets: 24 * 1024,
  textures: 850 * 1024,
  dividers: 120 * 1024,
  icons: 80 * 1024,
  imageAssets: 1_500 * 1024,
  fonts: 220 * 1024,
  sets: 2 * 1024 * 1024,
};

const clampInteger = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export const getPipelineVotingPresetLabel = (
  preset: PipelineVotingPreset,
  activeContributorCount: number
): string => {
  const activeCount = Math.max(1, Math.round(activeContributorCount));
  if (preset === 'solo') return 'Solo owner review';
  if (preset === 'currentRoster') return `${activeCount} contributor roster`;
  if (preset === 'launchRoster') return 'Launch roster';
  return 'Full council';
};

export const buildPipelineVotingPresetSettings = (
  settings: PipelineProgramSettings,
  preset: PipelineVotingPreset,
  activeContributorCount: number
): PipelineProgramSettings => {
  const activeCount = Math.max(1, Math.round(activeContributorCount));
  const rosterBasedVotes = clampInteger(Math.ceil(activeCount * 0.6), 1, 15);
  const voteCount = preset === 'solo'
    ? 1
    : preset === 'currentRoster'
      ? rosterBasedVotes
      : preset === 'launchRoster'
        ? 5
        : 9;

  return normalizePipelineProgramSettingsInput({
    ...settings,
    minimumVotesForGrading: voteCount,
    freeAssetMinimumPositiveVotePercent: preset === 'solo' ? 50 : 60,
    paidAssetMinimumPositiveVotePercent: preset === 'solo' ? 75 : 80,
  });
};

export const isContributorAssetType = (value: unknown): value is PipelineType =>
  typeof value === 'string' && (PIPELINE_TYPES as readonly string[]).includes(value);

export const isContributorUploadAssetType = (value: unknown): value is ContributorUploadAssetType =>
  typeof value === 'string' && (CONTRIBUTOR_UPLOAD_ASSET_TYPES as readonly string[]).includes(value);

export const isContributorAssetStatus = (value: unknown): value is PipelineStatus =>
  typeof value === 'string' && (PIPELINE_STATUSES as readonly string[]).includes(value);

export const isContributorAssetAccessTier = (value: unknown): value is PipelineAccessTier =>
  value === 'hidden' || value === 'free' || value === 'paid' || value === 'developer';

export const isContributorAssetAccessTierOverride = (value: unknown): value is PipelineAccessTierOverride =>
  value === 'hidden' || value === 'free' || value === 'paid';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number => (
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN
);

const normalizeInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < min) return fallback;
  return Math.min(max, rounded);
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  value === undefined ? fallback : value === true;

export const normalizePipelinePublishCapsByType = (value: unknown): PipelinePublishCapsByType => {
  const input = isRecord(value) ? value : {};

  return PIPELINE_TYPES.reduce<PipelinePublishCapsByType>((caps, type) => {
    caps[type] = normalizeInteger(
      input[type],
      DEFAULT_PIPELINE_PUBLISH_CAPS_BY_TYPE[type],
      0,
      500,
    );
    return caps;
  }, { ...DEFAULT_PIPELINE_PUBLISH_CAPS_BY_TYPE });
};

export const normalizePipelineTierCapsByType = (value: unknown): PipelineTierCapsByType => {
  const input = isRecord(value) ? value : {};

  return PIPELINE_TYPES.reduce<PipelineTierCapsByType>((caps, type) => {
    const entry = isRecord(input[type]) ? input[type] : {};
    caps[type] = {
      free: normalizeInteger(entry.free, DEFAULT_PIPELINE_TIER_CAPS_BY_TYPE[type].free, 0, 1000),
      paid: normalizeInteger(entry.paid, DEFAULT_PIPELINE_TIER_CAPS_BY_TYPE[type].paid, 0, 1000),
    };
    return caps;
  }, { ...DEFAULT_PIPELINE_TIER_CAPS_BY_TYPE });
};

export const normalizePipelineProgramSettingsInput = (
  value: Partial<Record<keyof PipelineProgramSettings, unknown>>
): PipelineProgramSettings => {
  const tierCapsByType = normalizePipelineTierCapsByType(value.tierCapsByType);

  return {
    maxActiveContributors: normalizeInteger(value.maxActiveContributors, DEFAULT_PIPELINE_PROGRAM_SETTINGS.maxActiveContributors, 1, 100),
    monthlySubmissionLimit: normalizeInteger(value.monthlySubmissionLimit, DEFAULT_PIPELINE_PROGRAM_SETTINGS.monthlySubmissionLimit, 1, 250),
    maxSubmissionFileSizeMb: normalizeInteger(
      value.maxSubmissionFileSizeMb,
      DEFAULT_PIPELINE_PROGRAM_SETTINGS.maxSubmissionFileSizeMb,
      1,
      PIPELINE_UPLOAD_HARD_MAX_MB,
    ),
    monthlyPublishedRequirement: normalizeInteger(value.monthlyPublishedRequirement, DEFAULT_PIPELINE_PROGRAM_SETTINGS.monthlyPublishedRequirement, 0, 100),
    minimumVotesForGrading: normalizeInteger(value.minimumVotesForGrading, DEFAULT_PIPELINE_PROGRAM_SETTINGS.minimumVotesForGrading, 1, 1000),
    freeAssetMinimumPositiveVotePercent: normalizeInteger(value.freeAssetMinimumPositiveVotePercent, DEFAULT_PIPELINE_PROGRAM_SETTINGS.freeAssetMinimumPositiveVotePercent, 1, 100),
    paidAssetMinimumPositiveVotePercent: normalizeInteger(value.paidAssetMinimumPositiveVotePercent, DEFAULT_PIPELINE_PROGRAM_SETTINGS.paidAssetMinimumPositiveVotePercent, 1, 100),
    allowContributorSelfVoting: normalizeBoolean(value.allowContributorSelfVoting, DEFAULT_PIPELINE_PROGRAM_SETTINGS.allowContributorSelfVoting),
    ownerVoteWeight: normalizeInteger(value.ownerVoteWeight, DEFAULT_PIPELINE_PROGRAM_SETTINGS.ownerVoteWeight, 1, 3),
    publishCapsByType: derivePipelinePublishCapsByType(tierCapsByType),
    tierCapsByType,
  };
};

const isSameUtcMonth = (value: string, now: Date): boolean => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
};

export const countPipelineMonthlyStats = (
  submissions: Array<Pick<PipelineSubmissionSummary, 'status' | 'submittedAt' | 'publishedAt'>>,
  now = new Date()
): PipelineMonthlyStats => submissions.reduce<PipelineMonthlyStats>((stats, submission) => {
  if (isSameUtcMonth(submission.submittedAt, now)) {
    stats.submitted += 1;
    if (submission.status === 'archived') stats.archived += 1;
    if (submission.status === 'rejected') stats.rejected += 1;
  }
  if (submission.publishedAt && isSameUtcMonth(submission.publishedAt, now)) stats.published += 1;
  return stats;
}, {
  submitted: 0,
  published: 0,
  archived: 0,
  rejected: 0,
});
