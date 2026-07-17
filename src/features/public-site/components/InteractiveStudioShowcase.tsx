"use client";

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, LayoutTemplate, Layers3 } from 'lucide-react';

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

const generatorScreenshots = {
  single: {
    src: '/card-assets/showcase/studio-generator-single.jpg',
    alt: 'The real CardForge Generator showing the front and back setup followed by two-column Single Output fields.',
    width: 869,
    height: 1536,
  },
  bulk: {
    src: '/card-assets/showcase/studio-generator-bulk.jpg',
    alt: 'The real CardForge Generator showing the Bulk Import workflow followed by the generated-output review area.',
    width: 904,
    height: 1536,
  },
} as const;

function StudioScreenshot({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <div
      className="max-h-[46rem] overflow-y-auto rounded-[var(--public-radius)] border border-[#3b2b19] bg-[#070707]"
      tabIndex={0}
      aria-label={`${alt} Scroll to see the entire screenshot.`}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(min-width: 1280px) 1180px, 94vw"
        className="h-auto w-full"
      />
    </div>
  );
}

export function InteractiveStudioShowcase() {
  const [templates, setTemplates] = useState<readonly TCGCardTemplate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [activeGeneratorView, setActiveGeneratorView] = useState<'single' | 'bulk'>('single');
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

          {activeStage === 1 ? (
            <div className="border-b border-[#302315] bg-[#100d09] px-3 py-3">
              <p className="sr-only">Choose a Generator view</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Generator screenshot">
                {(['single', 'bulk'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={activeGeneratorView === view}
                    onClick={() => setActiveGeneratorView(view)}
                    className={`min-h-11 rounded-[var(--public-radius)] border px-4 text-base font-semibold ${
                      activeGeneratorView === view
                        ? 'border-[var(--public-brass)] bg-[#281b0e] text-[var(--public-ivory)]'
                        : 'border-[#3b2b19] text-[var(--public-muted-text)] hover:border-[#76501f]'
                    }`}
                  >
                    {view === 'single' ? 'Single Output' : 'Bulk Import'}
                  </button>
                ))}
              </div>
            </div>
          ) : activeStage === 2 ? (
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
          ) : null}

          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`showcase-tab-${activeStage}`}
            className="min-h-[30rem] bg-[radial-gradient(circle_at_top,#2a1a0c_0%,#11100d_45%,#090806_100%)] p-3 sm:p-5"
          >
            {activeStage === 0 ? (
              <StudioScreenshot
                src="/card-assets/showcase/studio-layout.jpg"
                alt="The real CardForge Layout Studio with its template library, editable canvas, layers, controls, and field inspector."
                width={1119}
                height={1536}
              />
            ) : activeStage === 1 ? (
              <StudioScreenshot {...generatorScreenshots[activeGeneratorView]} />
            ) : loadFailed ? (
              <div role="status" className="grid min-h-[25rem] place-items-center text-center text-base text-[var(--public-muted-text)]">
                The finished-set preview is temporarily unavailable. The complete demonstration sets remain on the Examples page.
              </div>
            ) : !templates || !frontTemplate ? (
              <div role="status" className="grid min-h-[25rem] place-items-center text-base text-[var(--public-muted-text)]">
                Loading the real CardForge templates…
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
            <span>{activeStage === 2 ? 'Real CardForge templates and rendering' : 'Actual CardForge Studio screenshot'}</span>
            <span>{reducedMotion ? 'Click to move between views' : 'Moves every 12 seconds · interaction pauses for one minute'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
