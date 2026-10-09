"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, FilePenLine, Settings2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { PrimaryNavigationId, PublicSiteConfiguration } from '../model/siteConfiguration';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { SiteContentBlock } from '../model/siteContent';
import type { SiteMediaAsset } from '../model/siteMedia';
import {
  getOwnerPublicationPresentation,
  type OwnerPublicationEnvironment,
} from '../model/ownerPublicationEnvironment';
import { PublicSiteCopyLiveEditor, PublicSiteFocusedTextEditor, savePublicSiteContentBlock } from './PublicSiteCopyLiveEditor';
import { PublicSiteMediaLiveEditor } from './PublicSiteMediaLiveEditor';

type ContentSlug = SiteContentBlock['slug'];
type MediaSlot = SiteMediaAsset['slot'];
type ConfigLabelField = 'primaryCtaLabel' | 'announcementMessage';
type DrawerView = { kind: 'settings' } | { kind: 'copy'; slug: ContentSlug } | { kind: 'media'; slot: MediaSlot }
  | { kind: 'config-label'; field: ConfigLabelField } | { kind: 'navigation-label'; id: PrimaryNavigationId };

const pageContext = (currentPath: string): {
  label: string;
  contentGroups: SiteContentBlock['group'][];
  mediaGroups: SiteMediaAsset['group'][];
} => {
  if (currentPath === '/plans') return { label: 'Plans', contentGroups: ['plans', 'shell'], mediaGroups: ['brand'] };
  if (currentPath === '/about') return { label: 'About', contentGroups: ['about', 'shell'], mediaGroups: ['brand'] };
  if (currentPath === '/cameron') return { label: 'Founder', contentGroups: ['founder', 'shell'], mediaGroups: ['brand', 'founder'] };
  if (currentPath === '/contributors') return { label: 'Contributor Program', contentGroups: ['contributor', 'shell'], mediaGroups: ['brand'] };
  if (currentPath === '/roadmap') return { label: 'Roadmap', contentGroups: ['roadmap', 'shell'], mediaGroups: ['brand'] };
  return { label: 'Homepage', contentGroups: ['landing', 'shell', 'sharing'], mediaGroups: ['brand', 'landing', 'showcase'] };
};

/** A projection of canonical Owner objects, never a second CMS or field registry. */
export const getSupplementalOwnerPageTargets = ({
  blocks,
  media,
  renderedCopySlugs,
  renderedMediaSlots,
}: {
  blocks: readonly SiteContentBlock[];
  media: readonly SiteMediaAsset[];
  renderedCopySlugs: ReadonlySet<string>;
  renderedMediaSlots: ReadonlySet<string>;
}): { copy: ContentSlug[]; media: MediaSlot[] } => ({
  copy: blocks.filter((block) => !renderedCopySlugs.has(block.slug)).map((block) => block.slug),
  media: media.filter((item) => !renderedMediaSlots.has(item.slot)).map((item) => item.slot),
});

