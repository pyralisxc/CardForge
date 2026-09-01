"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import {
  CardForgeSectionIntro,
  CardForgeStatusBadge,
  CardForgeSurface,
  CardForgeWorkspaceNavigation,
  CardForgeWorkspaceState,
} from '@/components/ui/cardforge-presentation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OwnerConsoleSummary } from '@/features/owner/components/OwnerConsoleSummary';
import { useOwnerConsole } from '@/features/owner/hooks/useOwnerConsole';

const panelFallback = () => <CardForgeWorkspaceState state="loading" message="Loading this workspace…" />;
const OwnerReadinessPanel = dynamic(() => import('./OwnerReadinessPanel').then((module) => module.OwnerReadinessPanel), { loading: panelFallback });
const OwnerConnectedServicesPanel = dynamic(() => import('./OwnerConnectedServicesPanel').then((module) => module.OwnerConnectedServicesPanel), { loading: panelFallback });
const OwnerPeoplePanel = dynamic(() => import('./OwnerPeoplePanel').then((module) => module.OwnerPeoplePanel), { loading: panelFallback });
const OwnerInboxPanel = dynamic(() => import('./OwnerInboxPanel').then((module) => module.OwnerInboxPanel), { loading: panelFallback });
const OwnerSiteConfigurationPanel = dynamic(() => import('./OwnerSiteConfigurationPanel').then((module) => module.OwnerSiteConfigurationPanel), { loading: panelFallback });
const OwnerMarketingPanel = dynamic(() => import('@/features/marketing/client').then((module) => module.OwnerMarketingPanel), { loading: panelFallback });
const OwnerFounderProfilePanel = dynamic(() => import('./OwnerFounderProfilePanel').then((module) => module.OwnerFounderProfilePanel), { loading: panelFallback });
const OwnerLegalPanel = dynamic(() => import('./OwnerLegalPanel').then((module) => module.OwnerLegalPanel), { loading: panelFallback });
const OwnerContributorProgramPanel = dynamic(() => import('@/features/pipeline/client/owner').then((module) => module.OwnerContributorProgramPanel), { loading: panelFallback });
const OwnerAnalyticsPanel = dynamic(() => import('@/features/analytics/client/owner').then((module) => module.OwnerAnalyticsPanel), { loading: panelFallback });
const OwnerExperienceControlsPanel = dynamic(() => import('@/features/experience-settings/client/owner').then((module) => module.OwnerExperienceControlsPanel), { loading: panelFallback });
const OwnerBillingPanel = dynamic(() => import('@/features/billing/client/owner').then((module) => module.OwnerBillingPanel), { loading: panelFallback });
const OwnerMcpUsagePanel = dynamic(() => import('@/features/mcp-usage/client/owner').then((module) => module.OwnerMcpUsagePanel), { loading: panelFallback });
const OwnerRolesPanel = dynamic(() => import('./OwnerGovernancePanels').then((module) => module.OwnerRolesPanel), { loading: panelFallback });
const OwnerActivityPanel = dynamic(() => import('./OwnerGovernancePanels').then((module) => module.OwnerActivityPanel), { loading: panelFallback });
const OwnerRetentionPanel = dynamic(() => import('./OwnerGovernancePanels').then((module) => module.OwnerRetentionPanel), { loading: panelFallback });

export type OwnerWorkspace = 'overview' | 'marketing' | 'audience' | 'site' | 'library' | 'governance';

interface OwnerProfileOperationsProps {
  initialWorkspace?: OwnerWorkspace;
  initialPipelineStatus?: 'all' | 'submitted';
  initialMarketingNotice?: { kind: 'success' | 'error'; message: string };
}

const ownerWorkspaces = [
  { value: 'overview', label: 'Overview' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'audience', label: 'Growth & People' },
  { value: 'site', label: 'Site Controls' },
  { value: 'library', label: 'Studio Library' },
  { value: 'governance', label: 'Governance' },
] as const;

const subtabClassName = 'rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-raised)] data-[state=active]:text-[var(--cf-accent-text)]';
const subtabListClassName = 'flex h-auto flex-wrap justify-start rounded-none border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-1';

