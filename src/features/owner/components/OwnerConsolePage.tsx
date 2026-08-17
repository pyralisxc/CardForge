"use client";

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OwnerConsoleSummary } from '@/features/owner/components/OwnerConsoleSummary';
import { useOwnerConsole } from '@/features/owner/hooks/useOwnerConsole';

const panelFallback = () => <div className="min-h-48 animate-pulse border border-[#5f4526] bg-[#15100a]" />;

const OwnerReadinessPanel = dynamic(
  () => import('./OwnerReadinessPanel').then((module) => module.OwnerReadinessPanel),
  { loading: panelFallback },
);
const OwnerConnectedServicesPanel = dynamic(
  () => import('./OwnerConnectedServicesPanel').then((module) => module.OwnerConnectedServicesPanel),
  { loading: panelFallback },
);
const OwnerPeoplePanel = dynamic(
  () => import('./OwnerPeoplePanel').then((module) => module.OwnerPeoplePanel),
  { loading: panelFallback },
);
const OwnerInboxPanel = dynamic(
  () => import('./OwnerInboxPanel').then((module) => module.OwnerInboxPanel),
  { loading: panelFallback },
);
const OwnerSiteConfigurationPanel = dynamic(
  () => import('./OwnerSiteConfigurationPanel').then((module) => module.OwnerSiteConfigurationPanel),
  { loading: panelFallback },
);
const OwnerMarketingPanel = dynamic(
  () => import('@/features/marketing/client').then((module) => module.OwnerMarketingPanel),
  { loading: panelFallback },
);
const OwnerPublicContentPanel = dynamic(
  () => import('./OwnerPublicContentPanel').then((module) => module.OwnerPublicContentPanel),
  { loading: panelFallback },
);
const OwnerFounderProfilePanel = dynamic(
  () => import('./OwnerFounderProfilePanel').then((module) => module.OwnerFounderProfilePanel),
  { loading: panelFallback },
);
const OwnerSiteMediaPanel = dynamic(
  () => import('./OwnerSiteMediaPanel').then((module) => module.OwnerSiteMediaPanel),
  { loading: panelFallback },
);
const OwnerLegalPanel = dynamic(
  () => import('./OwnerLegalPanel').then((module) => module.OwnerLegalPanel),
  { loading: panelFallback },
);
const OwnerDeveloperProgramPanel = dynamic(
  () => import('@/features/developer-assets/client/owner').then((module) => module.OwnerDeveloperProgramPanel),
  { loading: panelFallback },
);
const OwnerAnalyticsPanel = dynamic(
  () => import('@/features/analytics/client/owner').then((module) => module.OwnerAnalyticsPanel),
  { loading: panelFallback },
);
const OwnerExperienceControlsPanel = dynamic(
  () => import('@/features/experience-settings/client/owner').then((module) => module.OwnerExperienceControlsPanel),
  { loading: panelFallback },
);
const OwnerBillingPanel = dynamic(
  () => import('@/features/billing/client/owner').then((module) => module.OwnerBillingPanel),
  { loading: panelFallback },
);
const OwnerRolesPanel = dynamic(
  () => import('./OwnerGovernancePanels').then((module) => module.OwnerRolesPanel),
  { loading: panelFallback },
);
const OwnerActivityPanel = dynamic(
  () => import('./OwnerGovernancePanels').then((module) => module.OwnerActivityPanel),
  { loading: panelFallback },
);
const OwnerRetentionPanel = dynamic(
  () => import('./OwnerGovernancePanels').then((module) => module.OwnerRetentionPanel),
  { loading: panelFallback },
);

type OwnerWorkspace = 'overview' | 'marketing' | 'audience' | 'site' | 'library' | 'governance';

interface OwnerConsolePageProps {
  initialWorkspace?: OwnerWorkspace;
  initialPipelineStatus?: 'all' | 'submitted';
  initialMarketingNotice?: { kind: 'success' | 'error'; message: string };
}

