"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_HOMEPAGE_SECTION_DESIGN,
  HOMEPAGE_COMPOSER_MEDIA_SLOTS,
  MAX_HOMEPAGE_CUSTOM_SECTIONS,
  MAX_HOMEPAGE_SECTION_BLOCKS,
  isHomepageCustomSection,
  type HomepageContentBlock,
  type HomepageCustomSection,
  type HomepageLayoutSection,
} from '@/features/public-site/client';

const inputClass = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]';
const newId = (prefix: string) => prefix + '-' + crypto.randomUUID().slice(0, 12);

const initialBlock = (kind: HomepageContentBlock['kind']): HomepageContentBlock => {
  const id = newId('block');
  if (kind === 'heading') return { id, kind, text: 'A new section' };
  if (kind === 'text') return { id, kind, text: 'Add your message here.' };
  if (kind === 'feature') return { id, kind, title: 'Feature', body: 'Describe what this part of CardForge offers.' };
  if (kind === 'button') return { id, kind, text: 'Open your Desk', href: '/account' };
  return { id, kind: 'image', mediaSlot: `landing.composer.${id}` };
};

const move = <T,>(items: T[], i: number, offset: -1 | 1): T[] => {
  const j = i + offset;
  if (j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

const sectionTitle = (section: HomepageCustomSection) => (
  section.blocks.find((block) => block.kind === 'heading')?.text || section.id
);

export function OwnerHomepageComposerPanel({ sections, onChange }: {
  sections: HomepageLayoutSection[];
  onChange: (value: HomepageLayoutSection[]) => void;
}) {
  const custom = sections.filter(isHomepageCustomSection);
  const setSection = (id: string, next: HomepageCustomSection) => {
    onChange(sections.map((section) => section.id === id ? next : section));
  };
  const addSection = () => {
    if (custom.length >= MAX_HOMEPAGE_CUSTOM_SECTIONS) return;
    const id = newId('custom');
    onChange([...sections.slice(0, -1), {
      id, kind: 'custom', visible: true,
      design: { ...DEFAULT_HOMEPAGE_SECTION_DESIGN },
      blocks: [
        { id: newId('heading'), kind: 'heading', text: 'A new CardForge story' },
        { id: newId('paragraph'), kind: 'text', text: 'Edit the section directly in Owner and publish it to Preview.' },
      ],
    }, ...sections.slice(-1)]);
  };
  const updateBlock = (section: HomepageCustomSection, blockId: string, patch: Partial<HomepageContentBlock>) => {
    setSection(section.id, {
      ...section,
      blocks: section.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block),
    });
  };

  return (
    <article className="space-y-5 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Website section designer</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
            Add, reorder and design content sections using accessible layouts, responsive patterns, text, images,
            feature cards and buttons. These use the same published configuration as the Owner MCP.
            The existing product sections stay intact unless you explicitly change their visibility or order.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addSection} disabled={custom.length >= MAX_HOMEPAGE_CUSTOM_SECTIONS}>
          <Plus className="mr-2 h-4 w-4" /> Add section
        </Button>
      </div>
      {custom.length === 0 ? (
        <p className="border border-dashed border-[var(--cf-border)] p-4 text-sm text-[var(--cf-text-muted)]">
          No additional website sections yet. Use Add section to create one without editing source code.
        </p>
      ) : null}
      {custom.map((section) => {
        const sectionIndex = sections.findIndex((item) => item.id === section.id);
        return (
          <section key={section.id} data-owner-edit-section={section.id} className="space-y-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-[var(--cf-accent-text)]">{sectionTitle(section)}</h3>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="icon" aria-label={`Move ${section.id} up`}
                  disabled={sectionIndex === 0} onClick={() => onChange(move(sections, sectionIndex, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={`Move ${section.id} down`}
                  disabled={sectionIndex === sections.length - 1} onClick={() => onChange(move(sections, sectionIndex, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${section.id}`}
                  onClick={() => onChange(sections.filter((item) => item.id !== section.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--cf-text-muted)]">
              <input type="checkbox" checked={section.visible}
                onChange={(event) => setSection(section.id, { ...section, visible: event.target.checked })} />
              Visible on homepage
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['layout', ['stack', 'split', 'grid']],
                ['tone', ['charcoal', 'raised', 'warm']],
                ['spacing', ['compact', 'balanced', 'spacious']],
                ['align', ['start', 'center']],
              ] as const).map(([field, options]) => (
                <label key={field} className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
                  {field[0].toUpperCase() + field.slice(1)}
                  <select className={inputClass} value={section.design[field]} onChange={(event) => setSection(section.id, {
                    ...section, design: { ...section.design, [field]: event.target.value },
                  })}>
                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              {section.blocks.map((block, index) => (
                <div key={block.id} data-owner-edit-block={block.id} className="border border-[var(--cf-border)] p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <strong className="flex-1 text-[var(--cf-accent-text)]">{block.kind} · {index + 1}</strong>
                    <Button variant="outline" size="icon" type="button" aria-label={`Move block ${block.id} up`} disabled={index === 0}
                      onClick={() => setSection(section.id, { ...section, blocks: move(section.blocks, index, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" aria-label={`Move block ${block.id} down`} disabled={index === section.blocks.length - 1}
                      onClick={() => setSection(section.id, { ...section, blocks: move(section.blocks, index, 1) })}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" type="button" aria-label={`Remove block ${block.id}`} disabled={section.blocks.length <= 1}
                      onClick={() => setSection(section.id, { ...section, blocks: section.blocks.filter((item) => item.id !== block.id) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {(block.kind === 'heading' || block.kind === 'text' || block.kind === 'button') ? (
                    <label className="mt-2 grid gap-1 text-xs text-[var(--cf-text-muted)]">Text
                      <textarea className={inputClass + ' min-h-20 p-2'} maxLength={block.kind === 'heading' ? 180 : block.kind === 'button' ? 80 : 1500}
                        value={block.text ?? ''} onChange={(event) => updateBlock(section, block.id, { text: event.target.value })} />
                    </label>
                  ) : null}
                  {block.kind === 'button' ? (
                    <label className="mt-2 grid gap-1 text-xs text-[var(--cf-text-muted)]">Internal destination
                      <input className={inputClass} value={block.href ?? ''} onChange={(event) => updateBlock(section, block.id, { href: event.target.value })} />
                    </label>
                  ) : null}
                  {block.kind === 'feature' ? (
                    <div className="mt-2 grid gap-2">
                      <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Feature title
                        <input className={inputClass} maxLength={100} value={block.title ?? ''} onChange={(event) => updateBlock(section, block.id, { title: event.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Feature description
                        <textarea className={inputClass + ' min-h-20 p-2'} maxLength={500} value={block.body ?? ''} onChange={(event) => updateBlock(section, block.id, { body: event.target.value })} />
                      </label>
                    </div>
                  ) : null}
                  {block.kind === 'image' ? (
                    <label className="mt-2 grid gap-1 text-xs text-[var(--cf-text-muted)]">Managed public image
                      <select className={inputClass} value={block.mediaSlot} onChange={(event) => updateBlock(section, block.id, { mediaSlot: event.target.value as typeof block.mediaSlot })}>
                        <option value={`landing.composer.${block.id}`}>Image owned by this block (upload after saving)</option>
                        {HOMEPAGE_COMPOSER_MEDIA_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                      </select>
                      <span>Upload or replace this image in Owner → Public images; never use an unreviewed private account screenshot.</span>
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['heading', 'text', 'feature', 'image', 'button'] as const).map((kind) => (
                <Button key={kind} type="button" variant="outline" size="sm"
                  disabled={section.blocks.length >= MAX_HOMEPAGE_SECTION_BLOCKS}
                  onClick={() => setSection(section.id, { ...section, blocks: [...section.blocks, initialBlock(kind)] })}>
                  <Plus className="mr-1 h-3 w-3" /> {kind}
                </Button>
              ))}
            </div>
          </section>
        );
      })}
    </article>
  );
}
