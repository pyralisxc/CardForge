import {
  PIPELINE_TYPES,
  countPipelineMonthlyStats,
  type PipelineStatus,
  type PipelineType,
  type PipelineProgramSettings,
} from './pipelineItems';
import type {
  PipelinePageSummary,
  PipelineProfile,
  PipelineProgramAggregate,
  PipelineProgramView,
  PipelineSubmission,
} from './pipelineProgram';

const resolveEffectiveContributorRules = (
  settings: PipelineProgramSettings,
  profile?: PipelineProfile | null,
) => ({
  effectiveSubmissionLimit: profile?.monthly_submission_limit_override ?? settings.monthlySubmissionLimit,
  effectivePublishedRequirement: profile?.monthly_published_requirement_override ?? settings.monthlyPublishedRequirement,
  submissionLimitOverride: profile?.monthly_submission_limit_override ?? null,
  publishedRequirementOverride: profile?.monthly_published_requirement_override ?? null,
  ownerNote: profile?.owner_note ?? null,
});

const profileDisplayName = (
  contributorEmail: string | null,
  profile?: PipelineProfile | null,
): string | null => (
  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  || profile?.email
  || contributorEmail
);

const REVIEW_STATUSES = new Set(['draft', 'submitted', 'voting', 'publish_candidate', 'published']);
const ALL_STATUSES: PipelineStatus[] = [
  'draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected',
];