const getRenderedPageTargets = (): { copy: Set<string>; media: Set<string> } => {
  const visible = (selector: string, key: 'siteContentSlug' | 'siteMediaSlot') => new Set(
    Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => element.dataset[key])
      .filter((value): value is string => Boolean(value)),
  );
  return {
    copy: visible('[data-site-content-slug]', 'siteContentSlug'),
    media: visible('[data-site-media-slot]', 'siteMediaSlot'),
  };
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
  const [editMode, setEditMode] = useState(false);
  const [drawer, setDrawer] = useState<DrawerView | null>(null);
  const [drawerDirty, setDrawerDirty] = useState(false);
  const [inlineSlug, setInlineSlug] = useState<ContentSlug | null>(null);
  const [copySaving, setCopySaving] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [supplementalSlugs, setSupplementalSlugs] = useState<ContentSlug[]>([]);
  const [supplementalMediaSlots, setSupplementalMediaSlots] = useState<MediaSlot[]>([]);
  const [supplementalCopy, setSupplementalCopy] = useState<ContentSlug | ''>('');
  const [supplementalMedia, setSupplementalMedia] = useState<MediaSlot | ''>('');
  const inlineElementRef = useRef<HTMLElement | null>(null);
  const originalBodyRef = useRef('');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [media, setMedia] = useState(initialMedia);
  const [siteConfiguration, setSiteConfiguration] = useState(initialSiteConfiguration);
  const context = useMemo(() => pageContext(currentPath), [currentPath]);
  const contextualBlocks = useMemo(() => blocks.filter((block) => context.contentGroups.includes(block.group)), [blocks, context.contentGroups]);
  const contextualMedia = useMemo(() => media.filter((item) => context.mediaGroups.includes(item.group)), [media, context.mediaGroups]);
  const selectedCopy = drawer?.kind === 'copy'
    ? contextualBlocks.find((block) => block.slug === drawer.slug)
    : supplementalCopy ? contextualBlocks.find((block) => block.slug === supplementalCopy) : null;
  const selectedMedia = drawer?.kind === 'media' ? drawer.slot : supplementalMedia || null;

  // A refreshed server render is the authoritative result of publication.
  useEffect(() => { setBlocks(initialBlocks); }, [initialBlocks]);
  useEffect(() => { setMedia(initialMedia); }, [initialMedia]);
  useEffect(() => { setSiteConfiguration(initialSiteConfiguration); }, [initialSiteConfiguration]);

  const finishInlineEdit = useCallback((restore: boolean) => {
    const element = inlineElementRef.current;
    if (element) {
      if (restore) element.textContent = originalBodyRef.current;
      element.removeAttribute('contenteditable');
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
      element.removeAttribute('data-site-inline-active');
      element.removeAttribute('spellcheck');
    }
    inlineElementRef.current = null;
    originalBodyRef.current = '';
    setInlineSlug(null);
  }, []);

  const abandonDraft = useCallback((): boolean => {
    if (copySaving || configSaving) return false;
    const element = inlineElementRef.current;
    const dirtyInline = element
      && (element.innerText || element.textContent || '').trim() !== originalBodyRef.current.trim();
    if ((dirtyInline || drawerDirty) && !window.confirm('Discard unpublished Owner edits?')) return false;
    finishInlineEdit(true);
    setDrawerDirty(false);
    return true;
  }, [configSaving, copySaving, drawerDirty, finishInlineEdit]);

  const inspectOtherTargets = useCallback(() => {
    const rendered = getRenderedPageTargets();
    const rest = getSupplementalOwnerPageTargets({
      blocks: contextualBlocks,
      media: contextualMedia,
      renderedCopySlugs: rendered.copy,
      renderedMediaSlots: rendered.media,
    });
    setSupplementalSlugs(rest.copy);
    setSupplementalMediaSlots(rest.media);
    setSupplementalCopy('');
    setSupplementalMedia('');
  }, [contextualBlocks, contextualMedia]);

  const openSettings = useCallback(() => {
    if (!abandonDraft()) return;
    inspectOtherTargets();
    setDrawer({ kind: 'settings' });
  }, [abandonDraft, inspectOtherTargets]);

  const openMedia = useCallback((slot: MediaSlot) => {
    if (!abandonDraft()) return;
    setDrawer({ kind: 'media', slot });
  }, [abandonDraft]);

  const openCopy = useCallback((slug: ContentSlug) => {
    if (!abandonDraft()) return;
    setDrawer({ kind: 'copy', slug });
  }, [abandonDraft]);


  const openConfigLabel = useCallback((field: ConfigLabelField) => {
    if (!abandonDraft()) return;
    setDrawer({ kind: 'config-label', field });
  }, [abandonDraft]);

  const openNavigationLabel = useCallback((id: PrimaryNavigationId) => {
    if (!abandonDraft()) return;
    setDrawer({ kind: 'navigation-label', id });
  }, [abandonDraft]);

  const publishSelectedLabel = useCallback(async (value: string): Promise<boolean> => {
    if (configSaving || !drawer || (drawer.kind !== 'config-label' && drawer.kind !== 'navigation-label')) return false;
    if (!siteConfiguration.updatedAt) {
      toast({ title: 'Reload to edit this label', description: 'The current site configuration revision is unavailable.', variant: 'destructive' });
      return false;
    }
    setConfigSaving(true);
    let definitivelyRejected = false;
    try {
      const response = await fetch('/api/owner/site-configuration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: drawer.kind === 'navigation-label' ? 'navigationLabel' : drawer.field,
          navigationId: drawer.kind === 'navigation-label' ? drawer.id : undefined,
          value,
          expectedUpdatedAt: siteConfiguration.updatedAt,
        }),
      });
      if (!response.ok) {
        definitivelyRejected = response.status >= 400 && response.status < 500;
        throw new Error(await readApiErrorMessage(response, 'Unable to publish this site label.'));
      }
      const publication = await response.json() as {
        settings: PublicSiteConfiguration;
        receipt: { refreshComplete: boolean; activityRecorded: boolean; message: string };
      };
      setSiteConfiguration(publication.settings);
      setDrawerDirty(false);
      router.refresh();
      toast(publication.receipt.refreshComplete
        ? {
            title: publicationPresentation.publishedTitle,
            description: publication.receipt.activityRecorded
              ? publicationPresentation.publishedDescription('Selected site label')
              : 'The site label was published, but Owner activity history could not be recorded.',
          }
        : { title: publicationPresentation.publishedTitle + '; reload to verify', description: publication.receipt.message });
      return true;
    } catch (error) {
      const uncertain = !definitivelyRejected;
      toast({
        title: uncertain ? 'Publication result unconfirmed' : 'Site label not published',
        description: uncertain
          ? 'The request did not return a reliable result. Reload the site to check the current value before trying again.'
          : error instanceof Error ? error.message : 'Unable to publish this site label.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setConfigSaving(false);
    }
  }, [configSaving, drawer, publicationPresentation, router, siteConfiguration.updatedAt, toast]);

  const publishCopy = useCallback(async (block: SiteContentBlock, rawBody: string): Promise<boolean> => {
    if (copySaving) return false;
    const body = rawBody.trim();
    if (!body || body.length > block.maxLength) {
      toast({ title: 'Invalid page copy', description: `Use 1–${block.maxLength} characters for ${block.label}.`, variant: 'destructive' });
      return false;
    }
    setCopySaving(true);
    try {
      const publication = await savePublicSiteContentBlock({ slug: block.slug, body, updatedAt: block.updatedAt });
      document.querySelectorAll<HTMLElement>('[data-site-content-slug]').forEach((element) => {
        if (element.dataset.siteContentSlug === publication.siteContentBlock.slug && element.childElementCount === 0) {
          element.textContent = publication.siteContentBlock.body;
        }
      });
      setBlocks((current) => current.map((candidate) => (
        candidate.slug === publication.siteContentBlock.slug ? publication.siteContentBlock : candidate
      )));
      setDrawerDirty(false);
      router.refresh();
      toast(publication.receipt.refreshComplete ? {
        title: publicationPresentation.publishedTitle,
        description: publication.receipt.activityRecorded
          ? publicationPresentation.publishedDescription(block.label)
          : `${publicationPresentation.publishedDescription(block.label)} Owner activity history could not be recorded.`,
      } : {
        title: `${publicationPresentation.publishedTitle}; reload to verify`,
        description: publication.receipt.message,
      });
      return true;
    } catch (error) {
      toast({ title: 'Site copy not published', description: error instanceof Error ? error.message : 'Unable to publish site copy.', variant: 'destructive' });
      return false;
    } finally {
      setCopySaving(false);
    }
  }, [copySaving, publicationPresentation, router, toast]);

  const saveInlineEdit = useCallback(async () => {
    const element = inlineElementRef.current;
    const block = contextualBlocks.find((candidate) => candidate.slug === inlineSlug);
    if (!element || !block || copySaving) return;
    if (await publishCopy(block, element.innerText || element.textContent || '')) finishInlineEdit(false);
  }, [contextualBlocks, copySaving, finishInlineEdit, inlineSlug, publishCopy]);

  useEffect(() => {
    if (!editMode) {
      finishInlineEdit(true);
      return;
    }
    const selectable = Array.from(document.querySelectorAll<HTMLElement>('[data-site-content-slug], [data-site-media-slot], [data-site-configuration-field], [data-site-navigation-id]'))
      .filter((element) => element.getClientRects().length > 0);
    const tabindexEntries = selectable.map((element) => ({
      element,
      tabIndex: element.getAttribute('tabindex'),
      ariaLabel: element.getAttribute('aria-label'),
    }));
    for (const { element } of tabindexEntries) {
      if (element.matches('a, button, input, textarea, select')) continue;
      element.setAttribute('tabindex', '0');
      const slug = element.dataset.siteContentSlug;
      const slot = element.dataset.siteMediaSlot;
      const field = element.dataset.siteConfigurationField;
      const navId = element.dataset.siteNavigationId;
      const label = slug ? contextualBlocks.find((block) => block.slug === slug)?.label
        : slot ? contextualMedia.find((item) => item.slot === slot)?.label
          : field === 'primaryCtaLabel' ? 'Primary action label'
            : field === 'announcementMessage' ? 'Announcement'
              : navId ? 'Navigation ' + navId : undefined;
      if (label && !element.hasAttribute('aria-label')) element.setAttribute('aria-label', `Edit ${label}`);
    }

    const selectField = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-owner-site-editor-panel], [data-owner-live-controls]')) return;
      const configTarget = target.closest<HTMLElement>('[data-site-configuration-field]');
      if (configTarget) {
        const fieldName = configTarget.dataset.siteConfigurationField;
        if (fieldName === 'primaryCtaLabel' || fieldName === 'announcementMessage') {
          event.preventDefault();
          event.stopPropagation();
          if (!copySaving && !configSaving) openConfigLabel(fieldName);
          return;
        }
      }
      const navTarget = target.closest<HTMLElement>('[data-site-navigation-id]');
      const navId = navTarget?.dataset.siteNavigationId as PrimaryNavigationId | undefined;
      if (navTarget && navId && siteConfiguration.primaryNavigation.some((item) => item.id === navId)) {
        event.preventDefault();
        event.stopPropagation();
        if (!copySaving && !configSaving) openNavigationLabel(navId);
        return;
      }
      const field = target.closest<HTMLElement>('[data-site-content-slug]');
      const block = contextualBlocks.find((candidate) => candidate.slug === field?.dataset.siteContentSlug);
      if (field && block) {
        if (inlineElementRef.current === field && !copySaving) return; // Keep the caret.
        event.preventDefault();
        event.stopPropagation();
        if (copySaving) return;
        if (field.childElementCount > 0) { openCopy(block.slug); return; }
        if (!abandonDraft()) return;
        inlineElementRef.current = field;
        originalBodyRef.current = block.body;
        field.setAttribute('contenteditable', 'plaintext-only');
        field.setAttribute('role', 'textbox');
        field.setAttribute('aria-label', `Edit ${block.label}`);
        field.setAttribute('data-site-inline-active', 'true');
        field.setAttribute('spellcheck', 'true');
        field.focus({ preventScroll: true });
        setInlineSlug(block.slug);
        return;
      }
      const image = target.closest<HTMLElement>('[data-site-media-slot]');
      const slot = image?.dataset.siteMediaSlot;
      if (!image || !slot || !contextualMedia.some((item) => item.slot === slot)) return;
      // Do not treat unrelated text or links inside a hero section as an image click.
      if (image.tagName === 'SECTION' && image !== target) return;
      event.preventDefault();
      event.stopPropagation();
      if (!copySaving) openMedia(slot as MediaSlot);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (inlineElementRef.current === target) {
        if (event.key === 'Escape') { event.preventDefault(); finishInlineEdit(true); }
        else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void saveInlineEdit(); }
        else if (event.key === 'Enter' && contextualBlocks.find((b) => b.slug === inlineSlug)?.kind === 'short') {
          event.preventDefault(); void saveInlineEdit();
        }
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ')
        && target.matches('[data-site-content-slug], [data-site-media-slot], [data-site-configuration-field], [data-site-navigation-id]')
        && !target.isContentEditable) {
        event.preventDefault();
        target.click();
      }
    };
    document.documentElement.dataset.siteInlineEditing = 'true';
    document.addEventListener('click', selectField, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      delete document.documentElement.dataset.siteInlineEditing;
      document.removeEventListener('click', selectField, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      for (const { element, tabIndex, ariaLabel } of tabindexEntries) {
        if (tabIndex === null) element.removeAttribute('tabindex');
        else element.setAttribute('tabindex', tabIndex);
        if (ariaLabel === null) element.removeAttribute('aria-label');
        else element.setAttribute('aria-label', ariaLabel);
      }
    };
  }, [abandonDraft, configSaving, contextualBlocks, contextualMedia, copySaving, editMode, finishInlineEdit, inlineSlug, openConfigLabel, openCopy, openMedia, openNavigationLabel, saveInlineEdit, siteConfiguration.primaryNavigation]);

  useEffect(() => () => finishInlineEdit(true), [finishInlineEdit]);

  const closeDrawer = (nextOpen: boolean) => {
    if (nextOpen || !abandonDraft()) return;
    setDrawer(null);
    setSupplementalCopy('');
    setSupplementalMedia('');
  };

  const renderedCopyEditor = (block: SiteContentBlock) => (
    <PublicSiteCopyLiveEditor
      key={block.slug + ':' + (block.updatedAt ?? 'bundled')}
      block={block}
      busy={copySaving}
      onDirtyChange={setDrawerDirty}
      onPublish={publishCopy}
      publicationEnvironment={publicationEnvironment}
    />
  );
  const selectedConfigurationLabel = drawer?.kind === 'config-label'
    ? {
        label: drawer.field === 'primaryCtaLabel' ? 'Primary action label' : 'Announcement text',
        value: siteConfiguration[drawer.field],
        maxLength: drawer.field === 'primaryCtaLabel' ? 80 : 240,
      }
    : drawer?.kind === 'navigation-label'
      ? {
          label: 'Navigation: ' + drawer.id,
          value: siteConfiguration.primaryNavigation.find((item) => item.id === drawer.id)?.label ?? '',
          maxLength: 40,
        }
      : null;

  const renderedMediaEditor = (slot: MediaSlot) => (
    <PublicSiteMediaLiveEditor
      key={slot}
      initialAssets={contextualMedia}
      focusSlot={slot}
      publicationEnvironment={publicationEnvironment}
      initialSiteConfiguration={siteConfiguration}
      onDirtyChange={setDrawerDirty}
      onAssetsChange={(nextMedia) => { setMedia(nextMedia); router.refresh(); }}
      onSiteConfigurationChange={(nextSettings) => { setSiteConfiguration(nextSettings); router.refresh(); }}
      showWatermarkPresentation={slot === 'brand.watermark'}
    />
  );

  return <>
    <div className={inlineSlug ? 'h-36 sm:h-28' : 'h-24'} aria-hidden="true" data-owner-live-controls-reserve />
    <div className="fixed bottom-5 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-full border border-[var(--public-brass)] bg-[var(--cf-surface)] p-2 shadow-2xl" data-owner-live-controls>
      <span className="hidden pl-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)] sm:inline">{publicationPresentation.badgeLabel}</span>
      <Button type="button" size="sm" variant={editMode ? 'default' : 'outline'} aria-pressed={editMode} onClick={() => {
        if (editMode && !abandonDraft()) return;
        setEditMode((current) => !current);
        if (editMode) setDrawer(null);
      }}>
        <FilePenLine className="mr-2 h-4 w-4" />{editMode ? 'Done editing' : 'Edit page'}
      </Button>
      {editMode ? <Button type="button" size="sm" variant="outline" onClick={openSettings}>
        <Settings2 className="mr-2 h-4 w-4" />Site settings
      </Button> : null}
    </div>
    {editMode && !inlineSlug && !drawer ? <div className="fixed bottom-20 right-5 z-40 max-w-[calc(100vw-2.5rem)] border border-[var(--public-brass)] bg-[var(--cf-surface)] px-3 py-2 text-xs text-[var(--cf-text-muted)] shadow-xl" role="status">
      Select highlighted copy or images. Other settings are available from the toolbar.
    </div> : null}
    {inlineSlug ? <div className="fixed bottom-20 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 border border-[var(--public-brass)] bg-[var(--cf-surface)] p-3 shadow-2xl" role="toolbar" aria-label="Inline site copy editor">
      <span className="mr-2 text-sm text-[var(--cf-text-muted)]">Edit the field and publish, or cancel.</span>
      <Button size="sm" type="button" disabled={copySaving} onClick={() => void saveInlineEdit()}>
        <Check className="mr-2 h-4 w-4" />{copySaving ? publicationPresentation.publishingActionLabel : publicationPresentation.publishActionLabel}
      </Button>
      <Button size="sm" type="button" variant="outline" disabled={copySaving} onClick={() => finishInlineEdit(true)}>
        <X className="mr-2 h-4 w-4" />Cancel
      </Button>
    </div> : null}
    <Sheet open={drawer !== null} onOpenChange={closeDrawer}>
      <SheetContent data-owner-site-editor-panel side="right" overlayClassName="bg-black/40" className="h-dvh w-[min(100vw,42rem)] max-w-[42rem] overflow-y-auto border-[var(--cf-border-strong)] bg-[var(--cf-canvas)] px-3 pb-10 pt-14 text-[var(--cf-text)] sm:max-w-[42rem] sm:px-5">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl text-[var(--cf-text-strong)]">
            {drawer?.kind === 'copy' ? 'Edit selected text'
              : drawer?.kind === 'config-label' || drawer?.kind === 'navigation-label' ? 'Edit selected site label'
                : drawer?.kind === 'media' ? `Edit ${contextualMedia.find((item) => item.slot === drawer.slot)?.label ?? 'selected image'}`
                : `${context.label} · Site settings`}
          </SheetTitle>
          <SheetDescription className="text-[var(--cf-text-muted)]">{publicationPresentation.dialogDescription}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {drawer?.kind === 'copy' && selectedCopy ? renderedCopyEditor(selectedCopy) : null}
          {selectedConfigurationLabel ? <PublicSiteFocusedTextEditor
            key={(drawer?.kind ?? '') + ':' + (drawer?.kind === 'navigation-label' ? drawer.id : drawer?.kind === 'config-label' ? drawer.field : '') + ':' + (siteConfiguration.updatedAt ?? 'unknown')}
            label={selectedConfigurationLabel.label}
            value={selectedConfigurationLabel.value}
            maxLength={selectedConfigurationLabel.maxLength}
            multiline={drawer?.kind === 'config-label' && drawer.field === 'announcementMessage'}
            busy={configSaving}
            onPublish={publishSelectedLabel}
            onDirtyChange={setDrawerDirty}
            publicationEnvironment={publicationEnvironment}
            help="This publishes only the selected label, without changing destinations, other navigation items or layout."
          /> : null}
          {drawer?.kind === 'media' && selectedMedia ? renderedMediaEditor(selectedMedia) : null}
          {drawer?.kind === 'settings' ? <>
            {siteOperationsEditor}
            {(supplementalSlugs.length > 0 || supplementalMediaSlots.length > 0) ? (
              <details className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
                <summary className="cursor-pointer font-semibold text-[var(--cf-accent-text)]">Other editable content on this page</summary>
                <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">
                  These existing Owner values are not selectable in the current rendered view. Select one only if you need to change it; page-visible content is edited on the page.
                </p>
                {supplementalSlugs.length ? <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">
                  Other page copy
                  <select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" value={supplementalCopy}
                    onChange={(event) => {
                      if (drawerDirty && !window.confirm('Discard the unpublished copy change?')) return;
                      setDrawerDirty(false);
                      setSupplementalCopy(event.target.value as ContentSlug | '');
                      setSupplementalMedia('');
                    }}>
                    <option value="">Choose an off-page or unselectable field</option>
                    {supplementalSlugs.map((slug) => {
                      const block = contextualBlocks.find((item) => item.slug === slug);
                      return <option key={slug} value={slug}>{block?.section}: {block?.label}</option>;
                    })}
                  </select>
                </label> : null}
                {drawer && selectedCopy && supplementalCopy ? renderedCopyEditor(selectedCopy) : null}
                {supplementalMediaSlots.length ? <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">
                  Other site images and brand assets
                  <select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" value={supplementalMedia}
                    onChange={(event) => {
                      if (drawerDirty && !window.confirm('Discard unpublished media changes?')) return;
                      setDrawerDirty(false);
                      setSupplementalMedia(event.target.value as MediaSlot | '');
                      setSupplementalCopy('');
                    }}>
                    <option value="">Choose a media slot not visible here</option>
                    {supplementalMediaSlots.map((slot) => (
                      <option key={slot} value={slot}>{contextualMedia.find((item) => item.slot === slot)?.label ?? slot}</option>
                    ))}
                  </select>
                </label> : null}
                {supplementalMedia ? renderedMediaEditor(supplementalMedia) : null}
              </details>
            ) : null}
            {roadmapRulesEditor ? <details className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
              <summary className="cursor-pointer font-semibold text-[var(--cf-accent-text)]">Roadmap governance rules</summary>
              <div className="mt-3">{roadmapRulesEditor}</div>
            </details> : null}
            <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">
              Site presentation is Owner-controlled. Page structure, routes and permissions are code-defined; actual subscription prices and connected service facts remain provider-owned.
            </p>
          </> : null}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
