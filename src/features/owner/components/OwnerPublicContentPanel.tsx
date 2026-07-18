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
  landing: 'Landing page',
  about: 'About page',
  sharing: 'Sharing',
};

export function OwnerPublicContentPanel({ consolePayload, mode, onConsoleChange }: {
  consolePayload: OwnerConsolePayload;
  mode: 'copy' | 'mechanics';
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState(consolePayload.siteContentBlocks);
  const [settings, setSettings] = useState(consolePayload.siteMechanics);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    setBlocks(consolePayload.siteContentBlocks);
    setSettings(consolePayload.siteMechanics);
  }, [consolePayload]);
  const groups = useMemo(() => (['landing', 'about', 'sharing'] as Array<SiteContentBlock['group']>).map((group) => ({ group, blocks: blocks.filter((block) => block.group === group) })), [blocks]);
  const shareMessage = blocks.find((block) => block.slug === 'sharing.message')?.body ?? '';

  const updateBlock = (slug: SiteContentBlockSlug, body: string) => {
    setBlocks((current) => current.map((block) => block.slug === slug ? { ...block, body } : block));
  };
  const saveBlock = async (block: SiteContentBlock) => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({ kind: 'siteContent', siteContentBlock: { slug: block.slug, body: block.body } }, 'Unable to save site copy.');
      onConsoleChange(next);
      toast({ title: 'Site copy published', description: `${block.label} is live without a deploy.` });
    } catch (error) {
      toast({ title: 'Site copy not saved', description: error instanceof Error ? error.message : 'Unable to save site copy.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  const saveMechanics = async () => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({ kind: 'siteMechanics', siteMechanics: settings }, 'Unable to save site mechanics.');
      onConsoleChange(next);
      toast({ title: 'Site mechanics saved', description: 'Feature voting and public board rules are updated.' });
    } catch (error) {
      toast({ title: 'Site mechanics not saved', description: error instanceof Error ? error.message : 'Unable to save site mechanics.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'copy') {
    return (
      <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
        <div className="flex items-center gap-3 text-[#e2aa4a]"><FileText className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Public site copy</h2></div>
        <div className="mt-6 grid gap-4">
          {groups.map(({ group, blocks: groupBlocks }) => (
            <div key={group} className="border border-[#4a3823] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#ffe7ad]">{groupLabels[group]}</h3>
              <div className="mt-4 grid gap-3">
                {groupBlocks.map((block) => (
                  <div key={block.slug} className="border border-[#3a2d1d] bg-[#0c0b09] p-3">
                    <label className="grid gap-2 text-sm text-[#c7b288]"><span className="flex justify-between gap-2">{block.label}<span className="text-xs text-[#8f7b57]">{block.body.length}/800</span></span><textarea className="min-h-24 border border-[#5f4526] bg-[#100c08] p-3 text-sm leading-6 text-[#ffe7ad]" maxLength={800} value={block.body} onChange={(event) => updateBlock(block.slug, event.target.value)} /></label>
                    <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-[#8f7b57]">{block.updatedAt ? `Last saved ${new Date(block.updatedAt).toLocaleDateString()}` : 'Using bundled default'}</span><Button size="sm" disabled={isSaving} onClick={() => saveBlock(block)}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Publishing...' : 'Publish block'}</Button></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <OwnerShareToolkit message={shareMessage} />
        </div>
      </section>
    );
  }

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
      <div className="flex items-center gap-3 text-[#e2aa4a]"><Settings2 className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Site mechanics</h2></div>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <MechanicsField label="Active suggestions cap" field="maxActiveUserRoadmapItems" value={settings.maxActiveUserRoadmapItems} settings={settings} setSettings={setSettings} help="Maximum user-created feature requests kept open before new suggestions are blocked." />
        <MechanicsField label="Suggestion length" field="maxRoadmapSuggestionLength" value={settings.maxRoadmapSuggestionLength} settings={settings} setSettings={setSettings} help="Maximum characters accepted for public feature suggestions." />
        <MechanicsField label="Archive vote floor" field="roadmapNegativeSignalMinTotalVotes" value={settings.roadmapNegativeSignalMinTotalVotes} settings={settings} setSettings={setSettings} help="Minimum votes required before negative-signal archiving." />
        <MechanicsField label="Archive downvote %" field="roadmapNegativeSignalMinDownvotePercent" value={settings.roadmapNegativeSignalMinDownvotePercent} settings={settings} setSettings={setSettings} help="Downvote percentage that archives a user-created request." />
      </div>
      <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveMechanics}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Saving site mechanics...' : 'Save site mechanics'}</Button>
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
    <label className="grid gap-2 text-sm text-[#c7b288]"><span className="flex items-center justify-between gap-2">{label}<OwnerFieldHelp text={help} /></span><input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" inputMode="numeric" value={value} onChange={(event) => setSettings({ ...settings, [field]: Number(event.target.value) || 0 })} /></label>
  );
}
