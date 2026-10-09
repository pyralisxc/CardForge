"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, FilePenLine, ImageUp, Settings2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PublicSiteConfiguration } from '../model/siteConfiguration';
import type { SiteContentBlock } from '../model/siteContent';
import type { SiteMediaAsset } from '../model/siteMedia';
import {
  getOwnerPublicationPresentation,
  type OwnerPublicationEnvironment,
} from '../model/ownerPublicationEnvironment';

import { PublicSiteCopyLiveEditor, savePublicSiteContentBlock } from './PublicSiteCopyLiveEditor';
import { PublicSiteMediaLiveEditor } from './PublicSiteMediaLiveEditor';

const pageContext = (currentPath: string): {
  label: string;
  contentGroups: SiteContentBlock['group'][];
  mediaGroups: SiteMediaAsset['group'][];
  roadmapMechanics: boolean;
} => {
  if (currentPath === '/plans') return { label: 'Plans', contentGroups: ['plans', 'shell'], mediaGroups: ['brand'], roadmapMechanics: false };
  if (currentPath === '/about') return { label: 'About', contentGroups: ['about', 'shell'], mediaGroups: ['brand'], roadmapMechanics: false };
  if (currentPath === '/cameron') return { label: 'Founder', contentGroups: ['founder', 'shell'], mediaGroups: ['brand', 'founder'], roadmapMechanics: false };
  if (currentPath === '/contributors') return { label: 'Contributor Program', contentGroups: ['contributor', 'shell'], mediaGroups: ['brand'], roadmapMechanics: false };
  if (currentPath === '/roadmap') return { label: 'Roadmap', contentGroups: ['roadmap', 'shell'], mediaGroups: ['brand'], roadmapMechanics: true };
  return { label: 'Homepage', contentGroups: ['landing', 'shell', 'sharing'], mediaGroups: ['brand', 'landing', 'showcase'], roadmapMechanics: false };
};

