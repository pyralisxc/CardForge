"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpenCheck,
  Boxes,
  FileCheck2,
  Megaphone,
  RefreshCw,
  Target,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  CardForgeStatusBadge,
  CardForgeSurface,
  CardForgeWorkspaceNavigation,
  CardForgeWorkspaceState,
} from '@/components/ui/cardforge-presentation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { DEVELOPER_CONTRIBUTION_SCOPE_LABELS } from '@/features/developer-access/client';
import {
  type DeveloperCampaignWorkspaceView,
  type DeveloperCockpitBootstrap,
  type DeveloperSiteWorkspaceView,
  loadDeveloperCampaignWorkspace,
  loadDeveloperCockpit,
  loadDeveloperSiteWorkspace,
} from '@/features/developer-cockpit/client/api';

const panelFallback = () => (
  <CardForgeWorkspaceState state="loading" message="Loading this workspace…" />
);
const DeveloperAssetHubPanel = dynamic(() => import('@/features/developer-assets/client').then((module) => module.DeveloperAssetHubPanel), { loading: panelFallback });
const DeveloperCampaignPanel = dynamic(() => import('@/features/marketing-content/client').then((module) => module.DeveloperCampaignPanel), { loading: panelFallback });
const DeveloperCampaignMediaLibrary = dynamic(() => import('@/features/marketing-content/client').then((module) => module.DeveloperCampaignMediaLibrary), { loading: panelFallback });
const DeveloperSiteProposalPanel = dynamic(() => import('./DeveloperSiteProposalPanel').then((module) => module.DeveloperSiteProposalPanel), { loading: panelFallback });

const cockpitTabs: ReadonlyArray<{ value: string; label: string; ownerOnly?: boolean }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'library', label: 'Asset Contributions' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'campaign-media', label: 'Campaign Media', ownerOnly: true },
  { value: 'site', label: 'Site Proposals' },
  { value: 'standards', label: 'Standards' },
];
const standards = [
  'Use real CardForge proof. Keep product claims grounded in a current screen, workflow, release, or public capability.',
  'Attach source and license notes. A reviewer should know who owns every image and why CardForge may publish it.',
  'Write channel-native variants inside the owner-selected campaign. CardForge keeps the strategy, review, destination, schedule, and delivery record together.',
  'Never place secrets, customer data, private email, billing details, or unreleased account state in screenshots.',
  'Site-copy proposals compare against the captured live text. If the live text changes first, update the proposal from the latest version instead of overwriting it.',
  'Owner approval is not ceremonial: it is the only boundary that can expose media, publish site copy, or schedule social posts.',
];

type LazyState = { loading: boolean; error: string | null };
const idleState: LazyState = { loading: false, error: null };

