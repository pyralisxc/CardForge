"use client";

import { useEffect, useMemo, useState } from 'react';

import {
  DEVELOPER_ASSET_STATUSES,
  type DeveloperAssetAccessTier,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import {
  getSearchableSubmissionText,
  isCurrentContributorSubmission,
  type VoteFilter,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';

export function useDeveloperReviewQueue(program: DeveloperAssetProgramView | null) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<DeveloperAssetType | 'all'>('all');
  const [status, setStatus] = useState<DeveloperAssetStatus | 'all'>('all');
  const [tier, setTier] = useState<DeveloperAssetAccessTier | 'all'>('all');
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const submissions = useMemo(() => {
    if (!program) return [];
    return (program.settings.allowContributorSelfVoting
      ? program.submissions
      : program.submissions.filter((submission) => !isCurrentContributorSubmission(submission, program))
    ).filter((submission) => submission.status !== 'rejected');
  }, [program]);

  const statusCounts = useMemo(() => {
    const counts = DEVELOPER_ASSET_STATUSES.reduce<Record<DeveloperAssetStatus, number>>((next, value) => {
      next[value] = 0;
      return next;
    }, {} as Record<DeveloperAssetStatus, number>);
    for (const submission of submissions) counts[submission.status] += 1;
    return counts;
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return submissions.filter((submission) => {
      if (query && !getSearchableSubmissionText(submission).includes(query)) return false;
      if (type !== 'all' && submission.assetType !== type) return false;
      if (status !== 'all' && submission.status !== status) return false;
      if (tier !== 'all' && submission.calculatedAccessTier !== tier) return false;
      if (voteFilter === 'unvoted' && submission.currentUserVote) return false;
      if (voteFilter === 'upvoted' && submission.currentUserVote !== 'positive') return false;
      if (voteFilter === 'downvoted' && submission.currentUserVote !== 'negative') return false;
      return true;
    });
  }, [search, status, submissions, tier, type, voteFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleSubmissions = filteredSubmissions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [pageSize, search, status, tier, type, voteFilter]);

  return {
    submissions,
    statusCounts,
    filteredSubmissions,
    visibleSubmissions,
    search,
    setSearch,
    type,
    setType,
    status,
    setStatus,
    tier,
    setTier,
    voteFilter,
    setVoteFilter,
    pageSize,
    setPageSize,
    page: currentPage,
    setPage,
    pageCount,
  };
}
