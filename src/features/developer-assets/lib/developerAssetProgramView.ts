import {
  DEVELOPER_ASSET_TYPES,
  countDeveloperMonthlyStats,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
  type DeveloperProgramSettings,
} from './developerAssets';
import type {
  DeveloperAssetPageSummary,
  DeveloperAssetProfile,
  DeveloperAssetProgramAggregate,
  DeveloperAssetProgramView,
  DeveloperAssetSubmission,
} from './developerAssetProgram';

const resolveEffectiveDeveloperRules = (
  settings: DeveloperProgramSettings,
  profile?: DeveloperAssetProfile | null,
) => ({
  effectiveSubmissionLimit: profile?.monthly_submission_limit_override ?? settings.monthlySubmissionLimit,
  effectivePublishedRequirement: profile?.monthly_published_requirement_override ?? settings.monthlyPublishedRequirement,
  submissionLimitOverride: profile?.monthly_submission_limit_override ?? null,
  publishedRequirementOverride: profile?.monthly_published_requirement_override ?? null,
  ownerNote: profile?.owner_note ?? null,
});

const profileDisplayName = (
  developerEmail: string | null,
  profile?: DeveloperAssetProfile | null,
): string | null => (
  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  || profile?.email
  || developerEmail
);

const REVIEW_STATUSES = new Set(['draft', 'submitted', 'voting', 'publish_candidate', 'published']);
const ALL_STATUSES: DeveloperAssetStatus[] = [
  'draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected',
];

