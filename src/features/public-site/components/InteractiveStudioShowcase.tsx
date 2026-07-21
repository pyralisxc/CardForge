"use client";

import Image from 'next/image';
import { Database, LayoutTemplate, Layers3 } from 'lucide-react';
import { useCallback, useEffect, useState, type ComponentType } from 'react';

import {
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
} from '@/features/public-site/model/siteMedia';
import { CARDFORGE_EXAMPLES, type CardForgeExample } from '../model/examples';
import {
  getNextShowcaseStage,
  getShowcaseAdvanceDelay,
  INTERACTION_PAUSE_MS,
} from '../model/showcaseTiming';

const stages = [
  { label: 'Design layouts', icon: LayoutTemplate },
  { label: 'Make cards', icon: Database },
  { label: 'Review the set', icon: Layers3 },
] as const;

type FinishedSetComponent = ComponentType<{ example: CardForgeExample }>;

function StudioScreenshot({
  media,
  width,
  height,
}: {
  media: SiteMediaAsset;
  width: number;
  height: number;
}) {
  const src = getSiteMediaDisplaySrc(media);
  const alt = media.alt;
  return (
    <div
      className="max-h-[46rem] overflow-y-auto rounded-[var(--public-radius)] border border-[#3b2b19] bg-[#070707]"
      tabIndex={0}
      aria-label={`${alt} Scroll to see the entire screenshot.`}
    >
      <div className="mx-auto" style={{ maxWidth: `${width}px` }}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(min-width: 1280px) 1119px, (min-width: 640px) calc(100vw - 6.5rem), calc(100vw - 4rem)"
          className="h-auto w-auto max-w-full"
        />
      </div>
    </div>
  );
}

export function InteractiveStudioShowcase({
  layoutMedia = getDefaultSiteMedia('landing.showcase.layout'),
  generatorSingleMedia = getDefaultSiteMedia('landing.showcase.generator-single'),
  generatorBulkMedia = getDefaultSiteMedia('landing.showcase.generator-bulk'),
}: {
  layoutMedia?: SiteMediaAsset;
  generatorSingleMedia?: SiteMediaAsset;
  generatorBulkMedia?: SiteMediaAsset;
}) {
  const [activeStage, setActiveStage] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [activeGeneratorView, setActiveGeneratorView] = useState<'single' | 'bulk'>('single');
  const [pauseUntil, setPauseUntil] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [FinishedSetShowcase, setFinishedSetShowcase] = useState<FinishedSetComponent | null>(null);
  const [finishedSetLoadFailed, setFinishedSetLoadFailed] = useState(false);

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

  useEffect(() => {
    if (activeStage !== 2 || FinishedSetShowcase || finishedSetLoadFailed) return;
    let cancelled = false;
    void import('./FinishedSetShowcase')
      .then((module) => {
        if (!cancelled) setFinishedSetShowcase(() => module.FinishedSetShowcase);
      })
      .catch(() => {
        if (!cancelled) setFinishedSetLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [FinishedSetShowcase, activeStage, finishedSetLoadFailed]);

  const pauseAutomaticMovement = useCallback(() => {
    setPauseUntil(Date.now() + INTERACTION_PAUSE_MS);
  }, []);

  const example = CARDFORGE_EXAMPLES[activeExample] ?? CARDFORGE_EXAMPLES[0];
  const panelId = 'showcase-stage-panel';
  const generatorMedia = activeGeneratorView === 'single' ? generatorSingleMedia : generatorBulkMedia;

  return (
    <section
      id="interactive-showcase"
      aria-labelledby="interactive-showcase-heading"
      className="cardforge-public-deferred-section scroll-mt-6 border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-14"
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
              <p className="sr-only">Choose how to make cards</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Card-making screenshot">
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
                    {view === 'single' ? 'Make one card' : 'Use a list'}
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
                media={layoutMedia}
                width={1119}
                height={1536}
              />
            ) : activeStage === 1 ? (
              <StudioScreenshot
                media={generatorMedia}
                width={activeGeneratorView === 'single' ? 869 : 904}
                height={1536}
              />
            ) : finishedSetLoadFailed ? (
              <div role="status" className="grid min-h-[25rem] place-items-center text-center text-base text-[var(--public-muted-text)]">
                The finished-set preview is temporarily unavailable. You can still explore the Studio screenshots.
              </div>
            ) : FinishedSetShowcase ? (
              <FinishedSetShowcase example={example} />
            ) : (
              <div role="status" className="grid min-h-[25rem] place-items-center text-base text-[var(--public-muted-text)]">
                Preparing the finished-set preview…
              </div>
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
