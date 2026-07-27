"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BookOpenCheck,
  Boxes,
  FileCheck2,
  Megaphone,
  RefreshCw,
  Settings2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeveloperAssetHubPanel } from '@/features/developer-assets/client';
import { DEVELOPER_CONTRIBUTION_SCOPE_LABELS } from '@/features/developer-access/client';
import {
  type DeveloperCockpitView,
  loadDeveloperCockpit,
} from '@/features/developer-cockpit/client/api';
import { DeveloperCampaignPanel } from '@/features/developer-cockpit/components/DeveloperCampaignPanel';
import { DeveloperScopePanel } from '@/features/developer-cockpit/components/DeveloperScopePanel';
import { DeveloperSiteProposalPanel } from '@/features/developer-cockpit/components/DeveloperSiteProposalPanel';

const tabClassName = 'min-h-11 rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]';
const cockpitTabs: ReadonlyArray<{ value: string; label: string; ownerOnly?: boolean }> = [
  { value: 'overview', label: 'Cockpit' },
  { value: 'library', label: 'Library' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'site', label: 'Site Proposals' },
  { value: 'standards', label: 'Standards' },
  { value: 'access', label: 'Contributor Access', ownerOnly: true },
];

const standards = [
  'Use real CardForge proof. Keep product claims grounded in a current screen, workflow, release, or public capability.',
  'Attach source and license notes. A reviewer should know who owns every image and why CardForge may publish it.',
  'Write channel-native variants. The campaign package is the source of truth; Buffer only handles connected channels and delivery.',
  'Never place secrets, customer data, private email, billing details, or unreleased account state in screenshots.',
  'Site-copy proposals compare against the captured live text. If the live block changes first, rebase instead of overwriting it.',
  'Owner approval is not ceremonial: it is the only boundary that can expose media, publish site copy, or schedule social posts.',
];

