"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Database, LayoutTemplate, Layers3, SlidersHorizontal } from 'lucide-react';

import { extractTemplateFieldDefinitions, type TCGCardTemplate } from '@/domain/templates';
import { createBulkDisplayCards } from '@/features/card-generator/client';
import { CardPreview } from '@/features/card-rendering/client';
import { CARDFORGE_EXAMPLES, type CardForgeExample } from '../model/examples';
import {
  getNextShowcaseStage,
  getShowcaseAdvanceDelay,
  INTERACTION_PAUSE_MS,
} from '../model/showcaseTiming';

interface TemplatesPayload {
  defaults?: TCGCardTemplate[];
}

const stages = [
  { label: 'Layout Studio', icon: LayoutTemplate },
  { label: 'Generator', icon: Database },
  { label: 'Finished Sets', icon: Layers3 },
] as const;

const buildRows = (example: CardForgeExample): string[][] => {
  const headers = Array.from(new Set(example.rows.flatMap((row) => Object.keys(row))));
  return [headers, ...example.rows.map((row) => headers.map((header) => row[header] ?? ''))];
};

const rowLabel = (row: CardForgeExample['rows'][number], index: number): string => (
  row.CardTitle || row.CardName || row.AttendeeName || `Card ${index + 1}`
);

export function InteractiveStudioShowcase() {
  const [templates, setTemplates] = useState<readonly TCGCardTemplate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/templates', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Template catalog returned ${response.status}.`);
        return response.json() as Promise<TemplatesPayload>;
      })
      .then((payload) => setTemplates(Array.isArray(payload.defaults) ? payload.defaults : []))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const delay = getShowcaseAdvanceDelay({
      now: Date.now(),
      pauseUntil,
      reducedMotion,
    });
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      setActiveStage((current) => getNextShowcaseStage(current, stages.length));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeStage, pauseUntil, reducedMotion]);

  const pauseAutomaticMovement = useCallback(() => {
    setPauseUntil(Date.now() + INTERACTION_PAUSE_MS);
  }, []);

  const example = CARDFORGE_EXAMPLES[activeExample] ?? CARDFORGE_EXAMPLES[0];
  const frontTemplate = templates?.find((template) => template.id === example.frontTemplateId);
  const backTemplate = example.backTemplateId
    ? templates?.find((template) => template.id === example.backTemplateId)
    : undefined;

  const cards = useMemo(() => {
    if (!frontTemplate) return [];
    const rows = buildRows(example);
    const headers = rows[0] ?? [];
    return createBulkDisplayCards({
      template: frontTemplate,
      backingTemplate: backTemplate,
      fieldDefinitions: extractTemplateFieldDefinitions(frontTemplate),
      rows,
      columnMapping: Object.fromEntries(headers.map((header) => [header, header])),
      createId: (rowNumber) => `${example.slug}-showcase-${rowNumber}`,
    });
  }, [backTemplate, example, frontTemplate]);

  const panelId = 'showcase-stage-panel';

  return (
    <section
      aria-labelledby="interactive-showcase-heading"
      className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-14"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">Look inside CardForge</p>
          <h2 id="interactive-showcase-heading" className="mt-2 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            Design the look, build the set, and see every finished card.
          </h2>
          <p className="mt-3 text-lg leading-8 text-[var(--public-muted-text)]">
            This walkthrough uses CardForge’s real templates, sample rows, and card renderer. Choose any step or set inside the Studio frame.
          </p>
        </div>

        <div
          className="mt-7 overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[#090806] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.5)]"
          onPointerDownCapture={pauseAutomaticMovement}
          onKeyDownCapture={pauseAutomaticMovement}
          onFocusCapture={pauseAutomaticMovement}
        >
          <div className="flex flex-col gap-3 border-b border-[var(--public-border)] bg-[var(--public-surface)] p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 px-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d7643b]" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--public-brass)]" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#78965b]" aria-hidden="true" />
              <strong className="ml-1 font-[var(--public-font-display)] text-base text-[var(--public-ivory)]">CardForge Studio</strong>
            </div>
            <div role="tablist" aria-label="CardForge product walkthrough" className="grid grid-cols-3 gap-1 rounded-[var(--public-radius)] border border-[#3b2b19] bg-[#0f0c08] p-1">
              {stages.map((stage, index) => (
                <button
                  key={stage.label}
                  id={`showcase-tab-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={activeStage === index}
                  aria-controls={panelId}
                  onClick={() => setActiveStage(index)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] px-3 text-base font-bold transition-colors ${
                    activeStage === index
                      ? 'bg-[var(--public-brass)] text-[var(--public-obsidian)]'
                      : 'text-[var(--public-muted-text)] hover:bg-[#21170d] hover:text-[var(--public-ivory)]'
                  }`}
                >
                  <stage.icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-[#302315] bg-[#100d09] px-3 py-3">
            <p className="sr-only">Choose a demonstration set</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CARDFORGE_EXAMPLES.map((candidate, index) => (
                <button
                  key={candidate.slug}
                  type="button"
                  aria-pressed={activeExample === index}
                  onClick={() => setActiveExample(index)}
                  className={`min-h-11 shrink-0 rounded-[var(--public-radius)] border px-4 text-left text-base font-semibold ${
                    activeExample === index
                      ? 'border-[var(--public-brass)] bg-[#281b0e] text-[var(--public-ivory)]'
                      : 'border-[#3b2b19] text-[var(--public-muted-text)] hover:border-[#76501f]'
                  }`}
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          </div>

          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`showcase-tab-${activeStage}`}
            className="min-h-[30rem] bg-[radial-gradient(circle_at_top,#2a1a0c_0%,#11100d_45%,#090806_100%)] p-3 sm:p-5"
          >
            {loadFailed ? (
              <div role="status" className="grid min-h-[25rem] place-items-center text-center text-base text-[var(--public-muted-text)]">
                The live Studio preview is temporarily unavailable. The complete demonstration sets remain on the Examples page.
              </div>
            ) : !templates || !frontTemplate ? (
              <div role="status" className="grid min-h-[25rem] place-items-center text-base text-[var(--public-muted-text)]">
                Loading the real CardForge templates…
              </div>
            ) : activeStage === 0 ? (
              <div className="grid min-h-[27rem] gap-3 md:grid-cols-[10rem_minmax(0,1fr)_12rem]">
                <aside className="hidden border border-[#3b2b19] bg-[#100d09] p-3 md:block" aria-label="Template library preview">
                  <p className="font-bold text-[var(--public-ivory)]">Templates</p>
                  {CARDFORGE_EXAMPLES.map((candidate, index) => (
                    <div key={candidate.slug} className={`mt-3 border-l-2 p-2 text-base ${index === activeExample ? 'border-[var(--public-brass)] bg-[#24190e] text-[var(--public-ivory)]' : 'border-transparent text-[var(--public-muted-text)]'}`}>
                      {candidate.systemType}
                    </div>
                  ))}
                </aside>
                <div className="grid place-items-center border border-[#3b2b19] bg-[#0d0b08] p-4">
                  {cards[0] ? (
                    <div role="img" aria-label={`${example.altText.rows[0]} Shown on the Layout Studio canvas.`} className="rounded-[var(--public-radius)] bg-[#21170d] p-2 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.55)]">
                      <CardPreview card={cards[0]} face="front" targetWidthPx={250} />
                    </div>
                  ) : null}
                </div>
                <aside className="border border-[#3b2b19] bg-[#100d09] p-3" aria-label="Field inspector preview">
                  <p className="flex items-center gap-2 font-bold text-[var(--public-ivory)]"><SlidersHorizontal className="h-4 w-4 text-[var(--public-brass)]" aria-hidden="true" /> Fields</p>
                  {Object.keys(example.rows[0] ?? {}).slice(0, 5).map((field) => (
                    <div key={field} className="mt-3 border-b border-[#352716] pb-3">
                      <p className="text-base text-[var(--public-muted-text)]">{field}</p>
                      <div className="mt-2 h-2 rounded-full bg-[#2b2117]" aria-hidden="true" />
                    </div>
                  ))}
                </aside>
              </div>
            ) : activeStage === 1 ? (
              <div className="grid min-h-[27rem] gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_12rem]">
                <aside className="border border-[#3b2b19] bg-[#100d09] p-3" aria-label="Generator rows preview">
                  <p className="font-bold text-[var(--public-ivory)]">Your card list</p>
                  {example.rows.map((row, index) => (
                    <div key={rowLabel(row, index)} className="mt-2 flex items-center gap-2 border border-[#352716] bg-[#17110b] p-2 text-base text-[var(--public-muted-text)]">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2a1c0e] text-[var(--public-brass)]">{index + 1}</span>
                      <span className="truncate">{rowLabel(row, index)}</span>
                    </div>
                  ))}
                </aside>
                <div className="grid grid-cols-2 gap-2 border border-[#3b2b19] bg-[#0d0b08] p-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {cards.slice(0, 4).map((card, index) => (
                    <div key={card.uniqueId} role="img" aria-label={`${example.altText.rows[index]} Generated card ${index + 1}.`} className="flex min-w-0 items-center justify-center rounded-[var(--public-radius)] bg-[#21170d] p-1.5">
                      <CardPreview card={card} face="front" targetWidthPx={150} />
                    </div>
                  ))}
                </div>
                <aside className="border border-[#3b2b19] bg-[#100d09] p-4" aria-label="Generation summary">
                  <Check className="h-7 w-7 text-[#88a96a]" aria-hidden="true" />
                  <p className="mt-3 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{cards.length} cards ready</p>
                  <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">One shared layout. Every row has its own content and artwork.</p>
                </aside>
              </div>
            ) : (
              <figure className="min-h-[27rem] border border-[#3b2b19] bg-[#0d0b08] p-4">
                <figcaption className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--public-brass)]">The finished set</p>
                    <h3 className="mt-1 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{example.name}</h3>
                  </div>
                  <p className="text-base text-[var(--public-muted-text)]">{cards.length} cards, one reusable template</p>
                </figcaption>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {cards.slice(0, 4).map((card, index) => (
                    <div key={card.uniqueId} role="img" aria-label={`${example.altText.rows[index]} Finished card ${index + 1}.`} className="flex min-w-0 justify-center rounded-[var(--public-radius)] bg-[#21170d] p-2">
                      <CardPreview card={card} face="front" targetWidthPx={190} />
                    </div>
                  ))}
                </div>
              </figure>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-3 text-base text-[var(--public-muted-text)]">
            <span>Real CardForge templates and rendering</span>
            <span>{reducedMotion ? 'Click to move between views' : 'Moves every 12 seconds · interaction pauses for one minute'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