const siteControlOwnership = [
  ['Launch experience', 'Owner controlled', 'Portable project access, analytics consent presentation, presentation profile, announcements, and offer visibility change without a deployment.'],
  ['Pages and navigation', 'Owner controlled', 'Approved navigation labels, visibility, order, homepage sections, primary action, and homepage search/share metadata publish here.'],
  ['Public messaging', 'Owner controlled', 'Copy publishes from contextual Owner controls on each native public page; Profile no longer hosts a detached copy editor.'],
  ['Brand and site media', 'Owner controlled', 'Relevant media publishes and restores in context on the homepage or founder surface while retaining the canonical media catalog.'],
  ['Founder and roadmap', 'Owner controlled', 'Founder presence, social destinations, roadmap economics, voting rules, and current checkpoint status live here.'],
  ['Legal publications', 'Owner controlled', 'Versioned policies can be drafted, published, and rolled back here while immutable publication history remains intact.'],
  ['Product behavior', 'Code owned', 'Allowed routes and components, functional and accessibility labels, Studio behavior, validation, permissions, and capability claims remain reviewed code.'],
  ['Providers and secrets', 'Provider owned', 'Clerk, Supabase, Stripe, Resend, Vercel, Google, and PostHog keep their credentials and service configuration in their own dashboards.'],
] as const;

function OwnerSiteControlMap() {
  return (
    <CardForgeSurface as="section" tone="inset" className="p-5" aria-labelledby="site-control-map-heading">
      <h3 id="site-control-map-heading" className="font-serif text-xl text-[var(--cf-text-strong)]">What you can change here</h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">
        Owner-authored content, validated presentation, brand assets, and launch policy belong in CardForge. User project uploads stay user-owned, campaign media stays with production history, structural behavior remains code-reviewed, and raw provider configuration stays with the provider.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {siteControlOwnership.map(([label, owner, description]) => (
          <CardForgeSurface key={label} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium text-[var(--cf-accent-text)]">{label}</h4>
              <CardForgeStatusBadge tone={owner === 'Owner controlled' ? 'success' : 'neutral'} className="px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                {owner}
              </CardForgeStatusBadge>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--cf-text-subtle)]">{description}</p>
          </CardForgeSurface>
        ))}
      </div>
    </CardForgeSurface>
  );
}

function SiteWorkspaceState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  return (
    <CardForgeWorkspaceState
      state={error ? 'error' : loading ? 'loading' : 'idle'}
      message={error ?? (loading ? 'Loading this workspace…' : 'Open this workspace to load its data.')}
      onRetry={error ? retry : undefined}
      retryLabel="Retry workspace"
    />
  );
}