export const buildPipelineProgramView = ({
  configured,
  settings,
  currentUserId,
  currentContributorIds = [currentUserId],
  activeContributorCount = 1,
  submissions,
  votingQueue,
  submissionPage,
  votingPage,
  aggregate,
  profiles = [],
  now = new Date(),
}: {
  configured: boolean;
  settings: PipelineProgramSettings;
  currentUserId: string;
  currentContributorIds?: string[];
  activeContributorCount?: number;
  submissions: PipelineSubmission[];
  votingQueue?: PipelineSubmission[];
  submissionPage?: PipelinePageSummary;
  votingPage?: PipelinePageSummary;
  aggregate?: PipelineProgramAggregate;
  profiles?: PipelineProfile[];
  now?: Date;
}): PipelineProgramView => {
  const profilesById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const currentProfile = profilesById.get(currentUserId);
  const contributorIds = new Set(currentContributorIds.length > 0 ? currentContributorIds : [currentUserId]);
  const accountSubmissions = submissions.filter((submission) => submission.contributorId === currentUserId);
  const currentRules = resolveEffectiveContributorRules(settings, currentProfile);
  const contributionStats = aggregate?.monthlyStatsByContributor[currentUserId]
    ?? countPipelineMonthlyStats(accountSubmissions, now);
  const assetTypeSummaries = PIPELINE_TYPES.map((assetType) => {
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
  const contributionsByContributor = new Map<string, PipelineSubmission[]>();
  Object.keys(aggregate?.monthlyStatsByContributor ?? {}).forEach((id) => contributionsByContributor.set(id, []));
  submissions.forEach((submission) => {
    contributionsByContributor.set(submission.contributorId, [...(contributionsByContributor.get(submission.contributorId) ?? []), submission]);
  });
  profiles.forEach((profile) => {
    if ((!profile.status || profile.status === 'active') && !contributionsByContributor.has(profile.clerk_user_id)) {
      contributionsByContributor.set(profile.clerk_user_id, []);
    }
  });
  const contributions = Array.from(contributionsByContributor.entries()).map(([contributorId, rows]) => {
    const stats = aggregate?.monthlyStatsByContributor[contributorId] ?? countPipelineMonthlyStats(rows, now);
    const contributorEmail = rows.find((submission) => submission.contributorEmail)?.contributorEmail ?? null;
    const profile = profilesById.get(contributorId);
    const rules = resolveEffectiveContributorRules(settings, profile);
    return {
      contributorId,
      contributorEmail: profile?.email ?? contributorEmail,
      contributorName: rows.find((submission) => submission.contributorDisplayName)?.contributorDisplayName
        ?? profileDisplayName(contributorEmail, profile),
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
  }).sort((left, right) => right.submitted - left.submitted || left.contributorId.localeCompare(right.contributorId));
  const isVoteable = (submission: PipelineSubmission) => (
    REVIEW_STATUSES.has(submission.status)
    && (settings.allowContributorSelfVoting || !contributorIds.has(submission.contributorId))
  );

  return {
    configured,
    settings,
    currentUserId,
    currentContributorIds: Array.from(contributorIds),
    activeContributorCount,
    submissions,
    votingQueue: votingQueue ?? submissions.filter(isVoteable),
    submissionPage: submissionPage ?? { total: submissions.length, page: 1, pageSize: Math.max(1, submissions.length) },
    votingPage: votingPage ?? { total: submissions.filter(isVoteable).length, page: 1, pageSize: Math.max(1, submissions.length) },
    totalSubmissionCount: aggregate?.totalSubmissionCount ?? submissions.length,
    totalVoteableCount: aggregate?.totalVoteableCount ?? submissions.filter(isVoteable).length,
    submissionStatusCounts: Object.fromEntries(ALL_STATUSES.map((status) => [
      status,
      aggregate?.submissionStatusCounts[status] ?? submissions.filter((submission) => submission.status === status).length,
    ])) as Record<PipelineStatus, number>,
    reviewStatusCounts: Object.fromEntries(ALL_STATUSES.map((status) => [
      status,
      aggregate?.reviewStatusCounts[status] ?? submissions.filter((submission) => submission.status === status && isVoteable(submission)).length,
    ])) as Record<PipelineStatus, number>,
    submissionTypeCounts: Object.fromEntries(PIPELINE_TYPES.map((assetType) => [
      assetType,
      aggregate?.submissionTypeCounts[assetType] ?? submissions.filter((submission) => submission.assetType === assetType).length,
    ])) as Record<PipelineType, number>,
    managedFileCount: aggregate?.managedFileCount ?? submissions.filter((submission) => submission.sourceStorageBucket && submission.sourceStoragePath).length,
    managedStorageBytes: aggregate?.managedStorageBytes ?? submissions.reduce((total, submission) => (
      total + (submission.sourceStorageBucket && submission.sourceStoragePath ? submission.sourceFileSizeBytes ?? 0 : 0)
    ), 0),
    assetTypeSummaries,
    contributions,
    contributionStats,
    effectiveMonthlySubmissionLimit: currentRules.effectiveSubmissionLimit,
    effectiveMonthlyPublishedRequirement: currentRules.effectivePublishedRequirement,
    contributorOwnerNote: currentRules.ownerNote,
    remainingSubmissions: Math.max(0, currentRules.effectiveSubmissionLimit - contributionStats.submitted),
  };
};

export const projectPipelineProgramForViewer = (
  program: PipelineProgramView,
  { currentUserId, isOwner }: { currentUserId: string; isOwner: boolean },
): PipelineProgramView => {
  if (isOwner) return program;
  const projectedById = new Map([...program.submissions, ...program.votingQueue].map((submission) => [
    submission.id,
    submission.contributorId === currentUserId ? submission : {
      ...submission,
      contributorEmail: null,
      sourceUrl: null,
      sourceStorageBucket: null,
      sourceStoragePath: null,
    },
  ] as const));
  return {
    ...program,
    submissions: program.submissions.map((submission) => projectedById.get(submission.id) ?? submission),
    votingQueue: program.votingQueue.map((submission) => projectedById.get(submission.id) ?? submission),
    contributions: program.contributions.map((contribution) => ({
      ...contribution,
      contributorEmail: contribution.contributorId === currentUserId ? contribution.contributorEmail : null,
      ownerNote: contribution.contributorId === currentUserId ? contribution.ownerNote : null,
    })),
  };
};
