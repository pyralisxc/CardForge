"use client";

import { useCallback, useEffect, useState } from 'react';
import { FileCheck2, ImageIcon, Megaphone, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadDeveloperCockpit, type DeveloperCockpitView } from '@/features/developer-cockpit/client/api';
import {
  DeveloperCampaignMediaLibrary,
  DeveloperCampaignPanel,
  DeveloperSiteProposalPanel,
} from '@/features/developer-cockpit/client/owner';

const subtabClassName = 'rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[#a98a75] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[#ffe7ad]';

export function OwnerProductionPanel() {
  const [cockpit, setCockpit] = useState<DeveloperCockpitView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCockpit(await loadDeveloperCockpit());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load campaign production.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!cockpit) return <section className={`border p-5 ${error ? 'border-[#7d3d32] bg-[#1b0d09] text-[#ffd0c6]' : 'border-[#5f4526] bg-[#15100a] text-[#c7b288]'}`}><h2 className="font-serif text-2xl text-[#fff1c7]">{error ? 'Production workspace unavailable' : 'Loading production workspace...'}</h2>{error ? <><p className="mt-3 text-sm">{error}</p><Button className="mt-4" variant="outline" onClick={() => void load()}>Retry</Button></> : null}</section>;

  const activeJobs = cockpit.publishJobs.filter((job) => job.status === 'scheduled' || job.status === 'provider_draft').length;
  const reviewCampaigns = cockpit.campaigns.filter((campaign) => campaign.status === 'submitted' || campaign.status === 'changes_requested').length;
  const reviewMedia = cockpit.campaignMedia.filter((media) => media.reviewState === 'needs_review').length;
  const reviewCopy = cockpit.siteProposals.filter((proposal) => proposal.status === 'submitted').length;

  return (
    <section className="space-y-4">
      <header className="border border-[#5f4526] bg-[#15100a] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">Continuous production</p><h2 className="mt-1 font-serif text-2xl text-[#fff1c7]">Campaigns, media &amp; site proposals</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#c7b288]">CardForge owns production packages and media history. Buffer owns connected channels and delivery. Nothing publishes without the existing owner approval boundary.</p></div><Button type="button" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ProductionMetric icon={Megaphone} label="Campaign review" value={reviewCampaigns} /><ProductionMetric icon={ImageIcon} label="Media review" value={reviewMedia} /><ProductionMetric icon={FileCheck2} label="Copy review" value={reviewCopy} /><ProductionMetric icon={Megaphone} label="Buffer drafts & schedules" value={activeJobs} /></div>
        <div className={`mt-4 border p-3 text-sm ${cockpit.provider.configured ? 'border-[#497352] bg-[#0e170f] text-[#a8e7b8]' : 'border-[#8c6436] bg-[#1b1209] text-[#f0bd75]'}`}>Buffer is {cockpit.provider.configured ? 'configured' : 'not configured'}; production publishing is {cockpit.provider.publishingEnabled ? 'enabled' : 'hard-disabled'}. Provider credentials remain in Vercel/Buffer, while channel bindings and delivery history remain visible here.</div>
      </header>
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1"><TabsTrigger value="campaigns" className={subtabClassName}>Campaign packages</TabsTrigger><TabsTrigger value="media" className={subtabClassName}>Approved media</TabsTrigger><TabsTrigger value="copy" className={subtabClassName}>Site proposals</TabsTrigger></TabsList>
        <TabsContent value="campaigns" className="mt-0"><DeveloperCampaignPanel cockpit={cockpit} onChange={setCockpit} /></TabsContent>
        <TabsContent value="media" className="mt-0"><DeveloperCampaignMediaLibrary media={cockpit.campaignMedia} pageInfo={cockpit.campaignMediaPage} summary={cockpit.campaignMediaSummary} onChange={setCockpit} /></TabsContent>
        <TabsContent value="copy" className="mt-0"><DeveloperSiteProposalPanel cockpit={cockpit} onChange={setCockpit} /></TabsContent>
      </Tabs>
    </section>
  );
}

function ProductionMetric({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: number }) {
  return <div className="border border-[#4a3823] bg-[#100c08] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">{label}</span><Icon className="h-4 w-4 text-[#e2aa4a]" /></div><strong className="mt-2 block font-serif text-2xl text-[#fff1c7]">{value}</strong></div>;
}