export function DeveloperCockpitPage({ initialTab = 'overview', initialSubmissionId = null }: { initialTab?: string; initialSubmissionId?: string | null }) {
  const [cockpit, setCockpit] = useState<DeveloperCockpitBootstrap | null>(null);
  const [campaigns, setCampaigns] = useState<DeveloperCampaignWorkspaceView | null>(null);
  const [site, setSite] = useState<DeveloperSiteWorkspaceView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaignState, setCampaignState] = useState<LazyState>(idleState);
  const [siteState, setSiteState] = useState<LazyState>(idleState);
  const [activeTab, setActiveTab] = useState(initialTab);

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

  const loadCampaigns = useCallback(async () => {
    if (campaignState.loading) return;
    setCampaignState({ loading: true, error: null });
    try {
      setCampaigns(await loadDeveloperCampaignWorkspace());
      setCampaignState(idleState);
    } catch (error) {
      setCampaignState({ loading: false, error: error instanceof Error ? error.message : 'Unable to load campaigns.' });
    }
  }, [campaignState.loading]);

  const loadSite = useCallback(async () => {
    if (siteState.loading) return;
    setSiteState({ loading: true, error: null });
    try {
      setSite(await loadDeveloperSiteWorkspace());
      setSiteState(idleState);
    } catch (error) {
      setSiteState({ loading: false, error: error instanceof Error ? error.message : 'Unable to load site proposals.' });
    }
  }, [siteState.loading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if ((activeTab === 'campaigns' || activeTab === 'campaign-media') && !campaigns && !campaignState.loading && !campaignState.error) void loadCampaigns();
    if (activeTab === 'site' && !site && !siteState.loading && !siteState.error) void loadSite();
  }, [activeTab, campaigns, campaignState, loadCampaigns, site, siteState, loadSite]);

  if (loading && !cockpit) {
    return <CockpitMessage title="Opening the cockpit" body="Loading your contribution access and workspace direction…" />;
  }
  if (!cockpit) {
    return (
      <CockpitMessage
        title="Developer cockpit unavailable"
        body={loadError ?? 'Sign in with an approved developer or owner account.'}
        action={(
          <div className="flex gap-3">
            <Button onClick={() => void load()}>Retry</Button>
            <Button asChild variant="outline"><Link href="/developer">Developer program</Link></Button>
          </div>
        )}
      />
    );
  }

  const visibleTabs = cockpitTabs.filter((tab) => !tab.ownerOnly || cockpit.isOwner);
  const refreshCurrent = async () => {
    await load();
    if (activeTab === 'campaigns' || activeTab === 'campaign-media') await loadCampaigns();
    if (activeTab === 'site') await loadSite();
  };

  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <section className="mx-auto max-w-7xl space-y-4 px-4 py-5 md:px-6">
        <CardForgeSurface as="header" className="border-[var(--cf-border-strong)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent-strong)]">Developer cockpit</p>
              <h1 className="mt-2 font-serif text-3xl text-[var(--cf-text-strong)] md:text-4xl">Build, review, and ship contributions.</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">Turn development work into reviewed assets, production-ready campaign packages, and deliberate site improvements.</p>
            </div>
            <div className="flex items-center gap-2">
              <CardForgeStatusBadge tone={cockpit.configured ? 'success' : 'warning'}>
                {cockpit.configured ? 'Workspace ready' : 'Setup required'}
              </CardForgeStatusBadge>
              <Button type="button" className="min-h-11" size="sm" variant="outline" onClick={() => void refreshCurrent()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>
          {loadError ? <p role="alert" className="mt-3 border border-[var(--cf-danger-border)] bg-[#1b0d09] p-3 text-sm text-[var(--cf-danger)]">{loadError}</p> : null}
          {!cockpit.extendedContributionsEnabled ? <p className="mt-3 border border-[var(--cf-warning-border)] bg-[#1b1209] p-3 text-sm leading-6 text-[var(--cf-warning)]">Extended contributor lanes are release-gated. Owners can inspect and test them, but developer campaign/site scopes stay inactive until the updated contribution terms and privacy disclosure are published and the server flag is enabled.</p> : null}
        </CardForgeSurface>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardForgeWorkspaceNavigation
            value={activeTab}
            onValueChange={setActiveTab}
            options={visibleTabs}
            label="Cockpit section"
          />

          <TabsContent value="overview" className="mt-3 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <WorkspaceCard icon={Megaphone} label="Campaign workspace" help="Draft, review, and track campaign packages only when you open this lane." onOpen={() => setActiveTab('campaigns')} />
              <WorkspaceCard icon={FileCheck2} label="Site proposals" help="Load live copy and proposal history only when you are working on site changes." onOpen={() => setActiveTab('site')} />
              <WorkspaceCard icon={Boxes} label="Asset contributions" help="Open the shared library pipeline without loading marketing or site data." onOpen={() => setActiveTab('library')} />
            </div>
            <section className="grid gap-3 lg:grid-cols-2">
              <CardForgeSurface as="article" className="p-5">
                <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Boxes className="h-5 w-5" /><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">What you can contribute</h2></div>
                <div className="mt-4 flex flex-wrap gap-2">{cockpit.scopes.map((scope) => <span key={scope} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-3 py-2 text-xs text-[var(--cf-text-muted)]">{DEVELOPER_CONTRIBUTION_SCOPE_LABELS[scope]}</span>)}</div>
              </CardForgeSurface>
              <CardForgeSurface as="article" className="p-5">
                <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Target className="h-5 w-5" /><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">Marketing direction</h2></div>
                <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">Primary market: {cockpit.marketingStrategy.primaryAudience.replaceAll('-', ' ')}. Current offer: {cockpit.marketingStrategy.offer}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--cf-text-subtle)]">The owner controls publishing connections and schedules. Contributors prepare truthful, reviewable content—not provider credentials.</p>
              </CardForgeSurface>
            </section>
          </TabsContent>

          <TabsContent value="library" className="mt-3"><DeveloperAssetHubPanel compact initialSubmissionId={initialSubmissionId} /></TabsContent>
          <TabsContent value="campaigns" className="mt-3">
            {campaigns ? <DeveloperCampaignPanel cockpit={campaigns} onRefresh={loadCampaigns} /> : (
              <CardForgeWorkspaceState
                state={campaignState.error ? 'error' : campaignState.loading ? 'loading' : 'idle'}
                message={campaignState.error ?? (campaignState.loading ? 'Loading campaign workspace…' : 'Open campaign workspace to load it.')}
                onRetry={() => void loadCampaigns()}
              />
            )}
          </TabsContent>
          {cockpit.isOwner ? (
            <TabsContent value="campaign-media" className="mt-3">
              {campaigns ? <DeveloperCampaignMediaLibrary media={campaigns.campaignMedia} pageInfo={campaigns.campaignMediaPage} summary={campaigns.campaignMediaSummary} onRefresh={loadCampaigns} /> : (
                <CardForgeWorkspaceState
                  state={campaignState.error ? 'error' : campaignState.loading ? 'loading' : 'idle'}
                  message={campaignState.error ?? (campaignState.loading ? 'Loading campaign media…' : 'Open campaign media to load it.')}
                  onRetry={() => void loadCampaigns()}
                />
              )}
            </TabsContent>
          ) : null}
          <TabsContent value="site" className="mt-3">
            {site ? <DeveloperSiteProposalPanel cockpit={site} onChange={setSite} /> : (
              <CardForgeWorkspaceState
                state={siteState.error ? 'error' : siteState.loading ? 'loading' : 'idle'}
                message={siteState.error ?? (siteState.loading ? 'Loading site proposals…' : 'Open site proposals to load them.')}
                onRetry={() => void loadSite()}
              />
            )}
          </TabsContent>
          <TabsContent value="standards" className="mt-3">
            <CardForgeSurface as="section" className="p-5">
              <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><BookOpenCheck className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Contribution guidelines</h2></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">{standards.map((standard) => <p key={standard} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4 text-sm leading-6 text-[var(--cf-text-muted)]">{standard}</p>)}</div>
            </CardForgeSurface>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

function WorkspaceCard({ icon: Icon, label, help, onOpen }: { icon: typeof Megaphone; label: string; help: string; onOpen: () => void }) {
  return (
    <button type="button" className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4 text-left transition-colors hover:border-[var(--cf-accent)] hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-accent-strong)]" onClick={onOpen} aria-label={`Open ${label.toLowerCase()}`}>
      <div className="flex items-center justify-between gap-3"><span className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{label}</span><Icon className="h-4 w-4 text-[var(--cf-accent-strong)]" /></div>
      <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">{help}</p>
    </button>
  );
}

function CockpitMessage({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
      <CardForgeSurface as="section" className="mx-auto max-w-3xl border-[var(--cf-border-strong)] p-6">
        <h1 className="font-serif text-3xl text-[var(--cf-text-strong)]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardForgeSurface>
    </main>
  );
}
