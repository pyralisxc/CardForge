"use client";

import { useEffect, useMemo, useState } from 'react';
import { FileText, Save, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';
import type { SiteContentBlock, SiteContentBlockSlug } from '@/features/public-site/client/content';
import type { RoadmapSettings } from '@/features/roadmap/client/admin';
import { OwnerFieldHelp } from './OwnerPanelPrimitives';
import { OwnerShareToolkit } from './OwnerShareToolkit';

const groupLabels: Record<SiteContentBlock['group'], string> = {
  shell: 'Shared header & footer',
  landing: 'Landing page',
  plans: 'Plans page',
  account: 'Account page',
  about: 'About page',
  founder: 'Founder page',
  contributor: 'Contributor program',
  roadmap: 'Roadmap',
  sharing: 'Sharing',
};
const contentGroups: Array<SiteContentBlock['group']> = ['shell', 'landing', 'plans', 'account', 'about', 'founder', 'contributor', 'roadmap', 'sharing'];

export function OwnerPublicContentPanel({ consolePayload, mode, onConsoleChange }: {
  consolePayload: OwnerConsolePayload;
  mode: 'copy' | 'mechanics';
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState(consolePayload.siteContentBlocks);
  const [settings, setSettings] = useState(consolePayload.siteMechanics);
  const [busyBlock, setBusyBlock] = useState<SiteContentBlockSlug | null>(null);
  const [isSavingMechanics, setIsSavingMechanics] = useState(false);
  useEffect(() => {
    setBlocks(consolePayload.siteContentBlocks);
    setSettings(consolePayload.siteMechanics);
  }, [consolePayload]);
  const groups = useMemo(() => contentGroups.map((group) => ({
    group,
    sections: [...new Set(blocks.filter((block) => block.group === group).map((block) => block.section))].map((section) => ({
      section,
      blocks: blocks.filter((block) => block.group === group && block.section === section),
    })),
  })), [blocks]);
  const shareMessage = blocks.find((block) => block.slug === 'sharing.message')?.body ?? '';

  const updateBlock = (slug: SiteContentBlockSlug, body: string) => {
    setBlocks((current) => current.map((block) => block.slug === slug ? { ...block, body } : block));
  };
  const saveBlock = async (block: SiteContentBlock) => {
    setBusyBlock(block.slug);
    try {
      const next = await updateOwnerConsole({ kind: 'siteContent', siteContentBlock: { slug: block.slug, body: block.body } }, 'Unable to save site copy.');
      onConsoleChange(next);
      toast({ title: 'Site copy published', description: `${block.label} is live without a deploy.` });
    } catch (error) {
      toast({ title: 'Site copy not saved', description: error instanceof Error ? error.message : 'Unable to save site copy.', variant: 'destructive' });
    } finally {
      setBusyBlock(null);
    }
  };
  const saveMechanics = async () => {
    setIsSavingMechanics(true);
    try {
      const next = await updateOwnerConsole({ kind: 'siteMechanics', siteMechanics: settings }, 'Unable to save roadmap rules.');
      onConsoleChange(next);
      toast({ title: 'Roadmap rules saved', description: 'Feature voting and public roadmap rules are updated.' });
    } catch (error) {
      toast({ title: 'Roadmap rules not saved', description: error instanceof Error ? error.message : 'Unable to save roadmap rules.', variant: 'destructive' });
    } finally {
      setIsSavingMechanics(false);
    }
  };

  if (mode === 'copy') {
    return (
      <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
        <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><FileText className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Public site copy</h2></div>
        <div className="mt-6 grid gap-4">
          {groups.map(({ group, sections }) => (
            <details key={group} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)]" open={group === 'landing'}>
              <summary className="cursor-pointer px-4 py-3 font-serif text-xl text-[var(--cf-accent-text)]">{groupLabels[group]} <span className="ml-2 text-xs font-sans text-[var(--cf-text-subtle)]">{sections.reduce((total, section) => total + section.blocks.length, 0)} editable fields</span></summary>
              <div className="grid gap-3 border-t border-[var(--cf-border-subtle)] p-4">
                {sections.map(({ section, blocks: sectionBlocks }) => <details key={section} className="border border-[#3a2d1d] bg-[var(--cf-canvas)]" open={sections.length === 1}>
                  <summary className="cursor-pointer px-3 py-2 font-semibold text-[var(--cf-text-muted)]">{section} <span className="ml-2 text-xs font-normal text-[var(--cf-text-subtle)]">{sectionBlocks.length}</span></summary>
                  <div className="grid gap-3 border-t border-[#3a2d1d] p-3">
                  {sectionBlocks.map((block) => (
                  <div key={block.slug} className="border border-[#3a2d1d] bg-[var(--cf-canvas)] p-3">
                    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]"><span className="flex justify-between gap-2">{block.label}<span className="text-xs text-[var(--cf-text-subtle)]">{block.body.length}/{block.maxLength}</span></span>{block.kind === 'long' ? <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-sm leading-6 text-[var(--cf-accent-text)]" maxLength={block.maxLength} value={block.body} onChange={(event) => updateBlock(block.slug, event.target.value)} /> : <input className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-sm text-[var(--cf-accent-text)]" maxLength={block.maxLength} value={block.body} onChange={(event) => updateBlock(block.slug, event.target.value)} />}</label>
                    <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-[var(--cf-text-subtle)]">{block.updatedAt ? `Last saved ${new Date(block.updatedAt).toLocaleDateString()}` : 'Using bundled default'}</span><Button size="sm" disabled={busyBlock !== null} onClick={() => saveBlock(block)}><Save className="mr-2 h-4 w-4" />{busyBlock === block.slug ? 'Publishing...' : 'Publish block'}</Button></div>
                  </div>
                  ))}
                  </div>
                </details>)}
              </div>
            </details>
          ))}
          <OwnerShareToolkit message={shareMessage} />
        </div>
      </section>
    );
  }

  return (
    <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Settings2 className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Roadmap rules</h2></div>
      <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MechanicsField label="Active suggestions cap" field="maxActiveUserRoadmapItems" value={settings.maxActiveUserRoadmapItems} settings={settings} setSettings={setSettings} help="Maximum user-created feature requests kept open before new suggestions are blocked." />
        <MechanicsField label="Suggestion length" field="maxRoadmapSuggestionLength" value={settings.maxRoadmapSuggestionLength} settings={settings} setSettings={setSettings} help="Maximum characters accepted for public feature suggestions." />
        <MechanicsField label="Archive vote floor" field="roadmapNegativeSignalMinTotalVotes" value={settings.roadmapNegativeSignalMinTotalVotes} settings={settings} setSettings={setSettings} help="Minimum votes required before negative-signal archiving." />
        <MechanicsField label="Archive downvote %" field="roadmapNegativeSignalMinDownvotePercent" value={settings.roadmapNegativeSignalMinDownvotePercent} settings={settings} setSettings={setSettings} help="Downvote percentage that archives a user-created request." />
        <MechanicsField label="Estimated tax %" field="roadmapEstimatedTaxPercent" value={settings.roadmapEstimatedTaxPercent} settings={settings} setSettings={setSettings} help="Planning estimate deducted from active Creator Pass listed-price MRR. This is not a filed tax result or tax advice." />
        <MechanicsField label="Operating reserve %" field="roadmapOperatingReservePercent" value={settings.roadmapOperatingReservePercent} settings={settings} setSettings={setSettings} help="Share of after-tax Creator Pass income held back before roadmap upgrades are considered funded." />
      </div>
      <Button className="mt-5 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" disabled={isSavingMechanics} onClick={saveMechanics}><Save className="mr-2 h-4 w-4" />{isSavingMechanics ? 'Saving roadmap rules...' : 'Save roadmap rules'}</Button>
    </section>
  );
}

function MechanicsField({ label, field, value, settings, setSettings, help }: {
  label: string;
  field: keyof RoadmapSettings;
  value: number;
  settings: RoadmapSettings;
  setSettings: (settings: RoadmapSettings) => void;
  help: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]"><span className="flex items-center justify-between gap-2">{label}<OwnerFieldHelp text={help} /></span><input className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" inputMode="numeric" value={value} onChange={(event) => setSettings({ ...settings, [field]: Number(event.target.value) || 0 })} /></label>
  );
}
