"use client";

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/client';
import {
  DEVELOPER_CONTRIBUTION_SCOPE_LABELS,
  hasContributionScope,
  type DeveloperAccessProjection,
} from '@/features/developer-access/client';
import {
  DeveloperSiteProposalPanel,
  loadDeveloperSiteWorkspace,
  type DeveloperSiteWorkspaceView,
} from '@/features/developer-cockpit/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export function ContributorProfilePanel({ access }: { access: DeveloperAccessProjection }) {
  const router = useRouter();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [site, setSite] = useState<DeveloperSiteWorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canProposeSite = hasContributionScope(access.scopes, 'site.propose');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [programResponse, siteWorkspace] = await Promise.all([
        fetch('/api/developer-assets/library', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Contributor statistics are unavailable.'));
          return response.json() as Promise<{ program: DeveloperAssetProgramView }>;
        }),
        canProposeSite ? loadDeveloperSiteWorkspace() : Promise.resolve(null),
      ]);
      setProgram(programResponse.program);
      setSite(siteWorkspace);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Contributor details are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [canProposeSite]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !program) return <div className="grid min-h-40 place-items-center text-sm text-[var(--cf-text-muted)]"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Preparing contributor profile</span></div>;

  return <div className="space-y-5">
    {error ? <EnvironmentBoundaryNotice title="Contributor details are unavailable" message={`${error} Your granted access has not been relabeled or removed.`} actionLabel="Retry" onAction={() => void load()} /> : null}
    <section aria-labelledby="contributor-access-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--cf-border)] pb-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Contributor profile</p><h2 id="contributor-access-heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">Access and personal progress</h2></div><Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div>
      {program ? <dl className="mt-3 grid grid-cols-2 border border-[var(--cf-border)] sm:grid-cols-4">
        <CompactStat label="Submitted this month" value={program.developerStats.submitted} />
        <CompactStat label="Published this month" value={program.developerStats.published} />
        <CompactStat label="Monthly target" value={program.effectiveMonthlyPublishedRequirement} />
        <CompactStat label="Submissions left" value={program.remainingSubmissions} />
      </dl> : null}
      <div className="mt-3 divide-y divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)]">{access.scopes.map((scope) => <div key={scope} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"><span className="text-[var(--cf-text-muted)]">{DEVELOPER_CONTRIBUTION_SCOPE_LABELS[scope]}</span><span className="text-xs text-[var(--cf-success)]">Granted</span></div>)}</div>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => router.push('/account?section=library&scope=pipeline')}>Open Pipeline <ExternalLink className="ml-2 h-3.5 w-3.5" /></Button><Button type="button" size="sm" variant="outline" onClick={() => router.push('/account?section=library&scope=published')}>Your published work</Button>{hasContributionScope(access.scopes, 'campaigns.draft') ? <Button type="button" size="sm" variant="outline" onClick={() => router.push('/account?section=library&scope=campaigns')}>Campaigns</Button> : null}</div>
    </section>
    {canProposeSite && site ? <section aria-labelledby="profile-site-proposals-heading"><div className="border-b border-[var(--cf-border)] pb-3"><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Granted contribution lane</p><h2 id="profile-site-proposals-heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">Site proposals</h2><p className="mt-1 text-sm text-[var(--cf-text-muted)]">Your drafts and review status follow your contributor identity. Final publication remains owner-controlled.</p></div><div className="mt-3"><DeveloperSiteProposalPanel cockpit={site} onChange={setSite} /></div></section> : null}
  </div>;
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 border-b border-r border-[var(--cf-border-subtle)] px-3 py-2 last:border-r-0 sm:border-b-0"><dt className="truncate text-[0.68rem] uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{label}</dt><dd className="mt-1 font-serif text-xl text-[var(--cf-text-strong)]">{value}</dd></div>;
}
