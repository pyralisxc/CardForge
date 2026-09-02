"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { SiteContentBlock, SiteContentBlockSlug } from '../model/siteContent';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

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

export function PublicSiteCopyLiveEditor({
  initialBlocks,
  focusSlug,
  onBlocksChange,
}: {
  initialBlocks: SiteContentBlock[];
  focusSlug?: SiteContentBlockSlug | null;
  onBlocksChange: (blocks: SiteContentBlock[]) => void;
}) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busyBlock, setBusyBlock] = useState<SiteContentBlockSlug | null>(null);
  const fieldRefs = useRef(new Map<SiteContentBlockSlug, HTMLDivElement>());
  useEffect(() => { setBlocks(initialBlocks); }, [initialBlocks]);
  useEffect(() => {
    if (!focusSlug) return;
    const field = fieldRefs.current.get(focusSlug);
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    field?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
  }, [focusSlug]);
  const groups = useMemo(() => [...new Set(blocks.map((block) => block.group))].map((group) => ({
    group,
    sections: [...new Set(blocks.filter((block) => block.group === group).map((block) => block.section))].map((section) => ({
      section,
      blocks: blocks.filter((block) => block.group === group && block.section === section),
    })),
  })), [blocks]);

  const updateBlock = (slug: SiteContentBlockSlug, body: string) => {
    setBlocks((current) => current.map((block) => block.slug === slug ? { ...block, body } : block));
  };
  const saveBlock = async (block: SiteContentBlock) => {
    setBusyBlock(block.slug);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'siteContent', siteContentBlock: { slug: block.slug, body: block.body } }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save site copy.'));
      const result = await response.json() as { console: { siteContentBlocks: SiteContentBlock[] } };
      onBlocksChange(result.console.siteContentBlocks);
      toast({ title: 'Site copy published', description: `${block.label} is live without a deploy.` });
    } catch (error) {
      toast({ title: 'Site copy not saved', description: error instanceof Error ? error.message : 'Unable to save site copy.', variant: 'destructive' });
    } finally {
      setBusyBlock(null);
    }
  };

  return <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
    <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><FileText className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Page copy</h2></div>
    <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Edit only the copy rendered by this public context. Each block publishes independently through the existing protected content owner.</p>
    <div className="mt-6 grid gap-4">
      {groups.map(({ group, sections }) => <details key={group} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)]" open>
        <summary className="cursor-pointer px-4 py-3 font-serif text-xl text-[var(--cf-accent-text)]">{groupLabels[group]} <span className="ml-2 text-xs font-sans text-[var(--cf-text-subtle)]">{sections.reduce((total, section) => total + section.blocks.length, 0)} editable fields</span></summary>
        <div className="grid gap-3 border-t border-[var(--cf-border-subtle)] p-4">
          {sections.map(({ section, blocks: sectionBlocks }) => <details key={section} className="border border-[#3a2d1d] bg-[var(--cf-canvas)]" open={sections.length === 1}>
            <summary className="cursor-pointer px-3 py-2 font-semibold text-[var(--cf-text-muted)]">{section} <span className="ml-2 text-xs font-normal text-[var(--cf-text-subtle)]">{sectionBlocks.length}</span></summary>
            <div className="grid gap-3 border-t border-[#3a2d1d] p-3">{sectionBlocks.map((block) => <div key={block.slug} ref={(node) => { if (node) fieldRefs.current.set(block.slug, node); else fieldRefs.current.delete(block.slug); }} className={`border bg-[var(--cf-canvas)] p-3 ${focusSlug === block.slug ? 'border-[var(--cf-accent)] ring-2 ring-[var(--cf-accent)]/30' : 'border-[#3a2d1d]'}`}>
              <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]"><span className="flex justify-between gap-2">{block.label}<span className="text-xs text-[var(--cf-text-subtle)]">{block.body.length}/{block.maxLength}</span></span>{block.kind === 'long' ? <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-sm leading-6 text-[var(--cf-accent-text)]" maxLength={block.maxLength} value={block.body} onChange={(event) => updateBlock(block.slug, event.target.value)} /> : <input className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-sm text-[var(--cf-accent-text)]" maxLength={block.maxLength} value={block.body} onChange={(event) => updateBlock(block.slug, event.target.value)} />}</label>
              <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-[var(--cf-text-subtle)]">{block.updatedAt ? `Last saved ${new Date(block.updatedAt).toLocaleDateString()}` : 'Using bundled default'}</span><Button size="sm" disabled={busyBlock !== null} onClick={() => void saveBlock(block)}><Save className="mr-2 h-4 w-4" />{busyBlock === block.slug ? 'Publishing...' : 'Publish block'}</Button></div>
            </div>)}</div>
          </details>)}
        </div>
      </details>)}
    </div>
  </section>;
}
