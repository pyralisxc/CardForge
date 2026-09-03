"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, FilePenLine, ImageUp, Settings2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PublicSiteConfiguration } from '../model/siteConfiguration';
import type { SiteContentBlock } from '../model/siteContent';
import type { SiteMediaAsset } from '../model/siteMedia';

import { PublicSiteCopyLiveEditor, savePublicSiteContentBlock } from './PublicSiteCopyLiveEditor';
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
  siteOperationsEditor,
}: {
  currentPath: string;
  initialBlocks: SiteContentBlock[];
  initialMedia: SiteMediaAsset[];
  initialSiteConfiguration: PublicSiteConfiguration;
  roadmapRulesEditor?: ReactNode;
  siteOperationsEditor?: ReactNode;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [inlineMode, setInlineMode] = useState(false);
  const [focusedSlug, setFocusedSlug] = useState<SiteContentBlock['slug'] | null>(null);
  const [inlineSlug, setInlineSlug] = useState<SiteContentBlock['slug'] | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const inlineElementRef = useRef<HTMLElement | null>(null);
  const inlineOriginalBodyRef = useRef('');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [media, setMedia] = useState(initialMedia);
  const [siteConfiguration, setSiteConfiguration] = useState(initialSiteConfiguration);
  const context = pageContext(currentPath);
  const contextualBlocks = useMemo(() => blocks.filter((block) => context.contentGroups.includes(block.group)), [blocks, context.contentGroups]);
  const contextualMedia = useMemo(() => media.filter((asset) => context.mediaGroups.includes(asset.group)), [context.mediaGroups, media]);
  const hasMedia = contextualMedia.length > 0;
  const defaultTab = contextualBlocks.length ? 'copy' : hasMedia ? 'media' : siteOperationsEditor ? 'site' : 'mechanics';

  const finishInlineEdit = useCallback((restore: boolean) => {
    const element = inlineElementRef.current;
    if (element) {
      if (restore) element.textContent = inlineOriginalBodyRef.current;
      element.removeAttribute('contenteditable');
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
      element.removeAttribute('data-site-inline-active');
      element.removeAttribute('spellcheck');
    }
    inlineElementRef.current = null;
    inlineOriginalBodyRef.current = '';
    setInlineSlug(null);
  }, []);

  const saveInlineEdit = useCallback(async () => {
    const element = inlineElementRef.current;
    const block = contextualBlocks.find((candidate) => candidate.slug === inlineSlug);
    if (!element || !block || inlineSaving) return;
    const body = (element.innerText || element.textContent || '').trim();
    if (!body) {
      toast({ title: 'Site copy is required', description: 'Cancel the edit to restore the published text.', variant: 'destructive' });
      return;
    }
    if (body.length > block.maxLength) {
      toast({ title: 'Site copy is too long', description: `Use ${block.maxLength} characters or fewer.`, variant: 'destructive' });
      return;
    }
    setInlineSaving(true);
    try {
      const nextBlocks = await savePublicSiteContentBlock({ slug: block.slug, body });
      const saved = nextBlocks.find((candidate) => candidate.slug === block.slug);
      if (saved) element.textContent = saved.body;
      setBlocks(nextBlocks);
      finishInlineEdit(false);
      toast({ title: 'Rendered copy published', description: `${block.label} is live without leaving the page.` });
    } catch (error) {
      toast({ title: 'Site copy not saved', description: error instanceof Error ? error.message : 'Unable to save site copy.', variant: 'destructive' });
    } finally {
      setInlineSaving(false);
    }
  }, [contextualBlocks, finishInlineEdit, inlineSaving, inlineSlug, toast]);

  useEffect(() => {
    if (!inlineMode) {
      finishInlineEdit(true);
      return;
    }
    const selectField = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const field = target.closest<HTMLElement>('[data-site-content-slug]');
      const slug = field?.dataset.siteContentSlug as SiteContentBlock['slug'] | undefined;
      if (!slug || !contextualBlocks.some((block) => block.slug === slug)) return;
      event.preventDefault();
      event.stopPropagation();
      if (inlineElementRef.current && inlineElementRef.current !== field) finishInlineEdit(true);
      const block = contextualBlocks.find((candidate) => candidate.slug === slug)!;
      inlineElementRef.current = field!;
      inlineOriginalBodyRef.current = block.body;
      field!.setAttribute('contenteditable', 'plaintext-only');
      field!.setAttribute('role', 'textbox');
      field!.setAttribute('aria-label', `Edit ${block.label}`);
      field!.setAttribute('data-site-inline-active', 'true');
      field!.setAttribute('spellcheck', 'true');
      field!.focus({ preventScroll: true });
      setFocusedSlug(slug);
      setInlineSlug(slug);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!inlineElementRef.current || event.target !== inlineElementRef.current) return;
      const block = contextualBlocks.find((candidate) => candidate.slug === inlineSlug);
      if (event.key === 'Escape') {
        event.preventDefault();
        finishInlineEdit(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void saveInlineEdit();
      } else if (event.key === 'Enter' && block?.kind === 'short') {
        event.preventDefault();
        void saveInlineEdit();
      }
    };
    document.documentElement.dataset.siteInlineEditing = 'true';
    document.addEventListener('click', selectField, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      delete document.documentElement.dataset.siteInlineEditing;
      document.removeEventListener('click', selectField, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [contextualBlocks, finishInlineEdit, inlineMode, inlineSlug, saveInlineEdit]);

  useEffect(() => () => finishInlineEdit(true), [finishInlineEdit]);

  return <>
    <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full border border-[var(--public-brass)] bg-[var(--cf-surface)] p-2 shadow-2xl" data-owner-live-controls>
      <span className="hidden pl-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)] sm:inline">Owner preview</span>
      {contextualBlocks.length ? <Button type="button" size="sm" variant={inlineMode ? 'default' : 'outline'} onClick={() => setInlineMode((value) => !value)}>{inlineMode ? 'Editing rendered copy' : 'Edit rendered copy'}</Button> : null}
      <Button type="button" size="sm" onClick={() => setOpen(true)}><FilePenLine className="mr-2 h-4 w-4" />Edit {context.label}</Button>
    </div>
    {inlineSlug ? <div className="fixed bottom-20 right-5 z-[71] flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 border border-[var(--public-brass)] bg-[var(--cf-surface)] p-3 shadow-2xl" role="toolbar" aria-label="Inline site copy editor">
      <span className="mr-2 text-sm text-[var(--cf-text-muted)]">Edit the highlighted text, then publish or cancel.</span>
      <Button type="button" size="sm" onClick={() => void saveInlineEdit()} disabled={inlineSaving}><Check className="mr-2 h-4 w-4" />{inlineSaving ? 'Publishing…' : 'Publish'}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => finishInlineEdit(true)} disabled={inlineSaving}><X className="mr-2 h-4 w-4" />Cancel</Button>
    </div> : null}
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
            {siteOperationsEditor ? <TabsTrigger value="site"><Settings2 className="mr-2 h-4 w-4" />Site</TabsTrigger> : null}
          </TabsList>
          {contextualBlocks.length ? <TabsContent value="copy"><PublicSiteCopyLiveEditor initialBlocks={contextualBlocks} focusSlug={focusedSlug} onBlocksChange={setBlocks} /></TabsContent> : null}
          {hasMedia ? <TabsContent value="media"><PublicSiteMediaLiveEditor initialAssets={contextualMedia} initialSiteConfiguration={siteConfiguration} onAssetsChange={setMedia} onSiteConfigurationChange={setSiteConfiguration} showWatermarkPresentation={context.mediaGroups.includes('brand')} /></TabsContent> : null}
          {roadmapRulesEditor ? <TabsContent value="mechanics">{roadmapRulesEditor}</TabsContent> : null}
          {siteOperationsEditor ? <TabsContent value="site">{siteOperationsEditor}</TabsContent> : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  </>;
}
