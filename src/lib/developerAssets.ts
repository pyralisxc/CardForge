export const DEVELOPER_ASSET_TYPES = [
  'templates',
  'elementPresets',
  'textures',
  'dividers',
  'icons',
  'imageAssets',
  'parts',
] as const;

export const DEVELOPER_ASSET_STATUSES = [
  'draft',
  'submitted',
  'voting',
  'publish_candidate',
  'published',
  'archived',
  'rejected',
] as const;

export type DeveloperAssetType = typeof DEVELOPER_ASSET_TYPES[number];
export type DeveloperAssetStatus = typeof DEVELOPER_ASSET_STATUSES[number];
export type DeveloperProfileStatus = 'invited' | 'active' | 'inactive' | 'suspended';
export type DeveloperVoteValue = 'positive' | 'negative';
export type DeveloperAssetAccessTier = 'hidden' | 'free' | 'paid' | 'developer' | 'official';
export type DeveloperAssetAccessTierOverride = 'hidden' | 'free' | 'paid' | 'official';

export type DeveloperPublishCapsByType = Record<DeveloperAssetType, number>;
export type DeveloperTierCapsByType = Record<DeveloperAssetType, { free: number; paid: number }>;

export interface DeveloperProgramSettings {
  maxActiveDevelopers: number;
  monthlySubmissionLimit: number;
  monthlyPublishedRequirement: number;
  minimumVotesForGrading: number;
  minimumPositiveVotePercent: number;
  freeAssetMinimumPositiveVotePercent: number;
  paidAssetMinimumPositiveVotePercent: number;
  minimumVotesForTierAssignment: number;
  showPaidPreviewToFreeUsers: boolean;
  allowPaidEarlyAccessToCandidates: boolean;
  allowContributorSelfVoting: boolean;
  ownerVoteWeight: number;
  archiveVisibleLimit: number;
  profitSharePoolPercent: number;
  ownerFinalReviewRequired: boolean;
  publishCapsByType: DeveloperPublishCapsByType;
  tierCapsByType: DeveloperTierCapsByType;
}

export type DeveloperVotingPreset = 'solo' | 'currentRoster' | 'launchRoster' | 'fullCouncil';

export interface DeveloperAssetSubmissionSummary {
  id: string;
  status: DeveloperAssetStatus;
  submittedAt: string;
  updatedAt?: string | null;
}

export interface DeveloperAssetMonthlyStats {
  submitted: number;
  published: number;
  archived: number;
  rejected: number;
}

