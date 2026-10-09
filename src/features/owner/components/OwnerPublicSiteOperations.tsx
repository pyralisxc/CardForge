"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CardForgeSectionIntro, CardForgeWorkspaceState } from '@/components/ui/cardforge-presentation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OwnerOperationsPayload, OwnerSiteControlPayload } from '@/features/owner/lib/ownerOperations';
import { loadOwnerSiteControls } from '@/features/owner/model/ownerOperationsClient';

const panelFallback = () => <CardForgeWorkspaceState state="loading" message="Loading public-site controls…" />;
const OwnerReadinessPanel = dynamic(() => import('./OwnerReadinessPanel').then((module) => module.OwnerReadinessPanel), { loading: panelFallback });
const OwnerSiteConfigurationPanel = dynamic(() => import('./OwnerSiteConfigurationPanel').then((module) => module.OwnerSiteConfigurationPanel), { loading: panelFallback });
const OwnerFounderProfilePanel = dynamic(() => import('./OwnerFounderProfilePanel').then((module) => module.OwnerFounderProfilePanel), { loading: panelFallback });
const OwnerExperienceControlsPanel = dynamic(() => import('@/features/experience-settings/client/owner').then((module) => module.OwnerExperienceControlsPanel), { loading: panelFallback });

const subtabClassName = 'rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-raised)] data-[state=active]:text-[var(--cf-accent-text)]';
const subtabListClassName = 'flex h-auto flex-wrap justify-start rounded-none border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-1';

/**
 * The one protected site-controls read is intentionally fresh on opening the
 * drawer. It replaces the unrelated Owner overview + site fetch chain.
 */
export function OwnerPublicSiteOperations() {
  const router = useRouter();
  const [siteOperations, setSiteOperations] = useState<OwnerSiteControlPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const [workspace, setWorkspace] = useState('pages');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    void loadOwnerSiteControls().then((site) => {
      if (active) setSiteOperations(site);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load current site settings.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [loadGeneration]);

  const updateOperations = useCallback((next: OwnerOperationsPayload) => {
    setSiteOperations(next);
    router.refresh();
  }, [router]);

  if (!siteOperations || isLoading || loadError) {
    return <CardForgeWorkspaceState
      state={loadError ? 'error' : 'loading'}
      message={loadError ?? 'Loading current Owner site settings…'}
      onRetry={loadError ? () => setLoadGeneration((generation) => generation + 1) : undefined}
      retryLabel="Retry site settings"
    />;
  }

  return <section className="space-y-4">
    <CardForgeSectionIntro eyebrow="Site settings" title="Controls beyond the page" body="Edit visible content on the page itself. These native settings only manage the values you cannot select in the rendered page." />
    <Tabs value={workspace} onValueChange={setWorkspace} className="space-y-4">
      <TabsList className={subtabListClassName}>
        <TabsTrigger value="identity" className={subtabClassName}>Brand &amp; Identity</TabsTrigger>
        <TabsTrigger value="pages" className={subtabClassName}>Pages &amp; SEO</TabsTrigger>
        <TabsTrigger value="experience" className={subtabClassName}>Experience &amp; Access</TabsTrigger>
      </TabsList>
      <TabsContent value="identity" className="mt-0 space-y-4"><OwnerReadinessPanel view="identity" operationsPayload={{ businessIdentity: siteOperations.businessIdentity, roadmapItems: siteOperations.roadmapItems, databaseMetrics: null }} onOperationsChange={updateOperations} /><OwnerFounderProfilePanel operationsPayload={siteOperations} onOperationsChange={updateOperations} /></TabsContent>
      <TabsContent value="pages" className="mt-0"><OwnerSiteConfigurationPanel settings={siteOperations.siteConfiguration} onSettingsChange={(siteConfiguration) => {
        setSiteOperations((current) => current ? { ...current, siteConfiguration } : current);
        router.refresh();
      }} /></TabsContent>
      <TabsContent value="experience" className="mt-0"><OwnerExperienceControlsPanel settings={siteOperations.experienceSettings} onSettingsChange={(experienceSettings) => {
        setSiteOperations((current) => current ? { ...current, experienceSettings } : current);
        router.refresh();
      }} /></TabsContent>
    </Tabs>
  </section>;
}