export function DeveloperCockpitPage() {
  const [cockpit, setCockpit] = useState<DeveloperCockpitView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setCockpit(await loadDeveloperCockpit());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the developer cockpit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !cockpit) {
    return <CockpitMessage title="Opening the cockpit" body="Loading contribution scopes, review queues, and publishing readiness…" />;
  }
  if (!cockpit) {
    return (
      <CockpitMessage
        title="Developer cockpit unavailable"
        body={loadError ?? 'Sign in with an approved developer or owner account.'}
        action={<div className="flex gap-3"><Button onClick={() => void load()}>Retry</Button><Button asChild variant="outline"><Link href="/developer">Developer program</Link></Button></div>}
      />
    );
  }

  const submittedCampaigns = cockpit.campaigns.filter((campaign) => campaign.status === 'submitted').length;
  const submittedProposals = cockpit.siteProposals.filter((proposal) => proposal.status === 'submitted').length;
  const activeJobs = cockpit.publishJobs.filter((job) => job.status === 'scheduled' || job.status === 'provider_draft').length;

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <section className="mx-auto max-w-7xl space-y-4 px-4 py-5 md:px-6">
        <header className="border border-[#6d4f2b] bg-[#15100a] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2aa4a]">Developer cockpit</p>
              <h1 className="mt-2 font-serif text-3xl text-[#fff1c7] md:text-4xl">Operate the contribution lanes.</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
                Supabase owns packages, permissions, media, approvals, and history. Buffer owns connected social channels, scheduling, and delivery.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`border px-3 py-2 text-xs ${cockpit.configured ? 'border-[#497352] text-[#a8e7b8]' : 'border-[#8c6436] text-[#f0bd75]'}`}>
                {cockpit.configured ? 'Database ready' : 'Migration/config required'}
              </span>
              <Button type="button" className="min-h-11" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>
          {loadError ? <p role="alert" className="mt-3 border border-[#7d3d32] bg-[#1b0d09] p-3 text-sm text-[#ffd0c6]">{loadError}</p> : null}
          {!cockpit.extendedContributionsEnabled ? (
            <p className="mt-3 border border-[#8c6436] bg-[#1b1209] p-3 text-sm leading-6 text-[#f0bd75]">
              Extended contributor lanes are release-gated. Owners can inspect and test them, but developer campaign/site scopes stay inactive until the updated contribution terms and privacy disclosure are published and the server flag is enabled.
            </p>
          ) : null}
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <label className="grid gap-1 text-xs text-[#c7b288] sm:hidden">
            Workspace section
            <select
              aria-label="Cockpit section"
              className="min-h-11 border border-[#5f4526] bg-[#100c08] px-3 text-sm text-[#ffe7ad]"
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value)}
            >
              {cockpitTabs.filter((tab) => !tab.ownerOnly || cockpit.isOwner).map((tab) => <option key={tab.value} value={tab.value}>{tab.label}</option>)}
            </select>
          </label>
          <TabsList className="hidden sm:flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
            {cockpitTabs.filter((tab) => !tab.ownerOnly || cockpit.isOwner).map((tab) => <TabsTrigger key={tab.value} value={tab.value} className={tabClassName}>{tab.label}</TabsTrigger>)}
          </TabsList>

          <TabsContent value="overview" className="mt-3 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard icon={Megaphone} label="Campaign review" value={submittedCampaigns} help={cockpit.isOwner ? 'Submitted packages waiting for owner review.' : 'Your packages currently in owner review.'} />
              <MetricCard icon={FileCheck2} label="Site review" value={submittedProposals} help={cockpit.isOwner ? 'Copy proposals waiting for an owner decision.' : 'Your copy proposals currently in owner review.'} />
              <MetricCard icon={Activity} label="Provider jobs" value={activeJobs} help="Buffer drafts and scheduled posts with durable CardForge records." />
            </div>
            <section className="grid gap-3 lg:grid-cols-2">
              <article className="border border-[#5f4526] bg-[#15100a] p-5">
                <div className="flex items-center gap-3 text-[#e2aa4a]"><Boxes className="h-5 w-5" /><h2 className="font-serif text-xl text-[#fff1c7]">Your enabled lanes</h2></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cockpit.scopes.map((scope) => <span key={scope} className="border border-[#4a3823] bg-[#100c08] px-3 py-2 text-xs text-[#d8c49a]">{DEVELOPER_CONTRIBUTION_SCOPE_LABELS[scope]}</span>)}
                </div>
              </article>
              <article className="border border-[#5f4526] bg-[#15100a] p-5">
                <div className="flex items-center gap-3 text-[#e2aa4a]"><Settings2 className="h-5 w-5" /><h2 className="font-serif text-xl text-[#fff1c7]">Publishing boundary</h2></div>
                <p className="mt-3 text-sm leading-6 text-[#c7b288]">
                  Buffer is {cockpit.provider.configured ? 'configured' : 'not configured'} and live publishing is {cockpit.provider.publishingEnabled ? 'enabled' : 'hard-disabled'}.
                </p>
                {!cockpit.provider.publishingEnabled ? <p className="mt-2 text-xs leading-5 text-[#f0bd75]">This is the safe release state until credentials, channel allowlisting, legal copy, and production verification are complete.</p> : null}
              </article>
            </section>
          </TabsContent>

          <TabsContent value="library" className="mt-3"><DeveloperAssetHubPanel compact /></TabsContent>
          <TabsContent value="campaigns" className="mt-3"><DeveloperCampaignPanel cockpit={cockpit} onChange={setCockpit} /></TabsContent>
          <TabsContent value="site" className="mt-3"><DeveloperSiteProposalPanel cockpit={cockpit} onChange={setCockpit} /></TabsContent>
          <TabsContent value="standards" className="mt-3">
            <section className="border border-[#5f4526] bg-[#15100a] p-5">
              <div className="flex items-center gap-3 text-[#e2aa4a]"><BookOpenCheck className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Contribution standards</h2></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {standards.map((standard) => <p key={standard} className="border border-[#4a3823] bg-[#100c08] p-4 text-sm leading-6 text-[#d8c49a]">{standard}</p>)}
              </div>
            </section>
          </TabsContent>
          {cockpit.isOwner ? <TabsContent value="access" className="mt-3"><DeveloperScopePanel cockpit={cockpit} onChange={setCockpit} /></TabsContent> : null}
        </Tabs>
      </section>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  help,
}: {
  icon: typeof Megaphone;
  label: string;
  value: number;
  help: string;
}) {
  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</span><Icon className="h-4 w-4 text-[#e2aa4a]" /></div>
      <p className="mt-3 font-serif text-3xl text-[#fff1c7]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#c7b288]">{help}</p>
    </article>
  );
}

function CockpitMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0c0b09] px-5 py-12 text-[#f7ead0]">
      <section className="mx-auto max-w-3xl border border-[#6d4f2b] bg-[#15100a] p-6">
        <h1 className="font-serif text-3xl text-[#fff1c7]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#c7b288]">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
    </main>
  );
}
