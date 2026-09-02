"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FilePenLine, ImageUp, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PublicSiteConfiguration } from '../model/siteConfiguration';
import type { SiteContentBlock } from '../model/siteContent';
import type { SiteMediaAsset } from '../model/siteMedia';

import { PublicSiteCopyLiveEditor } from './PublicSiteCopyLiveEditor';
import { PublicSiteMediaLiveEditor } from './PublicSiteMediaLiveEditor';

const pageContext = (currentPath: string): {
  label: string;
  contentGroups: SiteContentBlock['group'][];
  mediaGroups: SiteMediaAsset['group'][];
  roadmapMechanics: boolean;
} => {
  if (currentPath === '/plans') return { label: 'Plans', contentGroups: ['plans'], mediaGroups: [], roadmapMechanics: false };
  if (currentPath === '/about') return { label: 'About', contentGroups: ['about'], mediaGroups: [], roadmapMechanics: false };
  if (currentPath === '/cameron') return { label: 'Founder', contentGroups: ['founder'], mediaGroups: ['founder'], roadmapMechanics: false };
  if (currentPath === '/contributors') return { label: 'Contributor Program', contentGroups: ['contributor'], mediaGroups: [], roadmapMechanics: false };
  if (currentPath === '/roadmap') return { label: 'Roadmap', contentGroups: ['roadmap'], mediaGroups: [], roadmapMechanics: true };
  return { label: 'Homepage', contentGroups: ['landing', 'shell', 'sharing'], mediaGroups: ['brand', 'landing', 'showcase'], roadmapMechanics: false };
};

export function PublicSiteOwnerLiveControls({
  currentPath,
  initialBlocks,
  initialMedia,
  initialSiteConfiguration,
  roadmapRulesEditor,
}: {
  currentPath: string;
  initialBlocks: SiteContentBlock[];
  initialMedia: SiteMediaAsset[];
  initialSiteConfiguration: PublicSiteConfiguration;
  roadmapRulesEditor?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [inlineMode, setInlineMode] = useState(false);
  const [focusedSlug, setFocusedSlug] = useState<SiteContentBlock['slug'] | null>(null);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [media, setMedia] = useState(initialMedia);
  const [siteConfiguration, setSiteConfiguration] = useState(initialSiteConfiguration);
  const context = pageContext(currentPath);
  const contextualBlocks = useMemo(() => blocks.filter((block) => context.contentGroups.includes(block.group)), [blocks, context.contentGroups]);
  const contextualMedia = useMemo(() => media.filter((asset) => context.mediaGroups.includes(asset.group)), [context.mediaGroups, media]);
  const hasMedia = contextualMedia.length > 0;
  const defaultTab = contextualBlocks.length ? 'copy' : hasMedia ? 'media' : 'mechanics';

  useEffect(() => {
    if (!inlineMode) return;
    const selectField = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const field = target.closest<HTMLElement>('[data-site-content-slug]');
      const slug = field?.dataset.siteContentSlug as SiteContentBlock['slug'] | undefined;
      if (!slug || !contextualBlocks.some((block) => block.slug === slug)) return;
      event.preventDefault();
      event.stopPropagation();
      setFocusedSlug(slug);
      setOpen(true);
    };
    document.documentElement.dataset.siteInlineEditing = 'true';
    document.addEventListener('click', selectField, true);
    return () => {
      delete document.documentElement.dataset.siteInlineEditing;
      document.removeEventListener('click', selectField, true);
    };
  }, [contextualBlocks, inlineMode]);

  return <>
    <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full border border-[var(--public-brass)] bg-[var(--cf-surface)] p-2 shadow-2xl" data-owner-live-controls>
      <span className="hidden pl-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)] sm:inline">Owner preview</span>
      {contextualBlocks.length ? <Button type="button" size="sm" variant={inlineMode ? 'default' : 'outline'} onClick={() => setInlineMode((value) => !value)}>{inlineMode ? 'Click highlighted copy' : 'Edit rendered copy'}</Button> : null}
      <Button type="button" size="sm" onClick={() => setOpen(true)}><FilePenLine className="mr-2 h-4 w-4" />Edit {context.label}</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-[var(--cf-border-strong)] bg-[var(--cf-canvas)] text-[var(--cf-text)]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit {context.label} in context</DialogTitle>
          <DialogDescription>Only server-confirmed Owners receive these controls. Publishing updates the canonical public owner and keeps the live page as the review context.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="mt-2 space-y-4">
          <TabsList>
            {contextualBlocks.length ? <TabsTrigger value="copy"><FilePenLine className="mr-2 h-4 w-4" />Copy</TabsTrigger> : null}
            {hasMedia ? <TabsTrigger value="media"><ImageUp className="mr-2 h-4 w-4" />Media</TabsTrigger> : null}
            {roadmapRulesEditor ? <TabsTrigger value="mechanics"><Settings2 className="mr-2 h-4 w-4" />Rules</TabsTrigger> : null}
          </TabsList>
          {contextualBlocks.length ? <TabsContent value="copy"><PublicSiteCopyLiveEditor initialBlocks={contextualBlocks} focusSlug={focusedSlug} onBlocksChange={setBlocks} /></TabsContent> : null}
          {hasMedia ? <TabsContent value="media"><PublicSiteMediaLiveEditor initialAssets={contextualMedia} initialSiteConfiguration={siteConfiguration} onAssetsChange={setMedia} onSiteConfigurationChange={setSiteConfiguration} showWatermarkPresentation={context.mediaGroups.includes('brand')} /></TabsContent> : null}
          {roadmapRulesEditor ? <TabsContent value="mechanics">{roadmapRulesEditor}</TabsContent> : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  </>;
}
