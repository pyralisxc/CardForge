"use client";

import { Images, Layers3 } from 'lucide-react';
import { useCallback, useEffect, useState, type ComponentType } from 'react';

import {
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
} from '@/features/public-site/model/siteMedia';
import { getSiteMediaFrameAspectRatio, ResponsiveSiteMediaImage } from './ResponsiveSiteMediaImage';
import type { HomepageShowcaseStage } from '../model/homepageShowcaseStages';
import {
  createDefaultHomepageShowcaseExamples,
  type HomepageShowcaseExample,
} from '../model/examples';
import {
  getNextShowcaseStage,
  getShowcaseAdvanceDelay,
  INTERACTION_PAUSE_MS,
} from '../model/showcaseTiming';
import { useSiteContent } from './PublicSitePresentationContext';
import { useBrandPresentation } from '@/features/brand-presentation/client';

type FinishedSetComponent = ComponentType<{ example: HomepageShowcaseExample }>;

function StudioScreenshot({
  media,
}: {
  media: SiteMediaAsset;
}) {
  const alt = media.alt;
  const width = media.width ?? 1600;
  const height = media.height ?? 1200;
  const frameAspectRatio = getSiteMediaFrameAspectRatio(media.presentation);
  const mobileWidthClass = {
    compact: 'max-w-[84%]',
    standard: 'max-w-[92%]',
    large: 'max-w-full',
  }[media.presentation.mobileSize];
  const desktopWidthClass = {
    compact: 'md:max-w-3xl',
    standard: 'md:max-w-5xl',
    large: 'md:max-w-full',
  }[media.presentation.desktopSize];
  return (
    <div
      className={`mx-auto rounded-[var(--public-radius)] border border-[#3b2b19] bg-[#070707] ${frameAspectRatio ? 'overflow-hidden' : 'max-h-[46rem] overflow-y-auto'} ${mobileWidthClass} ${desktopWidthClass}`}
      tabIndex={frameAspectRatio ? undefined : 0}
      aria-label={frameAspectRatio ? alt : `${alt} Scroll to see the entire screenshot.`}
    >
      {frameAspectRatio ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: frameAspectRatio }}>
          <ResponsiveSiteMediaImage
            media={media}
            fill
            sizes="(min-width: 1280px) 1119px, (min-width: 640px) calc(100vw - 6.5rem), calc(100vw - 4rem)"
          />
        </div>
      ) : (
        <ResponsiveSiteMediaImage
          media={media}
          width={width}
          height={height}
          sizes="(min-width: 1280px) 1119px, (min-width: 640px) calc(100vw - 6.5rem), calc(100vw - 4rem)"
          className="h-auto w-full"
        />
      )}
    </div>
  );
}

