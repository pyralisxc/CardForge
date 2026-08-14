"use client";

import dynamic from 'next/dynamic';

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
const OwnerOperationsPanel = dynamic(
  () => import('./OwnerOperationsPanel').then((module) => module.OwnerOperationsPanel),
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
  ['Launch experience', 'Owner controlled', 'Portable project access and analytics consent presentation change without a deployment.'],
  ['Public messaging', 'Owner controlled', 'Landing and About hero copy plus the reusable share message publish from this console.'],
  ['Site media', 'Owner controlled', 'Approved public images, crop, focal point, overlays, and accessibility text publish from this console.'],
  ['Founder presence', 'Owner controlled', 'Profile copy, portrait, priorities, and social destinations publish from this console.'],
  ['Roadmap economics', 'Owner controlled', 'Voting, pricing assumptions, reserves, and roadmap presentation rules live here.'],
  ['Product structure', 'Code owned', 'Navigation routes, Studio behavior, SEO structure, and product capability claims stay reviewed with code so the site cannot promise behavior that is not deployed.'],
  ['Providers and secrets', 'Provider owned', 'Clerk, Supabase, Stripe, Resend, Vercel, Google, and PostHog keep their credentials and service configuration in their own dashboards.'],
] as const;

function OwnerSiteControlMap() {
  return (
    <section className="border border-[#5f4526] bg-[#100c08] p-5" aria-labelledby="site-control-map-heading">
      <h3 id="site-control-map-heading" className="font-serif text-xl text-[#fff1c7]">What you can change here</h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[#c7b288]">
        Owner-authored content and launch policy belong in CardForge. Structural product behavior remains code-reviewed, and raw provider configuration stays with the provider.
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

export function OwnerConsolePage() {
  const {
    isLoading,
    isSlowLoad,
    lastOwnerSaveAt,
    loadError,
    payload,
    retry,
    updateConsole,
  } = useOwnerConsole();

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
          <OwnerConsoleSummary payload={payload} lastOwnerSaveAt={lastOwnerSaveAt} />
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
              <TabsTrigger value="overview" className={tabClassName}>Overview</TabsTrigger>
              <TabsTrigger value="audience" className={tabClassName}>Audience &amp; Revenue</TabsTrigger>
              <TabsTrigger value="site" className={tabClassName}>Site Controls</TabsTrigger>
              <TabsTrigger value="library" className={tabClassName}>Library &amp; Contributors</TabsTrigger>
              <TabsTrigger value="governance" className={tabClassName}>Governance</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Health and direction"
                title="See what needs attention before changing anything"
                body="Review service readiness, the current data footprint, business identity, and roadmap execution from one starting point."
              />
              <OwnerConnectedServicesPanel services={payload.integrationStatus.connectedServices} />
              <OwnerReadinessPanel consolePayload={payload.console} onConsoleChange={updateConsole} />
            </TabsContent>
            <TabsContent value="audience" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="People and performance"
                title="Understand who is using CardForge and how access is working"
                body="Analytics explains consented acquisition and product adoption. Accounts and billing manage an individual creator only when support work is needed."
              />
              <Tabs defaultValue="analytics" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1">
                  <TabsTrigger value="analytics" className={subtabClassName}>Analytics</TabsTrigger>
                  <TabsTrigger value="accounts" className={subtabClassName}>Accounts &amp; Billing</TabsTrigger>
                </TabsList>
                <TabsContent value="analytics" className="mt-0"><OwnerAnalyticsPanel publicAppUrl={payload.integrationStatus.site.publicAppUrl} /></TabsContent>
                <TabsContent value="accounts" className="mt-0"><OwnerOperationsPanel payload={payload} /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="site" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Public experience"
                title="Change owner-authored site policy, content, and media"
                body="Use the controls below for truthful launch adjustments. The ownership map keeps product behavior and provider configuration from becoming an unsafe second settings system."
              />
              <OwnerSiteControlMap />
              <Tabs defaultValue="experience" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1">
                  <TabsTrigger value="experience" className={subtabClassName}>Experience</TabsTrigger>
                  <TabsTrigger value="copy" className={subtabClassName}>Public Copy</TabsTrigger>
                  <TabsTrigger value="media" className={subtabClassName}>Media</TabsTrigger>
                  <TabsTrigger value="founder" className={subtabClassName}>Founder Profile</TabsTrigger>
                  <TabsTrigger value="roadmap" className={subtabClassName}>Roadmap Rules</TabsTrigger>
                </TabsList>
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
                <TabsContent value="founder" className="mt-0"><OwnerFounderProfilePanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
                <TabsContent value="roadmap" className="mt-0"><OwnerPublicContentPanel consolePayload={payload.console} mode="mechanics" onConsoleChange={updateConsole} /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="library" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Production assets"
                title="Review the complete asset pipeline and contributor roster"
                body="Published rows feed creator-facing libraries. Voting, candidates, archive, and rejected work remain visible here as CardForge production history."
              />
              <OwnerDeveloperProgramPanel />
            </TabsContent>
            <TabsContent value="governance" className="mt-0 space-y-4">
              <WorkspaceIntroduction
                eyebrow="Policy and configuration"
                title="Publish legal truth without exposing provider secrets"
                body="CardForge owns its legal documents and business wording. Provider credentials remain intentionally outside the application."
              />
              <OwnerLegalPanel consolePayload={payload.console} onConsoleChange={updateConsole} />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </TooltipProvider>
  );
}
