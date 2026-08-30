"use client";

import { useEffect, useState } from 'react';

import {
  type PipelineAccessTier,
  type PipelineStatus,
  type PipelineType,
} from '@/features/pipeline/lib/pipelineItems';
import type { PipelineProgramView } from '@/features/pipeline/lib/pipelineProgram';
import type { VoteFilter } from '@/features/pipeline/components/PipelineContributionModel';

export function usePipelineReviewQueue(program: PipelineProgramView | null) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PipelineType | 'all'>('all');
  const [status, setStatus] = useState<PipelineStatus | 'all'>('all');
  const [tier, setTier] = useState<PipelineAccessTier | 'all'>('all');
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const submissions = program?.votingQueue ?? [];
  const statusCounts = program?.reviewStatusCounts ?? {} as Record<PipelineStatus, number>;
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
