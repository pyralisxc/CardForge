"use client";

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { PipelineContributorSummary } from '@/features/pipeline/client';
import {
  CONTRIBUTOR_SCOPE_LABELS,
  hasContributionScope,
  type ContributorAccessProjection,
} from '@/features/contributor-access/client';
import {
  SiteProposalPanel,
  loadSiteProposalWorkspace,
  type SiteProposalWorkspace,
} from '@/features/site-proposals/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export function ContributorProfilePanel({ access }: { access: ContributorAccessProjection }) {
  const router = useRouter();
  const [summary, setSummary] = useState<PipelineContributorSummary | null>(null);
  const [site, setSite] = useState<SiteProposalWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canProposeSite = hasContributionScope(access.scopes, 'site.propose');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, siteWorkspace] = await Promise.all([
        fetch('/api/pipeline/contributor-summary', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Contributor statistics are unavailable.'));
          return response.json() as Promise<{ summary: PipelineContributorSummary }>;
        }),
        canProposeSite ? loadSiteProposalWorkspace() : Promise.resolve(null),
      ]);
      setSummary(summaryResponse.summary);
      setSite(siteWorkspace);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Contributor details are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [canProposeSite]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !summary) return <div className="grid min-h-40 place-items-center text-sm text-[var(--cf-text-muted)]"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Preparing contributor profile</span></div>;

  return <div className="space-y-5">
    {error ? <EnvironmentBoundaryNotice title="Contributor details are unavailable" message={`${error} Your granted access has not been relabeled or removed.`} actionLabel="Retry" onAction={() => void load()} /> : null}
    <section aria-labelledby="contributor-access-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--cf-border)] pb-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Contributor profile</p><h2 id="contributor-access-heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">Access and personal progress</h2></div><Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div>
      {summary ? <dl className="mt-3 grid grid-cols-2 border border-[var(--cf-border)] sm:grid-cols-4">
        <CompactStat label="Submitted this month" value={summary.submittedThisMonth} />
        <CompactStat label="Published this month" value={summary.publishedThisMonth} />
        <CompactStat label="Monthly target" value={summary.monthlyPublishedRequirement} />
        <CompactStat label="Submissions left" value={summary.remainingSubmissions} />
      </dl> : null}
      <details className="group mt-3 border-y border-[var(--cf-border-subtle)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm text-[var(--cf-text-muted)]">
          <span><strong className="font-medium text-[var(--cf-text-strong)]">{access.scopes.length} permissions granted</strong> · Pipeline and contribution tools are account-scoped</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid border-t border-[var(--cf-border-subtle)] sm:grid-cols-2">{access.scopes.map((scope) => <div key={scope} className="flex min-h-10 items-center justify-between gap-3 border-b border-[var(--cf-border-subtle)] py-2 text-sm sm:odd:border-r"><span className="text-[var(--cf-text-muted)]">{CONTRIBUTOR_SCOPE_LABELS[scope]}</span><span className="pr-2 text-xs text-[var(--cf-success)]">Granted</span></div>)}</div>
      </details>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => router.push('/account?section=library&scope=pipeline')}>Open Pipeline <ExternalLink className="ml-2 h-3.5 w-3.5" /></Button><Button type="button" size="sm" variant="outline" onClick={() => router.push('/account?section=library&scope=published')}>Your published work</Button>{hasContributionScope(access.scopes, 'campaigns.draft') ? <Button type="button" size="sm" variant="outline" onClick={() => router.push('/account?section=library&scope=campaigns')}>Campaigns</Button> : null}</div>
    </section>
    {canProposeSite && site ? <section aria-labelledby="profile-site-proposals-heading"><div className="border-b border-[var(--cf-border)] pb-3"><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Granted contribution lane</p><h2 id="profile-site-proposals-heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">Site proposals</h2><p className="mt-1 text-sm text-[var(--cf-text-muted)]">Your drafts and review status follow your contributor identity. Final publication remains owner-controlled.</p></div><div className="mt-3"><SiteProposalPanel workspace={site} onChange={setSite} /></div></section> : null}
  </div>;
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 border-b border-r border-[var(--cf-border-subtle)] px-3 py-2 last:border-r-0 sm:border-b-0"><dt className="truncate text-[0.68rem] uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{label}</dt><dd className="mt-1 font-serif text-xl text-[var(--cf-text-strong)]">{value}</dd></div>;
}
