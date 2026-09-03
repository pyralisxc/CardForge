"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  CardForgeSectionIntro,
  CardForgeSurface,
  CardForgeWorkspaceNavigation,
  CardForgeWorkspaceState,
} from '@/components/ui/cardforge-presentation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OwnerOperationsSummary } from '@/features/owner/components/OwnerOperationsSummary';
import { useOwnerOperations } from '@/features/owner/hooks/useOwnerOperations';

const panelFallback = () => <CardForgeWorkspaceState state="loading" message="Loading this workspace…" />;
const OwnerReadinessPanel = dynamic(() => import('./OwnerReadinessPanel').then((module) => module.OwnerReadinessPanel), { loading: panelFallback });
const OwnerConnectedServicesPanel = dynamic(() => import('./OwnerConnectedServicesPanel').then((module) => module.OwnerConnectedServicesPanel), { loading: panelFallback });
const OwnerPeoplePanel = dynamic(() => import('./OwnerPeoplePanel').then((module) => module.OwnerPeoplePanel), { loading: panelFallback });
const OwnerInboxPanel = dynamic(() => import('./OwnerInboxPanel').then((module) => module.OwnerInboxPanel), { loading: panelFallback });
const OwnerLegalPanel = dynamic(() => import('./OwnerLegalPanel').then((module) => module.OwnerLegalPanel), { loading: panelFallback });
const OwnerAnalyticsPanel = dynamic(() => import('@/features/analytics/client/owner').then((module) => module.OwnerAnalyticsPanel), { loading: panelFallback });
const OwnerBillingPanel = dynamic(() => import('@/features/billing/client/owner').then((module) => module.OwnerBillingPanel), { loading: panelFallback });
const OwnerMcpUsagePanel = dynamic(() => import('@/features/mcp-usage/client/owner').then((module) => module.OwnerMcpUsagePanel), { loading: panelFallback });
const OwnerRolesPanel = dynamic(() => import('./OwnerGovernancePanels').then((module) => module.OwnerRolesPanel), { loading: panelFallback });
const OwnerActivityPanel = dynamic(() => import('./OwnerGovernancePanels').then((module) => module.OwnerActivityPanel), { loading: panelFallback });
const OwnerRetentionPanel = dynamic(() => import('./OwnerGovernancePanels').then((module) => module.OwnerRetentionPanel), { loading: panelFallback });

export type OwnerWorkspace = 'overview' | 'audience' | 'governance';

interface OwnerProfileOperationsProps {
  initialWorkspace?: OwnerWorkspace;
}

const ownerWorkspaces = [
  { value: 'overview', label: 'Overview' },
  { value: 'audience', label: 'Growth & People' },
  { value: 'governance', label: 'Governance' },
] as const;

const subtabClassName = 'rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-raised)] data-[state=active]:text-[var(--cf-accent-text)]';
const subtabListClassName = 'flex h-auto flex-wrap justify-start rounded-none border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-1';

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

export function OwnerProfileOperations({ initialWorkspace = 'overview' }: OwnerProfileOperationsProps) {
  const router = useRouter();
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
  } = useOwnerOperations();
  const [workspace, setWorkspace] = useState<OwnerWorkspace>(initialWorkspace);
  useEffect(() => {
    if (workspace === 'governance' && !siteConsole && !isLoadingSite && !siteLoadError) {
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
          <OwnerOperationsSummary payload={payload} />
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
                <TabsContent value="actions" className="mt-0"><OwnerReadinessPanel view="roadmap" compactRoadmap consolePayload={payload.overview} onConsoleChange={updateConsole} onOpenRoadmap={() => router.push('/roadmap')} /></TabsContent>
                <TabsContent value="integrations" className="mt-0"><OwnerConnectedServicesPanel services={payload.integrationStatus.connectedServices} /></TabsContent>
                <TabsContent value="health" className="mt-0"><OwnerReadinessPanel view="health" consolePayload={payload.overview} onConsoleChange={updateConsole} /></TabsContent>
              </Tabs>
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