export function InteractiveStudioShowcase({
  layoutMedia = getDefaultSiteMedia('landing.showcase.layout'),
  generatorSingleMedia = getDefaultSiteMedia('landing.showcase.generator-single'),
  generatorBulkMedia = getDefaultSiteMedia('landing.showcase.generator-bulk'),
  mediaAssets = [],
  stages: configuredStages,
  examples = createDefaultHomepageShowcaseExamples(),
}: {
  layoutMedia?: SiteMediaAsset;
  generatorSingleMedia?: SiteMediaAsset;
  generatorBulkMedia?: SiteMediaAsset;
  mediaAssets?: SiteMediaAsset[];
  stages?: HomepageShowcaseStage[];
  examples?: HomepageShowcaseExample[];
}) {
  const siteContent = useSiteContent();
  const brand = useBrandPresentation();
  // Absence of Owner stages is an intentional compatibility mode: existing
  // published copy controls still determine the original three-stage walkthrough.
  const legacyStages: HomepageShowcaseStage[] = [
    { id: 'templates', label: siteContent['landing.showcase.stage.templates'], kind: 'screenshots',
      views: [{ label: 'Template Studio', mediaSlot: 'landing.showcase.layout' }] },
    { id: 'make', label: siteContent['landing.showcase.stage.make'], kind: 'screenshots',
      views: [
        { label: siteContent['landing.showcase.generator.single'], mediaSlot: 'landing.showcase.generator-single' },
        { label: siteContent['landing.showcase.generator.bulk'], mediaSlot: 'landing.showcase.generator-bulk' },
      ] },
    { id: 'review', label: siteContent['landing.showcase.stage.review'], kind: 'rendered-set' },
  ];
  const stages = configuredStages?.length ? configuredStages : legacyStages;
  const [activeStage, setActiveStage] = useState(0);
  const [activeView, setActiveView] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [FinishedSetShowcase, setFinishedSetShowcase] = useState<FinishedSetComponent | null>(null);
  const [finishedSetLoadFailed, setFinishedSetLoadFailed] = useState(false);
  const configuredExamples = examples.filter((example) => example.visible);
  const visibleExamples = configuredExamples.length ? configuredExamples : createDefaultHomepageShowcaseExamples();
  const currentStage = stages[activeStage] ?? stages[0]!;
  const currentViews = currentStage.kind === 'screenshots' ? (currentStage.views ?? []) : [];
  const selectedView = currentViews[activeView] ?? currentViews[0];
  const legacyMedia = [layoutMedia, generatorSingleMedia, generatorBulkMedia];
  const selectedMedia = selectedView
    ? mediaAssets.find((asset) => asset.slot === selectedView.mediaSlot)
      ?? legacyMedia.find((asset) => asset.slot === selectedView.mediaSlot)
      ?? getDefaultSiteMedia(selectedView.mediaSlot)
    : null;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (activeStage >= stages.length) setActiveStage(0);
  }, [activeStage, stages.length]);

  useEffect(() => {
    if (activeExample >= visibleExamples.length) setActiveExample(0);
  }, [activeExample, visibleExamples.length]);

  useEffect(() => {
    const delay = getShowcaseAdvanceDelay({ now: Date.now(), pauseUntil, reducedMotion });
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      setActiveStage((current) => getNextShowcaseStage(current, stages.length));
      setActiveView(0);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeStage, pauseUntil, reducedMotion, stages.length]);

  useEffect(() => {
    if (currentStage.kind !== 'rendered-set' || FinishedSetShowcase || finishedSetLoadFailed) return;
    let cancelled = false;
    void import('./FinishedSetShowcase')
      .then((module) => { if (!cancelled) setFinishedSetShowcase(() => module.FinishedSetShowcase); })
      .catch(() => { if (!cancelled) setFinishedSetLoadFailed(true); });
    return () => { cancelled = true; };
  }, [FinishedSetShowcase, currentStage.kind, finishedSetLoadFailed]);

  const pauseAutomaticMovement = useCallback(() => {
    setPauseUntil(Date.now() + INTERACTION_PAUSE_MS);
  }, []);
  const example = visibleExamples[activeExample] ?? visibleExamples[0]!;
  const panelId = 'showcase-stage-panel';

  return (
    <section
      id="interactive-showcase"
      aria-labelledby="interactive-showcase-heading"
      className="cardforge-public-deferred-section scroll-mt-6 border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-14"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">{siteContent['landing.showcase.eyebrow']}</p>
          <h2 id="interactive-showcase-heading" className="mt-2 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">{siteContent['landing.showcase.headline']}</h2>
          <p className="mt-3 text-lg leading-8 text-[var(--public-muted-text)]">{siteContent['landing.showcase.body']}</p>
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
              <strong className="ml-1 font-[var(--public-font-display)] text-base text-[var(--public-ivory)]">{brand.brandName}</strong>
            </div>
            <div role="tablist" aria-label="CardForge product walkthrough" className="flex max-w-full gap-1 overflow-x-auto rounded-[var(--public-radius)] border border-[#3b2b19] bg-[#0f0c08] p-1">
              {stages.map((stage, index) => {
                const Icon = stage.kind === 'rendered-set' ? Layers3 : Images;
                return (
                  <button
                    key={stage.id}
                    id={`showcase-tab-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={activeStage === index}
                    aria-controls={panelId}
                    onClick={() => { setActiveStage(index); setActiveView(0); }}
                    className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--public-radius)] px-3 text-sm font-bold transition-colors sm:text-base ${activeStage === index
                      ? 'bg-[var(--public-brass)] text-[var(--public-obsidian)]'
                      : 'text-[var(--public-muted-text)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--public-ivory)]'}`}
                  >
                    <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />{stage.label}
                  </button>
                );
              })}
            </div>
          </div>
          {currentStage.description ? (
            <p className="border-b border-[#302315] bg-[#100d09] px-5 py-3 text-sm leading-6 text-[var(--public-muted-text)]">{currentStage.description}</p>
          ) : null}

          {currentStage.kind === 'screenshots' && currentViews.length > 1 ? (
            <div className="border-b border-[#302315] bg-[#100d09] px-3 py-3">
              <p className="sr-only">Choose a walkthrough screenshot</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Walkthrough screenshots">
                {currentViews.map((view, index) => (
                  <button key={view.mediaSlot} type="button" aria-pressed={activeView === index}
                    onClick={() => setActiveView(index)}
                    className={`min-h-11 rounded-[var(--public-radius)] border px-4 text-base font-semibold ${activeView === index
                      ? 'border-[var(--public-brass)] bg-[#281b0e] text-[var(--public-ivory)]'
                      : 'border-[#3b2b19] text-[var(--public-muted-text)] hover:border-[#76501f]'}`}
                  >{view.label}</button>
                ))}
              </div>
            </div>
          ) : currentStage.kind === 'rendered-set' ? (
            <div className="border-b border-[#302315] bg-[#100d09] px-3 py-3">
              <p className="sr-only">Choose a demonstration set</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {visibleExamples.map((candidate, index) => (
                  <button key={candidate.slug} type="button" aria-pressed={activeExample === index}
                    onClick={() => setActiveExample(index)}
                    className={`min-h-11 shrink-0 rounded-[var(--public-radius)] border px-4 text-left text-base font-semibold ${activeExample === index
                      ? 'border-[var(--public-brass)] bg-[#281b0e] text-[var(--public-ivory)]'
                      : 'border-[#3b2b19] text-[var(--public-muted-text)] hover:border-[#76501f]'}`}
                  >{candidate.name}</button>
                ))}
              </div>
            </div>
          ) : null}

          <div id={panelId} role="tabpanel" aria-labelledby={`showcase-tab-${activeStage}`}
            className="bg-[radial-gradient(circle_at_top,#2a1a0c_0%,#11100d_45%,#090806_100%)] p-3 sm:p-5">
            {currentStage.kind === 'screenshots' ? (
              selectedMedia && getSiteMediaDisplaySrc(selectedMedia)
                ? <StudioScreenshot media={selectedMedia} />
                : <div role="status" className="grid min-h-[25rem] place-items-center text-center text-base text-[var(--public-muted-text)]">A screenshot has not yet been published for this walkthrough view.</div>
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
            <span>{(currentStage.kind === 'rendered-set'
              ? siteContent['landing.showcase.footer.rendering']
              : siteContent['landing.showcase.footer.screenshot']).replaceAll('{brand}', brand.brandName)}</span>
            <span>{reducedMotion ? siteContent['landing.showcase.footer.reduced'] : siteContent['landing.showcase.footer.auto']}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