const tabClassName = "rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]";
const subtabClassName = "rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[#a98a75] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[#ffe7ad]";

function WorkspaceIntroduction({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#15100a] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-2xl text-[#fff1c7]">{title}</h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[#c7b288]">{body}</p>
    </div>
  );
}

const siteControlOwnership = [
  ['Launch experience', 'Owner controlled', 'Portable project access, analytics consent presentation, announcements, and offer visibility change without a deployment.'],
  ['Pages and navigation', 'Owner controlled', 'Approved navigation labels, visibility, order, homepage sections, primary action, and homepage search/share metadata publish here.'],
  ['Public messaging', 'Owner controlled', 'Shared shell, homepage, About, founder, developer-program, roadmap, search, and sharing copy publish from the grouped content catalog.'],
  ['Brand and site media', 'Owner controlled', 'Brand mark, favicon, watermark, default social image, homepage imagery, Studio screenshots, live-example artwork, and founder portrait share one media catalog with restore history.'],
  ['Founder and roadmap', 'Owner controlled', 'Founder presence, social destinations, roadmap economics, voting rules, and current checkpoint status live here.'],
  ['Legal publications', 'Owner controlled', 'Versioned policies can be drafted, published, and rolled back here while immutable publication history remains intact.'],
  ['Product behavior', 'Code owned', 'Allowed routes and components, functional and accessibility labels, Studio behavior, validation, permissions, and capability claims remain reviewed code.'],
  ['Providers and secrets', 'Provider owned', 'Clerk, Supabase, Stripe, Resend, Vercel, Google, and PostHog keep their credentials and service configuration in their own dashboards.'],
] as const;

