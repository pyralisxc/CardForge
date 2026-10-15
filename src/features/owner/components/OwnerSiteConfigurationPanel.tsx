"use client";

import { useState } from 'react';
import { ArrowDown, ArrowUp, Megaphone, Save, Search, Settings2 } from 'lucide-react';

import { useEditorDraft } from '@/components/ui/use-editor-draft';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type {
  HomepageSectionSetting,
  HomepageShowcaseExample,
  HomepageShowcaseStage,
  PrimaryNavigationItem,
  PublicSiteConfiguration,
} from '@/features/public-site/client';
import { getOwnerPublicationPresentation, type OwnerPublicationEnvironment } from '@/features/public-site/client';
import { loadOwnerSiteControls } from '@/features/owner/model/ownerOperationsClient';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { OwnerHomepageShowcasePanel } from './OwnerHomepageShowcasePanel';
import { OwnerHomepageStagesPanel } from './OwnerHomepageStagesPanel';

const inputClassName = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';
const sectionLabels: Record<HomepageSectionSetting['id'], string> = {
  showcase: 'Product showcase',
  workflow: 'How the workflow works',
  access: 'Plan choices',
  founder: 'Founder introduction',
  final_cta: 'Final Studio action',
};

const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export function OwnerSiteConfigurationPanel({
  settings,
  onSettingsChange,
  publicationEnvironment,
  onEditorStateChange,
}: {
  settings: PublicSiteConfiguration;
  onSettingsChange: (settings: PublicSiteConfiguration) => void;
  publicationEnvironment: OwnerPublicationEnvironment;
  onEditorStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}) {
  const { toast } = useToast();
  const { draft, setDraft, saving, setSaving, dirty, acceptPublished } = useEditorDraft(settings, onEditorStateChange);
  const [needsReadback, setNeedsReadback] = useState(false);
  const publication = getOwnerPublicationPresentation(publicationEnvironment);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (saving || needsReadback) return;
    setSaving(true);
    setSaveError(null);
    let rejected = false;
    let conflict = false;
    try {
      const response = await fetch('/api/owner/site-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        rejected = response.status >= 400 && response.status < 500;
        conflict = response.status === 409;
        throw new Error(await readApiErrorMessage(response, 'Unable to publish public site settings.'));
      }
      const body = await response.json() as {
        settings: PublicSiteConfiguration;
        activityRecorded: boolean;
        receipt?: {
          committed: boolean;
          refreshComplete: boolean;
          activityRecorded: boolean;
          message: string;
        };
      };
      if (!body.settings?.updatedAt || body.receipt?.committed !== true || typeof body.receipt.refreshComplete !== 'boolean') throw new Error('Invalid publication receipt.');
      acceptPublished(body.settings);
      onSettingsChange(body.settings);
      if (body.receipt && !body.receipt.refreshComplete) {
        toast({
          title: publication.publishedTitle + '; reload to verify',
          description: body.receipt.message,
        });
      } else {
        toast({
          title: publication.publishedTitle,
          description: body.activityRecorded
            ? publication.publishedDescription('Site settings')
            : publication.publishedDescription('Site settings') + ' Owner change history could not be recorded.',
        });
      }
    } catch (error) {
      const message = rejected && error instanceof Error ? error.message
        : 'The publication result is unconfirmed. Your draft is preserved. Reload current settings before trying again.';
      setNeedsReadback(!rejected || conflict);
      setSaveError(message);
      toast({ title: rejected ? 'Site settings not published' : 'Publication result unconfirmed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reloadCurrentSettings = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const current = (await loadOwnerSiteControls()).siteConfiguration;
      if (!current?.updatedAt) throw new Error('The current settings revision is unavailable. Your draft is preserved.');
      if (dirty && !window.confirm('Replace your unpublished settings draft with the current published settings?')) return;
      acceptPublished(current);
      onSettingsChange(current);
      setNeedsReadback(false);
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to read current settings. Your draft is preserved.');
    } finally {
      setSaving(false);
    }
  };

  const updateNavigation = (index: number, patch: Partial<PrimaryNavigationItem>) => {
    setDraft((current) => ({
      ...current,
      primaryNavigation: current.primaryNavigation.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const updateShowcaseExamples = (examples: HomepageShowcaseExample[]) => {
    setDraft((current) => ({
      ...current,
      homepageSections: current.homepageSections.map((section) => (
        section.id === 'showcase' ? { ...section, showcaseExamples: examples } : section
      )),
    }));
  };

  const updateShowcaseStages = (stages: HomepageShowcaseStage[]) => {
    setDraft((current) => ({
      ...current,
      homepageSections: current.homepageSections.map((section) => (
        section.id === 'showcase' ? { ...section, showcaseStages: stages } : section
      )),
    }));
  };
  const showcaseSection = draft.homepageSections.find((section) => section.id === 'showcase');
  const showcaseExamples = showcaseSection?.showcaseExamples ?? [];
  const showcaseStages = showcaseSection?.showcaseStages;

  return (
    <section className="space-y-5">
      <div role="group" aria-label="Site publication" className="sticky top-0 z-10 space-y-2 border border-[var(--cf-border-strong)] bg-[var(--cf-canvas)] p-3 shadow-lg">
        <p className="text-xs text-[var(--cf-text-subtle)]" role="status">{dirty ? 'Unpublished site settings' : 'No unpublished site settings'}</p>
        {saveError ? <p role="alert" className="max-w-2xl border border-destructive/45 bg-destructive/10 px-3 py-2 text-sm leading-6 text-destructive">{saveError}</p> : null}
        <Button type="button" className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" disabled={saving || needsReadback || !dirty} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />{saving ? publication.publishingActionLabel : publication.publishActionLabel}</Button>
        {needsReadback ? <Button type="button" variant="outline" disabled={saving} onClick={() => void reloadCurrentSettings()}>Reload current settings</Button> : null}
      </div>
      <fieldset disabled={saving} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Megaphone className="h-5 w-5" aria-hidden="true" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Announcement</h2></div>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Show one compact message above the public header. Leave it off when there is nothing every visitor needs to see.</p>
          <label className="mt-4 flex min-h-11 items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-accent-text)]">
            Show public announcement
            <input type="checkbox" checked={draft.announcementEnabled} onChange={(event) => setDraft((current) => ({ ...current, announcementEnabled: event.target.checked }))} />
          </label>
          <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">Announcement text<textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" maxLength={240} value={draft.announcementMessage} onChange={(event) => setDraft((current) => ({ ...current, announcementMessage: event.target.value }))} /></label>
        </article>

        <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Search className="h-5 w-5" aria-hidden="true" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Homepage search &amp; sharing</h2></div>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">These fields own the homepage title and search description. The default social-share image is managed beside the other brand media.</p>
          <label className="mt-4 grid gap-2 text-sm text-[var(--cf-text-muted)]">Page title<input className={inputClassName} maxLength={80} value={draft.homepageTitle} onChange={(event) => setDraft((current) => ({ ...current, homepageTitle: event.target.value }))} /></label>
          <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">Search description<textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" maxLength={200} value={draft.homepageDescription} onChange={(event) => setDraft((current) => ({ ...current, homepageDescription: event.target.value }))} /></label>
          <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">Search phrases (one per line)<textarea className="min-h-32 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" value={draft.searchKeywords.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, searchKeywords: event.target.value.split('\n').map((keyword) => keyword.trim()).filter(Boolean) }))} /></label>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Settings2 className="h-5 w-5" aria-hidden="true" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Primary navigation</h2></div>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Rename, hide, or reorder the approved public destinations. Routes themselves remain code-owned.</p>
          <div className="mt-4 space-y-2">
            {draft.primaryNavigation.map((item, index) => (
              <div key={item.id} className="grid gap-2 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <input aria-label={`Show ${item.label} in primary navigation`} type="checkbox" checked={item.visible} onChange={(event) => updateNavigation(index, { visible: event.target.checked })} />
                {!item.visible || item.href === draft.primaryCtaHref
                  ? <label className="grid gap-1 text-xs text-[var(--cf-text-subtle)]">{item.href}<input aria-label={`${item.id} navigation label`} className={inputClassName} maxLength={40} value={item.label} onChange={(event) => updateNavigation(index, { label: event.target.value })} /></label>
                  : <span className="grid gap-1 text-sm text-[var(--cf-accent-text)]">{item.label}<span className="text-xs text-[var(--cf-text-subtle)]">Edit this visible label directly on the site</span></span>}
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => setDraft((current) => ({ ...current, primaryNavigation: move(current.primaryNavigation, index, -1) }))}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" aria-label={`Move ${item.label} down`} disabled={index === draft.primaryNavigation.length - 1} onClick={() => setDraft((current) => ({ ...current, primaryNavigation: move(current.primaryNavigation, index, 1) }))}><ArrowDown className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Homepage sections &amp; offers</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Control the order and visibility of the homepage’s approved sections. This cannot introduce unreviewed components or routes.</p>
          <div className="mt-4 space-y-2">
            {draft.homepageSections.map((section, index) => (
              <div key={section.id} className="flex min-h-11 items-center gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
                <input aria-label={`Show ${sectionLabels[section.id]}`} type="checkbox" checked={section.visible} onChange={(event) => setDraft((current) => ({ ...current, homepageSections: current.homepageSections.map((item, itemIndex) => itemIndex === index ? { ...item, visible: event.target.checked } : item) }))} />
                <span className="min-w-0 flex-1 text-sm text-[var(--cf-accent-text)]">{sectionLabels[section.id]}</span>
                <Button type="button" size="icon" variant="outline" aria-label={`Move ${sectionLabels[section.id]} up`} disabled={index === 0} onClick={() => setDraft((current) => ({ ...current, homepageSections: move(current.homepageSections, index, -1) }))}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="outline" aria-label={`Move ${sectionLabels[section.id]} down`} disabled={index === draft.homepageSections.length - 1} onClick={() => setDraft((current) => ({ ...current, homepageSections: move(current.homepageSections, index, 1) }))}><ArrowDown className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cf-text-subtle)]">The product showcase’s demo-set selection and sample data are edited below.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-accent-text)]">Show founder support offer<input type="checkbox" checked={draft.supportOfferVisible} onChange={(event) => setDraft((current) => ({ ...current, supportOfferVisible: event.target.checked }))} /></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid content-center gap-1 text-sm text-[var(--cf-text-muted)]">
              <span className="font-semibold text-[var(--cf-accent-text)]">Primary action wording</span>
              <span className="text-xs leading-5 text-[var(--cf-text-subtle)]">Select the primary action button while editing the public page to change its label.</span>
            </div>
            <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">Primary action destination<input className={inputClassName} value={draft.primaryCtaHref} onChange={(event) => setDraft((current) => ({ ...current, primaryCtaHref: event.target.value }))} /></label>
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <OwnerHomepageStagesPanel stages={showcaseStages} onChange={updateShowcaseStages} />
        <OwnerHomepageShowcasePanel examples={showcaseExamples} onChange={updateShowcaseExamples} />
      </div>

      </fieldset>

    </section>
  );
}