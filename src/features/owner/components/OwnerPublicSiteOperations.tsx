"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import {
  CardForgeSectionIntro,
  CardForgeStatusBadge,
  CardForgeSurface,
  CardForgeWorkspaceState,
} from '@/components/ui/cardforge-presentation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOwnerOperations } from '@/features/owner/hooks/useOwnerOperations';

const panelFallback = () => <CardForgeWorkspaceState state="loading" message="Loading public-site operations…" />;
const OwnerReadinessPanel = dynamic(() => import('./OwnerReadinessPanel').then((module) => module.OwnerReadinessPanel), { loading: panelFallback });
const OwnerSiteConfigurationPanel = dynamic(() => import('./OwnerSiteConfigurationPanel').then((module) => module.OwnerSiteConfigurationPanel), { loading: panelFallback });
const OwnerFounderProfilePanel = dynamic(() => import('./OwnerFounderProfilePanel').then((module) => module.OwnerFounderProfilePanel), { loading: panelFallback });
const OwnerExperienceControlsPanel = dynamic(() => import('@/features/experience-settings/client/owner').then((module) => module.OwnerExperienceControlsPanel), { loading: panelFallback });

const subtabClassName = 'rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-raised)] data-[state=active]:text-[var(--cf-accent-text)]';
const subtabListClassName = 'flex h-auto flex-wrap justify-start rounded-none border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-1';

const siteControlOwnership = [
  ['Launch experience', 'Owner controlled', 'Analytics consent presentation, presentation profile, announcements, and offer visibility change without a deployment.'],
  ['Pages and navigation', 'Owner controlled', 'Approved navigation labels, visibility, order, homepage sections, primary action, and homepage search/share metadata publish here.'],
  ['Public messaging', 'Context controlled', 'Rendered copy is edited directly on each native public page.'],
  ['Brand and site media', 'Context controlled', 'Relevant media publishes and restores on the homepage or founder surface.'],
  ['Founder and roadmap', 'Context controlled', 'Founder presence lives here; Roadmap economics, voting rules, and checkpoints live on Roadmap.'],
  ['Legal publications', 'Governance controlled', 'Versioned policies publish from Profile governance while immutable publication history remains intact.'],
  ['Product behavior', 'Code owned', 'Allowed routes, components, validation, permissions, and capability claims remain reviewed code.'],
  ['Providers and secrets', 'Provider owned', 'Credentials and service configuration remain in their native provider dashboards.'],
] as const;

export function OwnerPublicSiteOperations() {
  const { isLoadingSite, siteLoadError, payload, siteOperations, loadSite, updateOperations } = useOwnerOperations();
  const [workspace, setWorkspace] = useState('identity');

  useEffect(() => {
    if (payload && !siteOperations && !isLoadingSite && !siteLoadError) void loadSite();
  }, [isLoadingSite, loadSite, payload, siteOperations, siteLoadError]);

  if (!siteOperations) {
    return <CardForgeWorkspaceState
      state={siteLoadError ? 'error' : 'loading'}
      message={siteLoadError ?? 'Loading public-site operations…'}
      onRetry={siteLoadError ? () => { void loadSite(); } : undefined}
      retryLabel="Retry public-site operations"
    />;
  }

  return <section className="space-y-4">
    <CardForgeSectionIntro eyebrow="Public experience" title="Operate the site from the site itself" body="Page copy and media stay in their rendered context. This homepage workspace owns the small set of site-wide identity, navigation, launch, and access-presentation controls." />
    <CardForgeSurface as="section" tone="inset" className="p-5" aria-labelledby="site-control-map-heading">
      <h3 id="site-control-map-heading" className="font-serif text-xl text-[var(--cf-text-strong)]">Where each public responsibility lives</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {siteControlOwnership.map(([label, owner, description]) => <CardForgeSurface key={label} className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-medium text-[var(--cf-accent-text)]">{label}</h4>
            <CardForgeStatusBadge tone={owner === 'Owner controlled' ? 'success' : 'neutral'} className="px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">{owner}</CardForgeStatusBadge>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--cf-text-subtle)]">{description}</p>
        </CardForgeSurface>)}
      </div>
    </CardForgeSurface>
    <Tabs value={workspace} onValueChange={setWorkspace} className="space-y-4">
      <TabsList className={subtabListClassName}>
        <TabsTrigger value="identity" className={subtabClassName}>Brand &amp; Identity</TabsTrigger>
        <TabsTrigger value="pages" className={subtabClassName}>Pages &amp; SEO</TabsTrigger>
        <TabsTrigger value="experience" className={subtabClassName}>Experience &amp; Access</TabsTrigger>
      </TabsList>
      <TabsContent value="identity" className="mt-0 space-y-4"><OwnerReadinessPanel view="identity" operationsPayload={siteOperations} onOperationsChange={updateOperations} /><OwnerFounderProfilePanel operationsPayload={siteOperations} onOperationsChange={updateOperations} /></TabsContent>
      <TabsContent value="pages" className="mt-0"><OwnerSiteConfigurationPanel settings={siteOperations.siteConfiguration} onSettingsChange={(siteConfiguration) => updateOperations({ ...siteOperations, siteConfiguration })} /></TabsContent>
      <TabsContent value="experience" className="mt-0"><OwnerExperienceControlsPanel settings={siteOperations.experienceSettings} onSettingsChange={(experienceSettings) => updateOperations({ ...siteOperations, experienceSettings })} /></TabsContent>
    </Tabs>
  </section>;
}