function OwnerSiteControlMap() {
  return (
    <section className="border border-[#5f4526] bg-[#100c08] p-5" aria-labelledby="site-control-map-heading">
      <h3 id="site-control-map-heading" className="font-serif text-xl text-[#fff1c7]">What you can change here</h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[#c7b288]">
        Owner-authored content, brand assets, and launch policy belong in CardForge. User project uploads stay user-owned, campaign media stays with production history, structural behavior remains code-reviewed, and raw provider configuration stays with the provider.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {siteControlOwnership.map(([label, owner, description]) => (
          <div key={label} className="border border-[#3c2c1b] bg-[#15100a] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium text-[#ffe7ad]">{label}</h4>
              <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${owner === 'Owner controlled' ? 'border-[#5f7f54] text-[#bde3a8]' : 'border-[#5f4526] text-[#c7b288]'}`}>{owner}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#a98a75]">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OwnerConsolePage({
  initialWorkspace = 'overview',
  initialPipelineStatus = 'all',
  initialMarketingNotice,
}: OwnerConsolePageProps) {
  const {
    isLoading,
    isSlowLoad,
    loadError,
    payload,
    retry,
    updateConsole,
  } = useOwnerConsole();
  const [workspace, setWorkspace] = useState<OwnerWorkspace>(initialWorkspace);
  const [siteWorkspace, setSiteWorkspace] = useState('identity');

  if (!payload && isLoading) {
    return (
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
          <div className="border border-[#6d4f2b] bg-[#15100a] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs uppercase tracking-[0.18em] text-[#a98a55]">Owner console</p><h1 className="font-serif text-2xl text-[#fff1c7]">Loading Owner Console</h1></div>
              <div className="h-2 w-32 animate-pulse bg-[#4a3823]" />
            </div>
            {isSlowLoad ? <p className="mt-4 border border-[#8c6436] bg-[#1b1209] p-3 text-sm leading-6 text-[#f0bd75]">This is taking longer than expected. The console should recover automatically.</p> : null}
          </div>
        </section>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
          <div className="border border-[#7d3d32] bg-[#1b0d09] p-6 text-[#ffd0c6]">
            <h1 className="font-serif text-3xl text-[#fff1c7]">Owner console unavailable</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6">{loadError ?? 'Owner access is required. Sign in with the owner account or set trusted owner metadata.'}</p>
            <Button type="button" className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" onClick={retry}>Retry owner console</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <section className="mx-auto max-w-7xl space-y-4 px-5 py-6 md:px-8">
          <OwnerConsoleSummary payload={payload} />
            <Tabs value={workspace} onValueChange={(value) => setWorkspace(value as OwnerWorkspace)} className="space-y-4">
            <label className="grid gap-1 text-xs text-[#c7b288] sm:hidden">Owner workspace<select aria-label="Owner workspace" className="min-h-11 border border-[#5f4526] bg-[#100c08] px-3 text-sm text-[#ffe7ad]" value={workspace} onChange={(event) => setWorkspace(event.target.value as OwnerWorkspace)}><option value="overview">Overview</option><option value="marketing">Marketing</option><option value="audience">Growth &amp; People</option><option value="site">Site Controls</option><option value="library">Studio Library</option><option value="governance">Governance</option></select></label>
            <TabsList className="hidden h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2 sm:flex">
              <TabsTrigger value="overview" className={tabClassName}>Overview</TabsTrigger>
              <TabsTrigger value="marketing" className={tabClassName}>Marketing</TabsTrigger>
              <TabsTrigger value="audience" className={tabClassName}>Growth &amp; People</TabsTrigger>
              <TabsTrigger value="site" className={tabClassName}>Site Controls</TabsTrigger>
              <TabsTrigger value="library" className={tabClassName}>Studio Library</TabsTrigger>
              <TabsTrigger value="governance" className={tabClassName}>Governance</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Operate CardForge"
                title="Start with action, then open the owning workspace"
                body="The overview is a compact operating surface. Integrations report provider truth, health reports CardForge data, and roadmap actions publish through their existing owner."
              />
              <Tabs defaultValue="actions" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1"><TabsTrigger value="actions" className={subtabClassName}>Action center</TabsTrigger><TabsTrigger value="integrations" className={subtabClassName}>Integrations</TabsTrigger><TabsTrigger value="health" className={subtabClassName}>System health</TabsTrigger></TabsList>
                <TabsContent value="actions" className="mt-0"><OwnerReadinessPanel view="roadmap" compactRoadmap consolePayload={payload.console} onConsoleChange={updateConsole} onOpenRoadmap={() => { setWorkspace('site'); setSiteWorkspace('roadmap'); }} /></TabsContent>
                <TabsContent value="integrations" className="mt-0"><OwnerConnectedServicesPanel services={payload.integrationStatus.connectedServices} /></TabsContent>
                <TabsContent value="health" className="mt-0"><OwnerReadinessPanel view="health" consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="marketing" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Strategy through publication"
                title="Run CardForge marketing without exporting the workflow"
                body="Set the market and claims, organize work into campaigns, review developer submissions, route approved content to owned accounts or communities, and preserve publication history in one workspace."
              />
              <OwnerMarketingPanel initialNotice={initialMarketingNotice} />
            </TabsContent>
            <TabsContent value="audience" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Growth, access, and support"
                title="Understand visitors and manage real people in one directory"
                body="Analytics remains consented and aggregated. People joins Clerk identity with CardForge developer authority; Billing and Inbox retain their own operational histories."
              />
              <Tabs defaultValue="analytics" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1">
                  <TabsTrigger value="analytics" className={subtabClassName}>Analytics</TabsTrigger>
                  <TabsTrigger value="people" className={subtabClassName}>People</TabsTrigger>
                  <TabsTrigger value="billing" className={subtabClassName}>Billing</TabsTrigger>
                  <TabsTrigger value="inbox" className={subtabClassName}>Inbox</TabsTrigger>
                </TabsList>
                <TabsContent value="analytics" className="mt-0"><OwnerAnalyticsPanel publicAppUrl={payload.integrationStatus.site.publicAppUrl} /></TabsContent>
                <TabsContent value="people" className="mt-0"><OwnerPeoplePanel currentOwnerId={payload.ownerAccess.userId} /></TabsContent>
                <TabsContent value="billing" className="mt-0"><OwnerBillingPanel /></TabsContent>
                <TabsContent value="inbox" className="mt-0"><OwnerInboxPanel initialRequests={payload.console.contactRequests} /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="site" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Public experience"
                title="Change the safe live values of the public site"
                body="Code allowlists routes, sections, validation, and security. Within that boundary, the owner controls live identity, pages, metadata, copy, media, access presentation, offers, and roadmap behavior."
              />
              <OwnerSiteControlMap />
              <Tabs value={siteWorkspace} onValueChange={setSiteWorkspace} className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1">
                  <TabsTrigger value="identity" className={subtabClassName}>Brand &amp; Identity</TabsTrigger>
                  <TabsTrigger value="pages" className={subtabClassName}>Pages &amp; SEO</TabsTrigger>
                  <TabsTrigger value="copy" className={subtabClassName}>Copy</TabsTrigger>
                  <TabsTrigger value="media" className={subtabClassName}>Media</TabsTrigger>
                  <TabsTrigger value="experience" className={subtabClassName}>Experience &amp; Access</TabsTrigger>
                  <TabsTrigger value="roadmap" className={subtabClassName}>Roadmap</TabsTrigger>
                </TabsList>
                <TabsContent value="identity" className="mt-0 space-y-4"><OwnerReadinessPanel view="identity" consolePayload={payload.console} onConsoleChange={updateConsole} /><OwnerFounderProfilePanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
                <TabsContent value="pages" className="mt-0"><OwnerSiteConfigurationPanel settings={payload.console.siteConfiguration} onSettingsChange={(siteConfiguration) => updateConsole({ ...payload.console, siteConfiguration })} /></TabsContent>
                <TabsContent value="experience" className="mt-0">
                  <OwnerExperienceControlsPanel
                    settings={payload.console.experienceSettings}
                    onSettingsChange={(experienceSettings) => updateConsole({
                      ...payload.console,
                      experienceSettings,
                    })}
                  />
                </TabsContent>
                <TabsContent value="copy" className="mt-0"><OwnerPublicContentPanel consolePayload={payload.console} mode="copy" onConsoleChange={updateConsole} /></TabsContent>
                <TabsContent value="media" className="mt-0"><OwnerSiteMediaPanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
                <TabsContent value="roadmap" className="mt-0 space-y-4"><OwnerReadinessPanel view="roadmap" consolePayload={payload.console} onConsoleChange={updateConsole} /><OwnerPublicContentPanel consolePayload={payload.console} mode="mechanics" onConsoleChange={updateConsole} /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="library" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Reusable Studio resources"
                title="Operate the asset pipeline"
                body="The asset pipeline owns reusable Studio library content, review, voting, revisions, and publication. Marketing submissions and their media now live in the dedicated Marketing workspace."
              />
              <OwnerDeveloperProgramPanel initialStatusFilter={initialPipelineStatus} />
            </TabsContent>
            <TabsContent value="governance" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Authority and record integrity"
                title="Publish legal truth and see what owner actions changed"
                body="Legal publications, permission boundaries, retained history, and destructive controls are explicit here. Provider credentials remain outside CardForge."
              />
              <Tabs defaultValue="legal" className="space-y-4"><TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1"><TabsTrigger value="legal" className={subtabClassName}>Legal</TabsTrigger><TabsTrigger value="roles" className={subtabClassName}>Roles &amp; Permissions</TabsTrigger><TabsTrigger value="history" className={subtabClassName}>Change History</TabsTrigger><TabsTrigger value="retention" className={subtabClassName}>Deletion &amp; Retention</TabsTrigger></TabsList><TabsContent value="legal" className="mt-0"><OwnerLegalPanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent><TabsContent value="roles" className="mt-0"><OwnerRolesPanel /></TabsContent><TabsContent value="history" className="mt-0"><OwnerActivityPanel /></TabsContent><TabsContent value="retention" className="mt-0"><OwnerRetentionPanel /></TabsContent></Tabs>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </TooltipProvider>
  );
}