export function PublicSiteOwnerLiveControls({
  currentPath,
  publicationEnvironment,
  initialBlocks,
  initialMedia,
  initialSiteConfiguration,
  roadmapRulesEditor,
  siteOperationsEditor,
}: {
  currentPath: string;
  publicationEnvironment: OwnerPublicationEnvironment;
  initialBlocks: SiteContentBlock[];
  initialMedia: SiteMediaAsset[];
  initialSiteConfiguration: PublicSiteConfiguration;
  roadmapRulesEditor?: ReactNode;
  siteOperationsEditor?: ReactNode;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const publicationPresentation = useMemo(
    () => getOwnerPublicationPresentation(publicationEnvironment),
    [publicationEnvironment],
  );
  const [open, setOpen] = useState(false);
  const [inlineMode, setInlineMode] = useState(false);
  const [panelTab, setPanelTab] = useState<'copy' | 'media' | 'site' | 'mechanics'>('site');
  const [focusedMediaSlot, setFocusedMediaSlot] = useState<SiteMediaAsset['slot'] | null>(null);
  const [focusCopyOnly, setFocusCopyOnly] = useState(false);
  const [focusedSlug, setFocusedSlug] = useState<SiteContentBlock['slug'] | null>(null);
  const [inlineSlug, setInlineSlug] = useState<SiteContentBlock['slug'] | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const inlineElementRef = useRef<HTMLElement | null>(null);
  const inlineOriginalBodyRef = useRef('');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [media, setMedia] = useState(initialMedia);
  const [siteConfiguration, setSiteConfiguration] = useState(initialSiteConfiguration);
  const context = useMemo(() => pageContext(currentPath), [currentPath]);
  const contextualBlocks = useMemo(() => blocks.filter((block) => context.contentGroups.includes(block.group)), [blocks, context.contentGroups]);
  const contextualMedia = useMemo(() => media.filter((asset) => context.mediaGroups.includes(asset.group)), [context.mediaGroups, media]);
  const hasMedia = contextualMedia.length > 0;
  const defaultTab = siteOperationsEditor ? 'site' : hasMedia ? 'media' : contextualBlocks.length ? 'copy' : 'mechanics';

  // A refreshed server render remains the source of truth after a media publish.
  useEffect(() => { setBlocks(initialBlocks); }, [initialBlocks]);
  useEffect(() => { setMedia(initialMedia); }, [initialMedia]);
  useEffect(() => { setSiteConfiguration(initialSiteConfiguration); }, [initialSiteConfiguration]);

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

  const discardCurrentEdit = useCallback((): boolean => {
    const element = inlineElementRef.current;
    if (element) {
      const currentText = (element.innerText || element.textContent || '').trim();
      if (currentText !== inlineOriginalBodyRef.current.trim()
        && !window.confirm('Discard the unpublished change to this field?')) return false;
    }
    finishInlineEdit(true);
    return true;
  }, [finishInlineEdit]);

  const openPageSettings = useCallback(() => {
    if (!discardCurrentEdit()) return;
    setFocusedMediaSlot(null);
    setFocusCopyOnly(false);
    setFocusedSlug(null);
    setPanelTab(defaultTab);
    setOpen(true);
  }, [defaultTab, discardCurrentEdit]);

  const openSelectedMedia = useCallback((slot: SiteMediaAsset['slot']) => {
    if (!discardCurrentEdit()) return;
    setFocusedMediaSlot(slot);
    setFocusCopyOnly(false);
    setFocusedSlug(null);
    setPanelTab('media');
    setOpen(true);
  }, [discardCurrentEdit]);

  const openStructuredCopy = useCallback((slug: SiteContentBlock['slug']) => {
    if (!discardCurrentEdit()) return;
    setFocusedSlug(slug);
    setFocusCopyOnly(true);
    setFocusedMediaSlot(null);
    setPanelTab('copy');
    setOpen(true);
  }, [discardCurrentEdit]);

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
      const publication = await savePublicSiteContentBlock({
        slug: block.slug,
        body,
        updatedAt: block.updatedAt,
      });
      document.querySelectorAll<HTMLElement>('[data-site-content-slug]').forEach((target) => {
        if (target.dataset.siteContentSlug === publication.siteContentBlock.slug && target.childElementCount === 0) {
          target.textContent = publication.siteContentBlock.body;
        }
      });
      setBlocks((current) => current.map((candidate) => (
        candidate.slug === publication.siteContentBlock.slug
          ? publication.siteContentBlock
          : candidate
      )));
      finishInlineEdit(false);
      toast(publication.receipt.refreshComplete
        ? {
            title: publicationPresentation.publishedTitle,
            description: publication.receipt.activityRecorded
              ? publicationPresentation.publishedDescription(block.label)
              : `${publicationPresentation.publishedDescription(block.label)} Owner activity history could not be recorded.`,
          }
        : {
            title: `${publicationPresentation.publishedTitle}; reload to verify`,
            description: publication.receipt.message,
          });
    } catch (error) {
      toast({ title: 'Site copy not published', description: error instanceof Error ? error.message : 'Unable to publish site copy.', variant: 'destructive' });
    } finally {
      setInlineSaving(false);
    }
  }, [contextualBlocks, finishInlineEdit, inlineSaving, inlineSlug, publicationPresentation, toast]);

  useEffect(() => {
    if (!inlineMode) {
      finishInlineEdit(true);
      return;
    }
    const selectField = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-owner-site-editor-panel], [data-owner-live-controls]')) return;

      const field = target.closest<HTMLElement>('[data-site-content-slug]');
      const slug = field?.dataset.siteContentSlug as SiteContentBlock['slug'] | undefined;
      const block = slug ? contextualBlocks.find((candidate) => candidate.slug === slug) : undefined;
      if (field && block) {
        event.preventDefault();
        event.stopPropagation();
        if (inlineSaving) return;
        // Never content-edit a composed link or a field that contains markup.
        // It remains selectable, but uses the same small Owner copy editor.
        if (field.childElementCount > 0) {
          openStructuredCopy(block.slug);
          return;
        }
        if (inlineElementRef.current === field) return; // Preserve the active draft on a second click.
        if (!discardCurrentEdit()) return;
        inlineElementRef.current = field;
        inlineOriginalBodyRef.current = block.body;
        field.setAttribute('contenteditable', 'plaintext-only');
        field.setAttribute('role', 'textbox');
        field.setAttribute('aria-label', `Edit ${block.label}`);
        field.setAttribute('data-site-inline-active', 'true');
        field.setAttribute('spellcheck', 'true');
        field.focus({ preventScroll: true });
        setFocusedSlug(block.slug);
        setInlineSlug(block.slug);
        return;
      }

      const image = target.closest<HTMLElement>('[data-site-media-slot]');
      const slot = image?.dataset.siteMediaSlot as SiteMediaAsset['slot'] | undefined;
      if (!image || !slot || !contextualMedia.some((asset) => asset.slot === slot)) return;
      // A hero or banner background may own its whole section. Links/buttons
      // within that section keep their navigation behavior unless targeted themselves.
      const interactive = target.closest('a, button, [role="button"]');
      if (interactive && image.contains(interactive)) return;
      event.preventDefault();
      event.stopPropagation();
      if (inlineSaving) return;
      openSelectedMedia(slot);
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
  }, [contextualBlocks, contextualMedia, discardCurrentEdit, finishInlineEdit, inlineMode, inlineSaving, inlineSlug, openSelectedMedia, openStructuredCopy, saveInlineEdit]);

  useEffect(() => () => finishInlineEdit(true), [finishInlineEdit]);

  return <>
    <div className={inlineSlug ? 'h-36 sm:h-28' : 'h-24'} aria-hidden="true" data-owner-live-controls-reserve />
    <div className="fixed bottom-5 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 rounded-full border border-[var(--public-brass)] bg-[var(--cf-surface)] p-2 shadow-2xl" data-owner-live-controls>
      <span className="hidden pl-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)] sm:inline">{publicationPresentation.badgeLabel}</span>
      <Button type="button" size="sm" variant={inlineMode ? 'default' : 'outline'} aria-pressed={inlineMode} onClick={() => {
        if (inlineMode && !discardCurrentEdit()) return;
        setInlineMode((current) => !current);
      }}>
        <FilePenLine className="mr-2 h-4 w-4" />{inlineMode ? 'Done editing' : 'Edit page'}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={openPageSettings}>
        <Settings2 className="mr-2 h-4 w-4" />Site settings
      </Button>
    </div>
    {inlineMode && !inlineSlug ? <div className="fixed bottom-20 right-5 z-40 max-w-[calc(100vw-2.5rem)] border border-[var(--public-brass)] bg-[var(--cf-surface)] px-3 py-2 text-xs text-[var(--cf-text-muted)] shadow-xl" role="status">
      Select highlighted text or images to edit on this page.
    </div> : null}
    {inlineSlug ? <div className="fixed bottom-20 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 border border-[var(--public-brass)] bg-[var(--cf-surface)] p-3 shadow-2xl" role="toolbar" aria-label="Inline site copy editor">
      <span className="mr-2 text-sm text-[var(--cf-text-muted)]">Edit this field, then publish or cancel.</span>
      <Button type="button" size="sm" onClick={() => void saveInlineEdit()} disabled={inlineSaving}><Check className="mr-2 h-4 w-4" />{inlineSaving ? publicationPresentation.publishingActionLabel : publicationPresentation.publishActionLabel}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => finishInlineEdit(true)} disabled={inlineSaving}><X className="mr-2 h-4 w-4" />Cancel</Button>
    </div> : null}
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" data-owner-site-editor-panel overlayClassName="bg-black/40" className="h-dvh w-[min(100vw,42rem)] max-w-[42rem] overflow-y-auto border-[var(--cf-border-strong)] bg-[var(--cf-canvas)] px-3 pb-10 pt-14 text-[var(--cf-text)] sm:px-5">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl text-[var(--cf-text-strong)]">{focusedMediaSlot
            ? `Edit ${contextualMedia.find((item) => item.slot === focusedMediaSlot)?.label ?? 'page image'}`
            : focusCopyOnly ? 'Edit selected copy' : `${context.label} settings`}</SheetTitle>
          <SheetDescription className="text-[var(--cf-text-muted)]">{publicationPresentation.dialogDescription}</SheetDescription>
        </SheetHeader>
        <Tabs value={panelTab} onValueChange={(value) => {
          setPanelTab(value as 'copy' | 'media' | 'site' | 'mechanics');
          setFocusedMediaSlot(null);
          setFocusCopyOnly(false);
        }} className="mt-4 space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent">
            {contextualBlocks.length ? <TabsTrigger value="copy"><FilePenLine className="mr-2 h-4 w-4" />Copy</TabsTrigger> : null}
            {hasMedia ? <TabsTrigger value="media"><ImageUp className="mr-2 h-4 w-4" />Media</TabsTrigger> : null}
            {siteOperationsEditor ? <TabsTrigger value="site"><Settings2 className="mr-2 h-4 w-4" />Site</TabsTrigger> : null}
            {roadmapRulesEditor ? <TabsTrigger value="mechanics"><Settings2 className="mr-2 h-4 w-4" />Rules</TabsTrigger> : null}
          </TabsList>
          {contextualBlocks.length ? <TabsContent value="copy"><PublicSiteCopyLiveEditor
            initialBlocks={focusCopyOnly && focusedSlug ? contextualBlocks.filter((block) => block.slug === focusedSlug) : contextualBlocks}
            focusSlug={focusedSlug}
            publicationEnvironment={publicationEnvironment}
            onBlocksChange={(nextContextBlocks) => {
              const publishedBySlug = new Map(nextContextBlocks.map((block) => [block.slug, block]));
              setBlocks((current) => current.map((block) => publishedBySlug.get(block.slug) ?? block));
              router.refresh();
            }}
          /></TabsContent> : null}
          {hasMedia ? <TabsContent value="media"><PublicSiteMediaLiveEditor
            initialAssets={contextualMedia}
            focusSlot={focusedMediaSlot}
            initialSiteConfiguration={siteConfiguration}
            onAssetsChange={(nextMedia) => {
              setMedia(nextMedia);
              router.refresh();
            }}
            onSiteConfigurationChange={(nextConfiguration) => {
              setSiteConfiguration(nextConfiguration);
              router.refresh();
            }}
            showWatermarkPresentation={!focusedMediaSlot && context.mediaGroups.includes('brand')}
          /></TabsContent> : null}
          {siteOperationsEditor ? <TabsContent value="site">{siteOperationsEditor}</TabsContent> : null}
          {roadmapRulesEditor ? <TabsContent value="mechanics">{roadmapRulesEditor}</TabsContent> : null}
        </Tabs>
      </SheetContent>
    </Sheet>
  </>;
}
