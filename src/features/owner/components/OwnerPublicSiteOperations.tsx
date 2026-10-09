"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import {
  CardForgeSectionIntro,
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

export function OwnerPublicSiteOperations() {
  const { isLoadingSite, siteLoadError, payload, siteOperations, loadSite, updateOperations } = useOwnerOperations();
  const [workspace, setWorkspace] = useState('pages');

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
    <CardForgeSectionIntro eyebrow="Site settings" title="Controls beyond the page" body="Select copy or images directly from Edit page. Use these site-wide controls for navigation, SEO, hidden sections, branding and experience choices that cannot be selected on the page." />
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
