"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CardForgeCatalogManifest, PipelineProgramView } from '@/features/pipeline/client';
import { readApiError } from '@/infrastructure/http/clientResponses';
import { projectPipelineLibraryObjects, sharedFailure, type LibrarySharedFailure } from './useLibrarySharedProjection';

/** Owner inventory uses the existing authorized, server-filtered submission query. */
export function useLibraryRevisionQueue({ enabled, query, catalog, catalogLoading = false, catalogFailure = null }: {
  enabled: boolean; query: string; catalog: CardForgeCatalogManifest | null;
  catalogLoading?: boolean; catalogFailure?: LibrarySharedFailure | null;
}) {
  const [assetType, setAssetType] = useState('all');
  const [status, setStatus] = useState('all');
  const filterKey = JSON.stringify([query, assetType, status]);
  const [position, setPosition] = useState({ key: filterKey, page: 1 });
  const page = position.key === filterKey ? position.page : 1;
  const [revision, setRevision] = useState(0);
  const ready = enabled && Boolean(catalog) && !catalogLoading && !catalogFailure;
  const requestKey = JSON.stringify([ready, filterKey, page, revision]);
  const [result, setResult] = useState<{ key: string; program: PipelineProgramView | null; failure: LibrarySharedFailure | null } | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), [setRevision]);
  useEffect(() => {
    if (!ready) { setResult(null); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ query, assetType, status, page: String(page), pageSize: '12' });
    void fetch(`/api/pipeline?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw await readApiError(response, 'Pipeline revisions are unavailable.');
        return response.json() as Promise<{ program: PipelineProgramView }>;
      })
      .then(({ program }) => { if (!controller.signal.aborted) setResult({ key: requestKey, program, failure: null }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, program: null, failure: sharedFailure(error, 'Pipeline revisions are unavailable.') });
      });
    return () => controller.abort();
  }, [ready, query, assetType, status, page, requestKey]);
  const program = ready && result?.key === requestKey ? result.program : null;
  const items = useMemo(() => program ? program.submissions.flatMap(submission => projectPipelineLibraryObjects({
    ...program, submissions: [submission], votingQueue: [],
  }, catalog)) : [], [program, catalog]);
  return {
    items, total: program?.submissionPage.total ?? 0, page, pageSize: 12,
    loading: enabled && !catalogFailure && (!ready || result?.key !== requestKey),
    failure: enabled ? catalogFailure ?? (result?.key === requestKey ? result.failure : null) : null,
    assetType, setAssetType, status, setStatus,
    setPage: (next: number) => setPosition({ key: filterKey, page: Math.max(1, next) }), refresh,
  };
}
