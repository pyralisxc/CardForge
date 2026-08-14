"use client";

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Megaphone, Save, Search, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type {
  HomepageSectionSetting,
  PrimaryNavigationItem,
  PublicSiteConfiguration,
} from '@/features/public-site/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

const inputClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]';
const sectionLabels: Record<HomepageSectionSetting['id'], string> = {
  showcase: 'Studio showcase',
  workflow: 'How the workflow works',
  access: 'Free and Creator Pass comparison',
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
}: {
  settings: PublicSiteConfiguration;
  onSettingsChange: (settings: PublicSiteConfiguration) => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(settings), [settings]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/owner/site-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save public site settings.'));
      const body = await response.json() as { settings: PublicSiteConfiguration; activityRecorded: boolean };
      setDraft(body.settings);
      onSettingsChange(body.settings);
      toast({
        title: 'Public site settings saved',
        description: body.activityRecorded
          ? 'The public site cache and owner change history were updated.'
          : 'The site was updated, but change history could not be recorded.',
        variant: body.activityRecorded ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({ title: 'Public site settings not saved', description: error instanceof Error ? error.message : 'Unable to save public site settings.', variant: 'destructive' });
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

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <article className="border border-[#5f4526] bg-[#15100a] p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><Megaphone className="h-5 w-5" aria-hidden="true" /><h2 className="font-serif text-2xl text-[#fff1c7]">Announcement</h2></div>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">Show one compact message above the public header. Leave it off when there is nothing every visitor needs to see.</p>
          <label className="mt-4 flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">
            Show public announcement
            <input type="checkbox" checked={draft.announcementEnabled} onChange={(event) => setDraft((current) => ({ ...current, announcementEnabled: event.target.checked }))} />
          </label>
          <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">Announcement text<textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" maxLength={240} value={draft.announcementMessage} onChange={(event) => setDraft((current) => ({ ...current, announcementMessage: event.target.value }))} /></label>
        </article>

        <article className="border border-[#5f4526] bg-[#15100a] p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><Search className="h-5 w-5" aria-hidden="true" /><h2 className="font-serif text-2xl text-[#fff1c7]">Homepage search &amp; sharing</h2></div>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">These fields own the homepage title and search description. The default social-share image is managed beside the other brand media.</p>
          <label className="mt-4 grid gap-2 text-sm text-[#c7b288]">Page title<input className={inputClassName} maxLength={80} value={draft.homepageTitle} onChange={(event) => setDraft((current) => ({ ...current, homepageTitle: event.target.value }))} /></label>
          <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">Search description<textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" maxLength={200} value={draft.homepageDescription} onChange={(event) => setDraft((current) => ({ ...current, homepageDescription: event.target.value }))} /></label>
          <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">Search phrases (one per line)<textarea className="min-h-32 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={draft.searchKeywords.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, searchKeywords: event.target.value.split('\n').map((keyword) => keyword.trim()).filter(Boolean) }))} /></label>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="border border-[#5f4526] bg-[#15100a] p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><Settings2 className="h-5 w-5" aria-hidden="true" /><h2 className="font-serif text-2xl text-[#fff1c7]">Primary navigation</h2></div>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">Rename, hide, or reorder the approved public destinations. Routes themselves remain code-owned.</p>
          <div className="mt-4 space-y-2">
            {draft.primaryNavigation.map((item, index) => (
              <div key={item.id} className="grid gap-2 border border-[#3c2c1b] bg-[#100c08] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <input aria-label={`Show ${item.label} in primary navigation`} type="checkbox" checked={item.visible} onChange={(event) => updateNavigation(index, { visible: event.target.checked })} />
                <label className="grid gap-1 text-xs text-[#a98a75]">{item.href}<input aria-label={`${item.id} navigation label`} className={inputClassName} maxLength={40} value={item.label} onChange={(event) => updateNavigation(index, { label: event.target.value })} /></label>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => setDraft((current) => ({ ...current, primaryNavigation: move(current.primaryNavigation, index, -1) }))}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" aria-label={`Move ${item.label} down`} disabled={index === draft.primaryNavigation.length - 1} onClick={() => setDraft((current) => ({ ...current, primaryNavigation: move(current.primaryNavigation, index, 1) }))}><ArrowDown className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="border border-[#5f4526] bg-[#15100a] p-5">
          <h2 className="font-serif text-2xl text-[#fff1c7]">Homepage sections &amp; offers</h2>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">Control the order and visibility of the homepage’s approved sections. This cannot introduce unreviewed components or routes.</p>
          <div className="mt-4 space-y-2">
            {draft.homepageSections.map((section, index) => (
              <div key={section.id} className="flex min-h-11 items-center gap-3 border border-[#3c2c1b] bg-[#100c08] p-3">
                <input aria-label={`Show ${sectionLabels[section.id]}`} type="checkbox" checked={section.visible} onChange={(event) => setDraft((current) => ({ ...current, homepageSections: current.homepageSections.map((item, itemIndex) => itemIndex === index ? { ...item, visible: event.target.checked } : item) }))} />
                <span className="min-w-0 flex-1 text-sm text-[#ffe7ad]">{sectionLabels[section.id]}</span>
                <Button type="button" size="icon" variant="outline" aria-label={`Move ${sectionLabels[section.id]} up`} disabled={index === 0} onClick={() => setDraft((current) => ({ ...current, homepageSections: move(current.homepageSections, index, -1) }))}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="outline" aria-label={`Move ${sectionLabels[section.id]} down`} disabled={index === draft.homepageSections.length - 1} onClick={() => setDraft((current) => ({ ...current, homepageSections: move(current.homepageSections, index, 1) }))}><ArrowDown className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">Show Creator Pass offer<input type="checkbox" checked={draft.creatorPassOfferVisible} onChange={(event) => setDraft((current) => ({ ...current, creatorPassOfferVisible: event.target.checked }))} /></label>
            <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">Show founder support offer<input type="checkbox" checked={draft.supportOfferVisible} onChange={(event) => setDraft((current) => ({ ...current, supportOfferVisible: event.target.checked }))} /></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[#c7b288]">Primary action text<input className={inputClassName} maxLength={80} value={draft.primaryCtaLabel} onChange={(event) => setDraft((current) => ({ ...current, primaryCtaLabel: event.target.value }))} /></label>
            <label className="grid gap-2 text-sm text-[#c7b288]">Primary action path<input className={inputClassName} value={draft.primaryCtaHref} onChange={(event) => setDraft((current) => ({ ...current, primaryCtaHref: event.target.value }))} /></label>
          </div>
        </article>
      </div>

      <Button type="button" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={saving || JSON.stringify(draft) === JSON.stringify(settings)} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving site controls...' : 'Save site controls'}</Button>
    </section>
  );
}
