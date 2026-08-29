"use client";

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import {
  loadDeveloperSiteWorkspace,
  type DeveloperSiteWorkspaceView,
} from '@/features/developer-cockpit/client/api';
import { DeveloperSiteProposalPanel } from '@/features/developer-cockpit/client';

export function OwnerSiteProposalReviewPanel() {
  const [workspace, setWorkspace] = useState<DeveloperSiteWorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setWorkspace(await loadDeveloperSiteWorkspace()); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Site proposals are unavailable.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !workspace) return <div className="grid min-h-48 place-items-center text-sm text-[var(--cf-text-muted)]"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Preparing site proposals</span></div>;
  if (!workspace) return <EnvironmentBoundaryNotice title="Site proposals are unavailable" message={error ?? 'CardForge could not load the proposal queue.'} actionLabel="Retry" onAction={() => void load()} />;

  return <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Owner review</p><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Site proposals</h2><p className="mt-1 text-sm text-[var(--cf-text-muted)]">Review contributor changes against current live copy. Publishing remains an explicit owner action.</p></div><Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div><DeveloperSiteProposalPanel cockpit={workspace} onChange={setWorkspace} /></section>;
}