export function OwnerProfileOperations({ initialWorkspace = 'overview', initialPipelineStatus = 'all', initialMarketingNotice }: OwnerProfileOperationsProps) {
  const {
    isLoading,
    isLoadingSite,
    isSlow,
    loadError,
    siteLoadError,
    payload,
    siteConsole,
    load,
    loadSite,
    updateConsole,
  } = useOwnerConsole();
  const [workspace, setWorkspace] = useState<OwnerWorkspace>(initialWorkspace);
  const [siteWorkspace, setSiteWorkspace] = useState('identity');

  useEffect(() => {
    if ((workspace === 'site' || workspace === 'governance') && !siteConsole && !isLoadingSite && !siteLoadError) {
      void loadSite();
    }
  }, [workspace, siteConsole, isLoadingSite, siteLoadError, loadSite]);

  if (!payload && isLoading) {
    return (
      <div className="text-[var(--cf-text)]">
        <section>
          <CardForgeSurface className="border-[var(--cf-border-strong)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--cf-text-subtle)]">Profile utility</p>
                <h1 className="font-serif text-2xl text-[var(--cf-text-strong)]">Loading owner operations</h1>
              </div>
              <div className="h-2 w-32 animate-pulse bg-[var(--cf-border-subtle)]" />
            </div>
            {isSlow ? <p className="mt-4 border border-[var(--cf-warning-border)] bg-[var(--cf-surface-raised)] p-3 text-sm leading-6 text-[var(--cf-warning)]">This is taking longer than expected. The console should recover automatically.</p> : null}
          </CardForgeSurface>
        </section>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="text-[var(--cf-text)]">
        <section>
          <CardForgeWorkspaceState
            state="error"
            message={loadError ?? 'Owner access is required. Sign in with the owner account or set trusted owner metadata.'}
            onRetry={() => void load()}
            retryLabel="Retry owner operations"
            className="min-h-0 p-6"
          />
        </section>
      </div>
    );
  }

  const siteWorkspaceContent = siteConsole ?? null;
  const ensureSite = () => { void loadSite(); };

  return (
    <TooltipProvider>
      <div className="text-[var(--cf-text)]">
        <section className="space-y-4">
          <OwnerConsoleSummary payload={payload} />
          <Tabs value={workspace} onValueChange={(value) => setWorkspace(value as OwnerWorkspace)} className="space-y-4">
            <CardForgeWorkspaceNavigation
              value={workspace}
              onValueChange={(value) => setWorkspace(value as OwnerWorkspace)}
              options={ownerWorkspaces}
              label="Owner workspace"
            />

            <TabsContent value="overview" className="mt-0 space-y-4">
              <CardForgeSectionIntro eyebrow="Operate CardForge" title="Start with action, then open the owning workspace" body="The overview is a compact operating surface. Integrations report provider truth, health reports CardForge data, and roadmap actions publish through their existing owner." />
              <Tabs defaultValue="actions" className="space-y-4">
                <TabsList className={subtabListClassName}>
                  <TabsTrigger value="actions" className={subtabClassName}>Action center</TabsTrigger>
                  <TabsTrigger value="integrations" className={subtabClassName}>Integrations</TabsTrigger>
                  <TabsTrigger value="health" className={subtabClassName}>System health</TabsTrigger>
                </TabsList>
                <TabsContent value="actions" className="mt-0"><OwnerReadinessPanel view="roadmap" compactRoadmap consolePayload={payload.overview} onConsoleChange={updateConsole} onOpenRoadmap={() => { setWorkspace('site'); setSiteWorkspace('roadmap'); }} /></TabsContent>
                <TabsContent value="integrations" className="mt-0"><OwnerConnectedServicesPanel services={payload.integrationStatus.connectedServices} /></TabsContent>
                <TabsContent value="health" className="mt-0"><OwnerReadinessPanel view="health" consolePayload={payload.overview} onConsoleChange={updateConsole} /></TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="marketing" className="mt-0 space-y-4">
              <CardForgeSectionIntro eyebrow="Strategy through publication" title="Run CardForge marketing without exporting the workflow" body="Set the market and claims, organize work into campaigns, review contributor submissions, route approved content to owned accounts or communities, and preserve publication history in one workspace." />
              <OwnerMarketingPanel initialNotice={initialMarketingNotice} />
            </TabsContent>

            <TabsContent value="audience" className="mt-0 space-y-4">
              <CardForgeSectionIntro eyebrow="Growth, access, and support" title="Understand visitors and manage real people in one directory" body="Analytics remains consented and aggregated. People joins Clerk identity with CardForge contributor authority; Billing, plan targets, usage, and Inbox retain their own operational histories." />
              <Tabs defaultValue="analytics" className="space-y-4">
                <TabsList className={subtabListClassName}>
                  <TabsTrigger value="analytics" className={subtabClassName}>Analytics</TabsTrigger>
                  <TabsTrigger value="people" className={subtabClassName}>People</TabsTrigger>
                  <TabsTrigger value="billing" className={subtabClassName}>Billing</TabsTrigger>
                  <TabsTrigger value="plans" className={subtabClassName}>Plans &amp; Usage</TabsTrigger>
                  <TabsTrigger value="inbox" className={subtabClassName}>Inbox</TabsTrigger>
                </TabsList>
                <TabsContent value="analytics" className="mt-0"><OwnerAnalyticsPanel publicAppUrl={payload.integrationStatus.site.publicAppUrl} /></TabsContent>
                <TabsContent value="people" className="mt-0"><OwnerPeoplePanel currentOwnerId={payload.ownerAccess.userId} /></TabsContent>
                <TabsContent value="billing" className="mt-0"><OwnerBillingPanel /></TabsContent>
                <TabsContent value="plans" className="mt-0"><OwnerMcpUsagePanel /></TabsContent>
                <TabsContent value="inbox" className="mt-0"><OwnerInboxPanel /></TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="site" className="mt-0 space-y-4">
              <CardForgeSectionIntro eyebrow="Public experience" title="Change protected site policy and identity" body="Code allowlists routes, sections, validation, and security. Profile retains identity, page policy, access presentation, offers, legal publication, and provider-aware operations; copy, media, and roadmap rules now edit in context on their native public surfaces." />
              <OwnerSiteControlMap />
              {siteWorkspaceContent ? (
                <Tabs value={siteWorkspace} onValueChange={setSiteWorkspace} className="space-y-4">
                  <TabsList className={subtabListClassName}>
                    <TabsTrigger value="identity" className={subtabClassName}>Brand &amp; Identity</TabsTrigger>
                    <TabsTrigger value="pages" className={subtabClassName}>Pages &amp; SEO</TabsTrigger>
                    <TabsTrigger value="experience" className={subtabClassName}>Experience &amp; Access</TabsTrigger>
                    <TabsTrigger value="roadmap" className={subtabClassName}>Roadmap</TabsTrigger>
                  </TabsList>
                  <TabsContent value="identity" className="mt-0 space-y-4"><OwnerReadinessPanel view="identity" consolePayload={siteWorkspaceContent} onConsoleChange={updateConsole} /><OwnerFounderProfilePanel consolePayload={siteWorkspaceContent} onConsoleChange={updateConsole} /></TabsContent>
                  <TabsContent value="pages" className="mt-0"><OwnerSiteConfigurationPanel settings={siteWorkspaceContent.siteConfiguration} onSettingsChange={(siteConfiguration) => updateConsole({ ...siteWorkspaceContent, siteConfiguration })} /></TabsContent>
                  <TabsContent value="experience" className="mt-0"><OwnerExperienceControlsPanel settings={siteWorkspaceContent.experienceSettings} onSettingsChange={(experienceSettings) => updateConsole({ ...siteWorkspaceContent, experienceSettings })} /></TabsContent>
                  <TabsContent value="roadmap" className="mt-0 space-y-4"><OwnerReadinessPanel view="roadmap" consolePayload={siteWorkspaceContent} onConsoleChange={updateConsole} /></TabsContent>
                </Tabs>
              ) : <SiteWorkspaceState loading={isLoadingSite} error={siteLoadError} retry={ensureSite} />}
            </TabsContent>

            <TabsContent value="library" className="mt-0 space-y-4">
              <CardForgeSectionIntro eyebrow="Reusable Studio resources" title="Operate the asset pipeline" body="The asset pipeline owns reusable Studio library content, review, voting, revisions, and publication. Marketing submissions and their media now live in the dedicated Marketing workspace." />
              <OwnerContributorProgramPanel initialStatusFilter={initialPipelineStatus} />
            </TabsContent>

            <TabsContent value="governance" className="mt-0 space-y-4">
              <CardForgeSectionIntro eyebrow="Authority and record integrity" title="Publish legal truth and see what owner actions changed" body="Legal publications, permission boundaries, retained history, and destructive controls are explicit here. Provider credentials remain outside CardForge." />
              {siteWorkspaceContent ? (
                <Tabs defaultValue="legal" className="space-y-4">
                  <TabsList className={subtabListClassName}>
                    <TabsTrigger value="legal" className={subtabClassName}>Legal</TabsTrigger>
                    <TabsTrigger value="roles" className={subtabClassName}>Roles &amp; Permissions</TabsTrigger>
                    <TabsTrigger value="history" className={subtabClassName}>Change History</TabsTrigger>
                    <TabsTrigger value="retention" className={subtabClassName}>Deletion &amp; Retention</TabsTrigger>
                  </TabsList>
                  <TabsContent value="legal" className="mt-0"><OwnerLegalPanel consolePayload={siteWorkspaceContent} onConsoleChange={updateConsole} /></TabsContent>
                  <TabsContent value="roles" className="mt-0"><OwnerRolesPanel /></TabsContent>
                  <TabsContent value="history" className="mt-0"><OwnerActivityPanel /></TabsContent>
                  <TabsContent value="retention" className="mt-0"><OwnerRetentionPanel /></TabsContent>
                </Tabs>
              ) : <SiteWorkspaceState loading={isLoadingSite} error={siteLoadError} retry={ensureSite} />}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </TooltipProvider>
  );
}
