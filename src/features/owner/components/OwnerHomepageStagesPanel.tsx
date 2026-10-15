"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_HOMEPAGE_SHOWCASE_STAGES,
  HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS,
  MAX_HOMEPAGE_SHOWCASE_STAGES,
  type HomepageShowcaseStage,
} from '@/features/public-site/client';

const inputClass = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]';
const mediaLabel: Record<(typeof HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS)[number], string> = {
  'landing.showcase.layout': 'Template Studio screenshot',
  'landing.showcase.generator-single': 'Single-card Studio screenshot',
  'landing.showcase.generator-bulk': 'Card list Studio screenshot',
};
const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export function OwnerHomepageStagesPanel({ stages, onChange }: {
  stages?: HomepageShowcaseStage[];
  onChange: (stages: HomepageShowcaseStage[]) => void;
}) {
  // Merely opening Site settings does not publish an alternative to legacy copy.
  const current = stages ?? DEFAULT_HOMEPAGE_SHOWCASE_STAGES;
  const update = (index: number, patch: Partial<HomepageShowcaseStage>) => {
    onChange(current.map((step, position) => position === index ? { ...step, ...patch } : step));
  };
  const add = () => {
    if (current.length >= MAX_HOMEPAGE_SHOWCASE_STAGES) return;
    const seed = `stage-${Date.now().toString(36)}`;
    let id = seed;
    let index = 2;
    while (current.some((stage) => stage.id === id)) id = `${seed}-${index++}`;
    onChange([...current, {
      id, label: 'New walkthrough step', kind: 'screenshots',
      views: [{ label: 'Screenshot', mediaSlot: 'landing.showcase.layout' }],
    }]);
  };
  return (
    <article className="space-y-4 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Homepage walkthrough</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
            Reorder and describe up to six stages. Screenshot stages reference approved Owner media slots; finished-Set stages reuse the demonstration Sets below. The same settings are editable by the Owner MCP.
          </p>
          {!stages ? <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">Using the original published walkthrough copy until you make and publish a stage change.</p> : null}
        </div>
        <Button type="button" variant="outline" disabled={current.length >= MAX_HOMEPAGE_SHOWCASE_STAGES} onClick={add}>
          <Plus className="mr-2 h-4 w-4" /> Add stage
        </Button>
      </div>
      <div className="space-y-3">
        {current.map((stage, index) => (
          <section key={stage.id} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--cf-accent-text)]">Stage {index + 1}</span>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="outline" aria-label={`Move stage ${index + 1} up`} disabled={index === 0} onClick={() => onChange(move(current, index, -1))}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="outline" aria-label={`Move stage ${index + 1} down`} disabled={index === current.length - 1} onClick={() => onChange(move(current, index, 1))}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove stage ${index + 1}`} disabled={current.length <= 1} onClick={() => onChange(current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">Stage label
                <input className={inputClass} maxLength={60} value={stage.label} onChange={(event) => update(index, { label: event.target.value })} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">Stage presentation
                <select className={inputClass} value={stage.kind} onChange={(event) => {
                  const kind = event.target.value as HomepageShowcaseStage['kind'];
                  update(index, { kind, views: kind === 'screenshots' ? (stage.views?.length ? stage.views : [
                    { label: 'Screenshot', mediaSlot: 'landing.showcase.layout' },
                  ]) : undefined });
                }}>
                  <option value="screenshots">Screenshots</option>
                  <option value="rendered-set">Live rendered Set</option>
                </select>
              </label>
            </div>
            <label className="mt-3 grid gap-1 text-sm text-[var(--cf-text-muted)]">Short introduction (optional)
              <textarea className={inputClass + ' min-h-24 p-3'} maxLength={220} value={stage.description ?? ''} onChange={(event) => update(index, { description: event.target.value })} />
            </label>
            {stage.kind === 'screenshots' ? (
              <div className="mt-3 space-y-2">
                {(stage.views ?? []).map((view, viewIndex) => (
                  <div key={`${stage.id}-${viewIndex}`} className="grid gap-2 border border-[var(--cf-border)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">View label
                      <input className={inputClass} maxLength={60} value={view.label} onChange={(event) => update(index, {
                        views: stage.views!.map((item, i) => i === viewIndex ? { ...item, label: event.target.value } : item),
                      })} />
                    </label>
                    <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">Owner-managed screenshot slot
                      <select className={inputClass} value={view.mediaSlot} onChange={(event) => update(index, {
                        views: stage.views!.map((item, i) => i === viewIndex
                          ? { ...item, mediaSlot: event.target.value as typeof view.mediaSlot } : item),
                      })}>
                        {HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS.map((slot) => <option key={slot} value={slot} disabled={stage.views?.some((other, i) => i !== viewIndex && other.mediaSlot === slot)}>{mediaLabel[slot]}</option>)}
                      </select>
                    </label>
                    <Button type="button" size="icon" variant="outline" className="self-end" aria-label={`Remove screenshot ${viewIndex + 1} in stage ${index + 1}`}
                      disabled={(stage.views?.length ?? 0) <= 1}
                      onClick={() => update(index, { views: stage.views?.filter((_, i) => i !== viewIndex) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm"
                  disabled={(stage.views?.length ?? 0) >= HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS.length}
                  onClick={() => {
                    const available = HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS.find((slot) => !stage.views?.some((view) => view.mediaSlot === slot));
                    if (available) update(index, { views: [...(stage.views ?? []), { label: mediaLabel[available], mediaSlot: available }] });
                  }}>Add another screenshot view</Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--cf-text-subtle)]">Uses the existing exact-revision demonstration Sets; edit their Templates and card content below.</p>
            )}
          </section>
        ))}
      </div>
      <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">
        Actual screenshots are replaced in Owner → Public images. A stage selects an image slot; it never stores image bytes or imports private account data.
      </p>
    </article>
  );
}
