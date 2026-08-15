"use client";

import { useEffect, useState } from 'react';

import {
  type DeveloperAssetAccessTier,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import type { VoteFilter } from '@/features/developer-assets/components/DeveloperAssetHubModel';

export function useDeveloperReviewQueue(program: DeveloperAssetProgramView | null) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<DeveloperAssetType | 'all'>('all');
  const [status, setStatus] = useState<DeveloperAssetStatus | 'all'>('all');
  const [tier, setTier] = useState<DeveloperAssetAccessTier | 'all'>('all');
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const submissions = program?.votingQueue ?? [];
  const statusCounts = program?.reviewStatusCounts ?? {} as Record<DeveloperAssetStatus, number>;
  const pageCount = Math.max(1, Math.ceil((program?.votingPage.total ?? 0) / pageSize));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => setPage(1), [pageSize, search, status, tier, type, voteFilter]);

  return {
    submissions,
    statusCounts,
    visibleSubmissions: submissions,
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