export const buildDeveloperAssetProgramView = ({
  configured,
  settings,
  currentUserId,
  currentContributorIds = [currentUserId],
  activeDeveloperCount = 1,
  submissions,
  votingQueue,
  submissionPage,
  votingPage,
  aggregate,
  profiles = [],
  now = new Date(),
}: {
  configured: boolean;
  settings: DeveloperProgramSettings;
  currentUserId: string;
  currentContributorIds?: string[];
  activeDeveloperCount?: number;
  submissions: DeveloperAssetSubmission[];
  votingQueue?: DeveloperAssetSubmission[];
  submissionPage?: DeveloperAssetPageSummary;
  votingPage?: DeveloperAssetPageSummary;
  aggregate?: DeveloperAssetProgramAggregate;
  profiles?: DeveloperAssetProfile[];
  now?: Date;
}): DeveloperAssetProgramView => {
  const profilesById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const currentProfile = profilesById.get(currentUserId);
  const contributorIds = new Set(currentContributorIds.length > 0 ? currentContributorIds : [currentUserId]);
  const accountSubmissions = submissions.filter((submission) => submission.developerId === currentUserId);
  const currentRules = resolveEffectiveDeveloperRules(settings, currentProfile);
  const developerStats = aggregate?.monthlyStatsByDeveloper[currentUserId]
    ?? countDeveloperMonthlyStats(accountSubmissions, now);
  const assetTypeSummaries = DEVELOPER_ASSET_TYPES.map((assetType) => {
    const byType = submissions.filter((submission) => submission.assetType === assetType);
    const published = byType.filter((submission) => submission.status === 'published');
    const metrics = aggregate?.assetTypeMetrics[assetType];
    const publishedCount = metrics?.published ?? published.length;
    const starterCount = metrics?.starter ?? published.filter((submission) => submission.calculatedAccessTier === 'free').length;
    const creatorPassCount = metrics?.creatorPass ?? published.filter((submission) => submission.calculatedAccessTier === 'paid').length;
    const publishCap = settings.publishCapsByType[assetType];
    const starterCap = settings.tierCapsByType[assetType].free;
    const creatorPassCap = settings.tierCapsByType[assetType].paid;
    return {
      assetType,
      publishedCount,
      starterCount,
      creatorPassCount,
      candidateCount: metrics?.candidate ?? byType.filter((submission) => ['voting', 'publish_candidate'].includes(submission.status)).length,
      archiveCount: metrics?.archived ?? byType.filter((submission) => submission.status === 'archived').length,
      publishCap,
      starterCap,
      creatorPassCap,
      openPublishSlots: Math.max(0, publishCap - publishedCount),
      overPublishCapBy: Math.max(0, publishedCount - publishCap),
      overStarterCapBy: Math.max(0, starterCount - starterCap),
      overCreatorPassCapBy: Math.max(0, creatorPassCount - creatorPassCap),
    };
  });
  const contributions = new Map<string, DeveloperAssetSubmission[]>();
  Object.keys(aggregate?.monthlyStatsByDeveloper ?? {}).forEach((id) => contributions.set(id, []));
  submissions.forEach((submission) => {
    contributions.set(submission.developerId, [...(contributions.get(submission.developerId) ?? []), submission]);
  });
  profiles.forEach((profile) => {
    if ((!profile.status || profile.status === 'active') && !contributions.has(profile.clerk_user_id)) {
      contributions.set(profile.clerk_user_id, []);
    }
  });
  const developerContributions = Array.from(contributions.entries()).map(([developerId, rows]) => {
    const stats = aggregate?.monthlyStatsByDeveloper[developerId] ?? countDeveloperMonthlyStats(rows, now);
    const developerEmail = rows.find((submission) => submission.developerEmail)?.developerEmail ?? null;
    const profile = profilesById.get(developerId);
    const rules = resolveEffectiveDeveloperRules(settings, profile);
    return {
      developerId,
      developerEmail: profile?.email ?? developerEmail,
      developerName: rows.find((submission) => submission.developerDisplayName)?.developerDisplayName
        ?? profileDisplayName(developerEmail, profile),
      profileStatus: profile?.status ?? 'active',
      submitted: stats.submitted,
      published: stats.published,
      archived: stats.archived,
      rejected: stats.rejected,
      effectiveSubmissionLimit: rules.effectiveSubmissionLimit,
      effectivePublishedRequirement: rules.effectivePublishedRequirement,
      submissionLimitOverride: rules.submissionLimitOverride,
      publishedRequirementOverride: rules.publishedRequirementOverride,
      remainingSubmissions: Math.max(0, rules.effectiveSubmissionLimit - stats.submitted),
      requiredPublished: rules.effectivePublishedRequirement,
      missingPublished: Math.max(0, rules.effectivePublishedRequirement - stats.published),
      ownerNote: rules.ownerNote,
      isOwnerDefaultContributor: false,
    };
  }).sort((left, right) => right.submitted - left.submitted || left.developerId.localeCompare(right.developerId));
  const isVoteable = (submission: DeveloperAssetSubmission) => (
    REVIEW_STATUSES.has(submission.status)
    && (settings.allowContributorSelfVoting || !contributorIds.has(submission.developerId))
  );

  return {
    configured,
    settings,
    currentUserId,
    currentContributorIds: Array.from(contributorIds),
    activeDeveloperCount,
    submissions,
    votingQueue: votingQueue ?? submissions.filter(isVoteable),
    submissionPage: submissionPage ?? { total: submissions.length, page: 1, pageSize: Math.max(1, submissions.length) },
    votingPage: votingPage ?? { total: submissions.filter(isVoteable).length, page: 1, pageSize: Math.max(1, submissions.length) },
    totalSubmissionCount: aggregate?.totalSubmissionCount ?? submissions.length,
    totalVoteableCount: aggregate?.totalVoteableCount ?? submissions.filter(isVoteable).length,
    submissionStatusCounts: Object.fromEntries(ALL_STATUSES.map((status) => [
      status,
      aggregate?.submissionStatusCounts[status] ?? submissions.filter((submission) => submission.status === status).length,
    ])) as Record<DeveloperAssetStatus, number>,
    reviewStatusCounts: Object.fromEntries(ALL_STATUSES.map((status) => [
      status,
      aggregate?.reviewStatusCounts[status] ?? submissions.filter((submission) => submission.status === status && isVoteable(submission)).length,
    ])) as Record<DeveloperAssetStatus, number>,
    submissionTypeCounts: Object.fromEntries(DEVELOPER_ASSET_TYPES.map((assetType) => [
      assetType,
      aggregate?.submissionTypeCounts[assetType] ?? submissions.filter((submission) => submission.assetType === assetType).length,
    ])) as Record<DeveloperAssetType, number>,
    managedFileCount: aggregate?.managedFileCount ?? submissions.filter((submission) => submission.sourceStorageBucket && submission.sourceStoragePath).length,
    managedStorageBytes: aggregate?.managedStorageBytes ?? submissions.reduce((total, submission) => (
      total + (submission.sourceStorageBucket && submission.sourceStoragePath ? submission.sourceFileSizeBytes ?? 0 : 0)
    ), 0),
    assetTypeSummaries,
    developerContributions,
    developerStats,
    effectiveMonthlySubmissionLimit: currentRules.effectiveSubmissionLimit,
    effectiveMonthlyPublishedRequirement: currentRules.effectivePublishedRequirement,
    developerOwnerNote: currentRules.ownerNote,
    remainingSubmissions: Math.max(0, currentRules.effectiveSubmissionLimit - developerStats.submitted),
  };
};

export const projectDeveloperAssetProgramForViewer = (
  program: DeveloperAssetProgramView,
  { currentUserId, isOwner }: { currentUserId: string; isOwner: boolean },
): DeveloperAssetProgramView => {
  if (isOwner) return program;
  const projectedById = new Map([...program.submissions, ...program.votingQueue].map((submission) => [
    submission.id,
    submission.developerId === currentUserId ? submission : {
      ...submission,
      developerEmail: null,
      sourceUrl: null,
      sourceStorageBucket: null,
      sourceStoragePath: null,
    },
  ] as const));
  return {
    ...program,
    submissions: program.submissions.map((submission) => projectedById.get(submission.id) ?? submission),
    votingQueue: program.votingQueue.map((submission) => projectedById.get(submission.id) ?? submission),
    developerContributions: program.developerContributions.map((contribution) => ({
      ...contribution,
      developerEmail: contribution.developerId === currentUserId ? contribution.developerEmail : null,
      ownerNote: contribution.developerId === currentUserId ? contribution.ownerNote : null,
    })),
  };
};
