"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Megaphone, Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  loadCampaignDeskProjection,
  loadMarketingContentWorkspace,
} from '@/features/marketing-content/client/api';
import type {
  CampaignDeskProjection,
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cf-border)] pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <Megaphone className="h-5 w-5 shrink-0 text-[var(--cf-accent-strong)]" aria-hidden="true" />
        <div className="min-w-0"><strong className="block text-[var(--cf-text-strong)]">{workspace.campaigns.length} campaign package{workspace.campaigns.length === 1 ? '' : 's'}</strong><span className="text-xs text-[var(--cf-text-muted)]">Draft and revise here. Approval, destinations, scheduling, and delivery remain in Owner.</span></div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
    </div>
    {selectedCampaign ? <p role="status" className="border border-[var(--cf-accent)] bg-[var(--cf-surface-inset)] px-3 py-2 text-sm text-[var(--cf-accent-text)]">Opened from Desk: {selectedCampaign.title}</p> : null}
    <CampaignWorkspace workspace={workspace} initialCampaignId={initialCampaignId} onRefresh={load} />
  </div>;
}

export function CampaignDeskShelf({ onOpen }: { onOpen: (campaignId?: string) => void }) {
  const [desk, setDesk] = useState<CampaignDeskProjection | null>(null);
  const [error, setError] = useState(false);

  const loadDesk = useCallback(async () => {
    setError(false);
    try {
      setDesk(await loadCampaignDeskProjection());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCampaignDeskProjection()
      .then((next) => { if (!cancelled) setDesk(next); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (!desk && !error) return null;
  if (!desk) return <section className="border-t border-[var(--cf-border)] pt-4" aria-labelledby="desk-campaigns-heading" data-desk-campaigns>
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Specialized work</p><h2 id="desk-campaigns-heading" className="font-serif text-xl text-[var(--cf-text-strong)]">Campaigns unavailable</h2></div><Button type="button" size="sm" variant="outline" onClick={() => void loadDesk()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>
  </section>;
  const campaigns = desk.campaigns.filter((campaign) => !['published', 'cancelled'].includes(campaign.status)).slice(0, 6);
  return <section className="border-t border-[var(--cf-border)] pt-4" aria-labelledby="desk-campaigns-heading" data-desk-campaigns>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Specialized work</p><h2 id="desk-campaigns-heading" className="font-serif text-xl text-[var(--cf-text-strong)]">Campaigns</h2></div><Button type="button" size="sm" variant="outline" onClick={() => onOpen('new')}><Plus className="mr-2 h-4 w-4" />New campaign</Button></div>
    {campaigns.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => {
      const preview = campaign.variants.flatMap((variant) => variant.attachments).find((attachment) => attachment.media.previewUrl)?.media.previewUrl ?? null;
      return <button key={campaign.id} type="button" onClick={() => onOpen(campaign.id)} className="grid min-h-20 grid-cols-[3.5rem,minmax(0,1fr)] items-center gap-3 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-2 text-left hover:border-[var(--cf-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-accent-strong)]">
        <span className="grid h-14 w-14 place-items-center overflow-hidden border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)]">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Megaphone className="h-5 w-5 text-[var(--cf-accent-strong)]" aria-hidden="true" />}</span>
        <span className="min-w-0"><strong className="block truncate text-sm text-[var(--cf-text-strong)]">{campaign.title}</strong><span className="mt-1 block text-xs text-[var(--cf-text-muted)]">{campaign.status.replaceAll('_', ' ')} · {campaign.variants.length} variant{campaign.variants.length === 1 ? '' : 's'}</span></span>
      </button>;
    })}</div> : <button type="button" onClick={() => onOpen('new')} className="mt-3 flex min-h-16 w-full items-center gap-3 border border-dashed border-[var(--cf-border)] px-4 text-left text-sm text-[var(--cf-text-muted)] hover:border-[var(--cf-accent)]"><Megaphone className="h-5 w-5" aria-hidden="true" />Start the first campaign package</button>}
  </section>;
}
