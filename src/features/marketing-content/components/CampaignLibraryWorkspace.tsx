"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/infrastructure/http/clientResponses';
import { mustClearScopedSourceForFailure } from '@/shared/scopedSource';
import {
  loadMarketingContentWorkspace,
} from '@/features/marketing-content/client/api';
import type {
  MarketingContentWorkspaceView,
} from '@/features/marketing-content/model';
import { CampaignWorkspace } from './CampaignWorkspace';

export function CampaignLibraryWorkspace({ initialCampaignId = null }: { initialCampaignId?: string | null }) {
  const [workspace, setWorkspace] = useState<MarketingContentWorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await loadMarketingContentWorkspace());
    } catch (nextError) {
      if (nextError instanceof ApiClientError && mustClearScopedSourceForFailure(nextError.kind)) {
        setWorkspace(null);
      }
      setError(nextError instanceof Error ? nextError.message : 'Campaign work is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedCampaign = useMemo(() => workspace?.campaigns.find((campaign) => campaign.id === initialCampaignId) ?? null, [initialCampaignId, workspace]);

  if (loading && !workspace) return <div className="grid min-h-56 place-items-center text-sm text-[var(--cf-text-muted)]"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Preparing campaigns</span></div>;
  if (!workspace) return <div role="alert" className="flex min-h-32 flex-wrap items-center justify-between gap-3 border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-4"><div><strong className="text-[var(--cf-text-strong)]">Campaigns are unavailable</strong><p className="mt-1 text-sm text-[var(--cf-text-muted)]">{error ?? 'CardForge could not load campaign work.'}</p></div><Button type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>;

  return <div className="space-y-4" data-library-campaign-workspace>
    {selectedCampaign ? <p role="status" className="border border-[var(--cf-accent)] bg-[var(--cf-surface-inset)] px-3 py-2 text-sm text-[var(--cf-accent-text)]">Opened from Desk: {selectedCampaign.title}</p> : null}
    <CampaignWorkspace workspace={workspace} initialCampaignId={initialCampaignId} onRefresh={load} />
  </div>;
}