export interface DeveloperAssetTypePipelineSummary {
  assetType: DeveloperAssetType;
  publishedCount: number;
  officialCount: number;
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

export interface DeveloperContributionSummary {
  developerId: string;
  developerEmail: string | null;
  developerName: string | null;
  submitted: number;
  published: number;
  archived: number;
  rejected: number;
  remainingSubmissions: number;
  requiredPublished: number;
  missingPublished: number;
  isOwnerDefaultContributor: boolean;
}

export interface DeveloperAssetStorageForecast {
  publishSlotCount: number;
  monthlyVotingSlotCount: number;
  archiveSlotCount: number;
  estimatedPublishedBytes: number;
  estimatedMonthlyVotingBytes: number;
  estimatedArchiveBytes: number;
  estimatedMaximumManagedBytes: number;
  averageAssetBytes: number;
  largestEstimatedAssetBytes: number;
}

export type DeveloperAssetDecisionReason =
  | 'needs_more_votes'
  | 'negative_vote_balance'
  | 'below_positive_threshold'
  | 'publish_cap_full'
  | 'passes_vote_threshold'
  | 'awaiting_owner_review';

export type DeveloperAssetTierDecisionReason =
  | 'needs_more_votes'
  | 'below_free_threshold'
  | 'free_candidate'
  | 'paid_candidate'
  | 'developer_review'
  | 'hidden_status'
  | 'tier_cap_full'
  | 'owner_forced_free'
  | 'owner_forced_paid'
  | 'owner_forced_hidden'
  | 'owner_forced_official';

export interface DeveloperAssetDecisionInput {
  settings: DeveloperProgramSettings;
  positiveVotes: number;
  negativeVotes: number;
  publishedThisPeriodForType: number;
  ownerFinalReviewRequired?: boolean;
}

export interface DeveloperAssetDecision {
  nextStatus: Extract<DeveloperAssetStatus, 'voting' | 'publish_candidate' | 'archived'>;
  reason: DeveloperAssetDecisionReason;
  positiveVotePercent: number;
  totalVotes: number;
}

export interface DeveloperAssetAccessTierInput {
  settings: DeveloperProgramSettings;
  status: DeveloperAssetStatus;
  assetType: DeveloperAssetType;
  positiveVotes: number;
  negativeVotes: number;
  tieredThisPeriodForType?: number;
  freeTieredThisPeriodForType?: number;
  paidTieredThisPeriodForType?: number;
  ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null;
  ignoreTierCaps?: boolean;
}

export interface DeveloperAssetAccessTierDecision {
  accessTier: DeveloperAssetAccessTier;
  reason: DeveloperAssetTierDecisionReason;
  qualityScore: number;
  totalVotes: number;
}

export const DEFAULT_DEVELOPER_TIER_CAPS_BY_TYPE: DeveloperTierCapsByType = {
  templates: { free: 6, paid: 3 },
  elementPresets: { free: 16, paid: 8 },
  textures: { free: 16, paid: 8 },
  dividers: { free: 16, paid: 8 },
  icons: { free: 20, paid: 10 },
  imageAssets: { free: 16, paid: 8 },
  parts: { free: 16, paid: 8 },
};

export const deriveDeveloperPublishCapsByType = (
  tierCaps: DeveloperTierCapsByType
): DeveloperPublishCapsByType => DEVELOPER_ASSET_TYPES.reduce<DeveloperPublishCapsByType>((caps, type) => {
  caps[type] = Math.max(0, tierCaps[type].free) + Math.max(0, tierCaps[type].paid);
  return caps;
}, {} as DeveloperPublishCapsByType);

export const DEFAULT_DEVELOPER_PUBLISH_CAPS_BY_TYPE: DeveloperPublishCapsByType =
  deriveDeveloperPublishCapsByType(DEFAULT_DEVELOPER_TIER_CAPS_BY_TYPE);

export const DEFAULT_DEVELOPER_PROGRAM_SETTINGS: DeveloperProgramSettings = {
  maxActiveDevelopers: 25,
  monthlySubmissionLimit: 25,
  monthlyPublishedRequirement: 5,
  minimumVotesForGrading: 5,
  minimumPositiveVotePercent: 70,
  freeAssetMinimumPositiveVotePercent: 60,
  paidAssetMinimumPositiveVotePercent: 80,
  minimumVotesForTierAssignment: 5,
  showPaidPreviewToFreeUsers: true,
  allowPaidEarlyAccessToCandidates: false,
  allowContributorSelfVoting: true,
  ownerVoteWeight: 1,
  archiveVisibleLimit: 100,
  profitSharePoolPercent: 10,
  ownerFinalReviewRequired: true,
  publishCapsByType: DEFAULT_DEVELOPER_PUBLISH_CAPS_BY_TYPE,
  tierCapsByType: DEFAULT_DEVELOPER_TIER_CAPS_BY_TYPE,
};

export const DEVELOPER_ASSET_STORAGE_ESTIMATE_BYTES: Record<DeveloperAssetType, number> = {
  templates: 80 * 1024,
  elementPresets: 24 * 1024,
  textures: 850 * 1024,
  dividers: 120 * 1024,
  icons: 80 * 1024,
  imageAssets: 1_500 * 1024,
  parts: 900 * 1024,
};

const clampInteger = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export const getDeveloperVotingPresetLabel = (
  preset: DeveloperVotingPreset,
  activeDeveloperCount: number
): string => {
  const activeCount = Math.max(1, Math.round(activeDeveloperCount));
  if (preset === 'solo') return 'Solo owner test';
  if (preset === 'currentRoster') return `${activeCount} developer roster`;
  if (preset === 'launchRoster') return 'Launch roster';
  return 'Full council';
};

export const buildDeveloperVotingPresetSettings = (
  settings: DeveloperProgramSettings,
  preset: DeveloperVotingPreset,
  activeDeveloperCount: number
): DeveloperProgramSettings => {
  const activeCount = Math.max(1, Math.round(activeDeveloperCount));
  const rosterBasedVotes = clampInteger(Math.ceil(activeCount * 0.6), 1, 15);
  const voteCount = preset === 'solo'
    ? 1
    : preset === 'currentRoster'
      ? rosterBasedVotes
      : preset === 'launchRoster'
        ? 5
        : 9;

  return normalizeDeveloperProgramSettingsInput({
    ...settings,
    minimumVotesForGrading: voteCount,
    minimumVotesForTierAssignment: voteCount,
    minimumPositiveVotePercent: preset === 'solo' ? 60 : preset === 'fullCouncil' ? 75 : 70,
    freeAssetMinimumPositiveVotePercent: preset === 'solo' ? 50 : 60,
    paidAssetMinimumPositiveVotePercent: preset === 'solo' ? 75 : 80,
  });
};

export const estimateDeveloperAssetStorage = (
  settings: DeveloperProgramSettings,
  activeDeveloperCount: number
): DeveloperAssetStorageForecast => {
  const publishSlotCount = DEVELOPER_ASSET_TYPES.reduce(
    (total, type) => total + settings.publishCapsByType[type],
    0,
  );
  const estimatedPublishedBytes = DEVELOPER_ASSET_TYPES.reduce(
    (total, type) => total + settings.publishCapsByType[type] * DEVELOPER_ASSET_STORAGE_ESTIMATE_BYTES[type],
    0,
  );
  const estimates = DEVELOPER_ASSET_TYPES.map((type) => DEVELOPER_ASSET_STORAGE_ESTIMATE_BYTES[type]);
  const averageAssetBytes = Math.round(estimates.reduce((total, value) => total + value, 0) / estimates.length);
  const largestEstimatedAssetBytes = Math.max(...estimates);
  const safeDeveloperCount = Math.max(1, Math.round(activeDeveloperCount));
  const monthlyVotingSlotCount = Math.max(0, safeDeveloperCount * settings.monthlySubmissionLimit);
  const archiveSlotCount = Math.max(0, settings.archiveVisibleLimit);
  const estimatedMonthlyVotingBytes = monthlyVotingSlotCount * averageAssetBytes;
  const estimatedArchiveBytes = archiveSlotCount * averageAssetBytes;

  return {
    publishSlotCount,
    monthlyVotingSlotCount,
    archiveSlotCount,
    estimatedPublishedBytes,
    estimatedMonthlyVotingBytes,
    estimatedArchiveBytes,
    estimatedMaximumManagedBytes: estimatedPublishedBytes + estimatedMonthlyVotingBytes + estimatedArchiveBytes,
    averageAssetBytes,
    largestEstimatedAssetBytes,
  };
};

export const isDeveloperAssetType = (value: unknown): value is DeveloperAssetType =>
  typeof value === 'string' && (DEVELOPER_ASSET_TYPES as readonly string[]).includes(value);

export const isDeveloperAssetStatus = (value: unknown): value is DeveloperAssetStatus =>
  typeof value === 'string' && (DEVELOPER_ASSET_STATUSES as readonly string[]).includes(value);

export const isDeveloperAssetAccessTier = (value: unknown): value is DeveloperAssetAccessTier =>
  value === 'hidden' || value === 'free' || value === 'paid' || value === 'developer' || value === 'official';

export const isDeveloperAssetAccessTierOverride = (value: unknown): value is DeveloperAssetAccessTierOverride =>
  value === 'hidden' || value === 'free' || value === 'paid' || value === 'official';

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

export const normalizeDeveloperPublishCapsByType = (value: unknown): DeveloperPublishCapsByType => {
  const input = isRecord(value) ? value : {};

  return DEVELOPER_ASSET_TYPES.reduce<DeveloperPublishCapsByType>((caps, type) => {
    caps[type] = normalizeInteger(
      input[type],
      DEFAULT_DEVELOPER_PUBLISH_CAPS_BY_TYPE[type],
      0,
      500,
    );
    return caps;
  }, { ...DEFAULT_DEVELOPER_PUBLISH_CAPS_BY_TYPE });
};

export const normalizeDeveloperTierCapsByType = (value: unknown): DeveloperTierCapsByType => {
  const input = isRecord(value) ? value : {};

  return DEVELOPER_ASSET_TYPES.reduce<DeveloperTierCapsByType>((caps, type) => {
    const entry = isRecord(input[type]) ? input[type] : {};
    caps[type] = {
      free: normalizeInteger(entry.free, DEFAULT_DEVELOPER_TIER_CAPS_BY_TYPE[type].free, 0, 1000),
      paid: normalizeInteger(entry.paid, DEFAULT_DEVELOPER_TIER_CAPS_BY_TYPE[type].paid, 0, 1000),
    };
    return caps;
  }, { ...DEFAULT_DEVELOPER_TIER_CAPS_BY_TYPE });
};

export const normalizeDeveloperProgramSettingsInput = (
  value: Partial<Record<keyof DeveloperProgramSettings, unknown>>
): DeveloperProgramSettings => {
  const tierCapsByType = normalizeDeveloperTierCapsByType(value.tierCapsByType);

  return {
    maxActiveDevelopers: normalizeInteger(value.maxActiveDevelopers, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.maxActiveDevelopers, 1, 100),
    monthlySubmissionLimit: normalizeInteger(value.monthlySubmissionLimit, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.monthlySubmissionLimit, 1, 250),
    monthlyPublishedRequirement: normalizeInteger(value.monthlyPublishedRequirement, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.monthlyPublishedRequirement, 0, 100),
    minimumVotesForGrading: normalizeInteger(value.minimumVotesForGrading, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.minimumVotesForGrading, 1, 1000),
    minimumPositiveVotePercent: normalizeInteger(value.minimumPositiveVotePercent, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.minimumPositiveVotePercent, 1, 100),
    freeAssetMinimumPositiveVotePercent: normalizeInteger(value.freeAssetMinimumPositiveVotePercent, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.freeAssetMinimumPositiveVotePercent, 1, 100),
    paidAssetMinimumPositiveVotePercent: normalizeInteger(value.paidAssetMinimumPositiveVotePercent, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.paidAssetMinimumPositiveVotePercent, 1, 100),
    minimumVotesForTierAssignment: normalizeInteger(value.minimumVotesForTierAssignment, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.minimumVotesForTierAssignment, 1, 1000),
    showPaidPreviewToFreeUsers: normalizeBoolean(value.showPaidPreviewToFreeUsers, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.showPaidPreviewToFreeUsers),
    allowPaidEarlyAccessToCandidates: normalizeBoolean(value.allowPaidEarlyAccessToCandidates, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.allowPaidEarlyAccessToCandidates),
    allowContributorSelfVoting: normalizeBoolean(value.allowContributorSelfVoting, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.allowContributorSelfVoting),
    ownerVoteWeight: normalizeInteger(value.ownerVoteWeight, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.ownerVoteWeight, 1, 3),
    archiveVisibleLimit: normalizeInteger(value.archiveVisibleLimit, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.archiveVisibleLimit, 1, 500),
    profitSharePoolPercent: normalizeInteger(value.profitSharePoolPercent, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.profitSharePoolPercent, 0, 50),
    ownerFinalReviewRequired: normalizeBoolean(value.ownerFinalReviewRequired, DEFAULT_DEVELOPER_PROGRAM_SETTINGS.ownerFinalReviewRequired),
    publishCapsByType: deriveDeveloperPublishCapsByType(tierCapsByType),
    tierCapsByType,
  };
};

const calculateVoteStats = (positiveVotes: number, negativeVotes: number) => {
  const safePositiveVotes = Math.max(0, positiveVotes);
  const safeNegativeVotes = Math.max(0, negativeVotes);
  const totalVotes = safePositiveVotes + safeNegativeVotes;
  const qualityScore = totalVotes === 0 ? 0 : Math.round((safePositiveVotes / totalVotes) * 100);
  return { totalVotes, qualityScore };
};

export const evaluateDeveloperAssetAccessTier = ({
  settings,
  status,
  assetType,
  positiveVotes,
  negativeVotes,
  tieredThisPeriodForType,
  freeTieredThisPeriodForType,
  paidTieredThisPeriodForType,
  ownerAccessTierOverride,
  ignoreTierCaps = false,
}: DeveloperAssetAccessTierInput): DeveloperAssetAccessTierDecision => {
  const { totalVotes, qualityScore } = calculateVoteStats(positiveVotes, negativeVotes);
  const fallbackTieredCount = tieredThisPeriodForType ?? 0;
  const freeTierCount = freeTieredThisPeriodForType ?? fallbackTieredCount;
  const paidTierCount = paidTieredThisPeriodForType ?? fallbackTieredCount;

  if (ownerAccessTierOverride) {
    return {
      accessTier: ownerAccessTierOverride,
      reason: `owner_forced_${ownerAccessTierOverride}` as DeveloperAssetTierDecisionReason,
      qualityScore,
      totalVotes,
    };
  }

  if (status === 'archived' || status === 'rejected') {
    return { accessTier: 'hidden', reason: 'hidden_status', qualityScore, totalVotes };
  }

  if (status === 'draft' || status === 'submitted' || status === 'voting') {
    if (totalVotes < settings.minimumVotesForTierAssignment) {
      return { accessTier: 'developer', reason: 'needs_more_votes', qualityScore, totalVotes };
    }
  }

  if (totalVotes < settings.minimumVotesForTierAssignment) {
    return { accessTier: 'developer', reason: 'needs_more_votes', qualityScore, totalVotes };
  }

  if (qualityScore < settings.freeAssetMinimumPositiveVotePercent) {
    return { accessTier: 'hidden', reason: 'below_free_threshold', qualityScore, totalVotes };
  }

  if (qualityScore >= settings.paidAssetMinimumPositiveVotePercent) {
    if (!ignoreTierCaps && paidTierCount >= settings.tierCapsByType[assetType].paid) {
      return { accessTier: 'developer', reason: 'tier_cap_full', qualityScore, totalVotes };
    }
    return { accessTier: 'paid', reason: 'paid_candidate', qualityScore, totalVotes };
  }

  if (!ignoreTierCaps && freeTierCount >= settings.tierCapsByType[assetType].free) {
    return { accessTier: 'developer', reason: 'tier_cap_full', qualityScore, totalVotes };
  }

  return { accessTier: 'free', reason: 'free_candidate', qualityScore, totalVotes };
};

export const evaluateDeveloperAssetDecision = ({
  settings,
  positiveVotes,
  negativeVotes,
  publishedThisPeriodForType,
  ownerFinalReviewRequired = settings.ownerFinalReviewRequired,
}: DeveloperAssetDecisionInput): DeveloperAssetDecision => {
  const totalVotes = Math.max(0, positiveVotes) + Math.max(0, negativeVotes);
  const positiveVotePercent = totalVotes === 0 ? 0 : Math.round((Math.max(0, positiveVotes) / totalVotes) * 100);

  if (totalVotes < settings.minimumVotesForGrading) {
    return { nextStatus: 'voting', reason: 'needs_more_votes', positiveVotePercent, totalVotes };
  }

  if (negativeVotes > positiveVotes) {
    return { nextStatus: 'archived', reason: 'negative_vote_balance', positiveVotePercent, totalVotes };
  }

  if (positiveVotePercent < settings.minimumPositiveVotePercent) {
    return { nextStatus: 'voting', reason: 'below_positive_threshold', positiveVotePercent, totalVotes };
  }

  const hasOpenPublishSlot = publishedThisPeriodForType < Math.max(0, publishedThisPeriodForType + 1)
    && publishedThisPeriodForType < Number.MAX_SAFE_INTEGER;
  if (!hasOpenPublishSlot) {
    return { nextStatus: 'voting', reason: 'publish_cap_full', positiveVotePercent, totalVotes };
  }

  if (ownerFinalReviewRequired) {
    return { nextStatus: 'publish_candidate', reason: 'awaiting_owner_review', positiveVotePercent, totalVotes };
  }

  return { nextStatus: 'publish_candidate', reason: 'passes_vote_threshold', positiveVotePercent, totalVotes };
};

export const evaluateDeveloperAssetDecisionForType = (
  input: Omit<DeveloperAssetDecisionInput, 'publishedThisPeriodForType'> & {
    assetType: DeveloperAssetType;
    publishedThisPeriodForType: number;
  }
): DeveloperAssetDecision => {
  const typeCap = input.settings.publishCapsByType[input.assetType];
  if (input.publishedThisPeriodForType >= typeCap) {
    const totalVotes = Math.max(0, input.positiveVotes) + Math.max(0, input.negativeVotes);
    const positiveVotePercent = totalVotes === 0 ? 0 : Math.round((Math.max(0, input.positiveVotes) / totalVotes) * 100);
    return { nextStatus: 'voting', reason: 'publish_cap_full', positiveVotePercent, totalVotes };
  }

  return evaluateDeveloperAssetDecision(input);
};

export const getVisibleArchivedSubmissions = <T extends DeveloperAssetSubmissionSummary>(
  submissions: T[],
  limit = DEFAULT_DEVELOPER_PROGRAM_SETTINGS.archiveVisibleLimit
): T[] => submissions
  .filter((submission) => submission.status === 'archived')
  .sort((a, b) => {
    const bDate = new Date(b.updatedAt ?? b.submittedAt).getTime();
    const aDate = new Date(a.updatedAt ?? a.submittedAt).getTime();
    return bDate - aDate;
  })
  .slice(0, Math.max(0, limit));

const isSameUtcMonth = (value: string, now: Date): boolean => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
};

export const countDeveloperMonthlyStats = (
  submissions: Array<Pick<DeveloperAssetSubmissionSummary, 'status' | 'submittedAt'>>,
  now = new Date()
): DeveloperAssetMonthlyStats => submissions.reduce<DeveloperAssetMonthlyStats>((stats, submission) => {
  if (!isSameUtcMonth(submission.submittedAt, now)) return stats;

  stats.submitted += 1;
  if (submission.status === 'published') stats.published += 1;
  if (submission.status === 'archived') stats.archived += 1;
  if (submission.status === 'rejected') stats.rejected += 1;
  return stats;
}, {
  submitted: 0,
  published: 0,
  archived: 0,
  rejected: 0,
});
