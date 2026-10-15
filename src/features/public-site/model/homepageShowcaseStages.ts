import type { SiteMediaSlot } from './siteMedia';

/**
 * Owner-configurable storytelling, not arbitrary executable page composition.
 * Image sources are existing Owner-controlled media slots, never remote URLs.
 */
export const HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS = [
  'landing.showcase.layout',
  'landing.showcase.generator-single',
  'landing.showcase.generator-bulk',
] as const satisfies readonly SiteMediaSlot[];

export type HomepageShowcaseScreenshotSlot = typeof HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS[number];

export interface HomepageShowcaseView {
  label: string;
  mediaSlot: HomepageShowcaseScreenshotSlot;
}

export interface HomepageShowcaseStage {
  id: string;
  label: string;
  kind: 'screenshots' | 'rendered-set';
  description?: string;
  views?: HomepageShowcaseView[];
}

export const MAX_HOMEPAGE_SHOWCASE_STAGES = 6;
export const MAX_HOMEPAGE_STAGE_VIEWS = 3;

// Used only while no explicit Owner stages have ever been published.
export const DEFAULT_HOMEPAGE_SHOWCASE_STAGES: HomepageShowcaseStage[] = [
  { id: 'templates', label: 'Templates', kind: 'screenshots',
    views: [{ label: 'Template Studio', mediaSlot: 'landing.showcase.layout' }] },
  { id: 'make', label: 'Make cards', kind: 'screenshots',
    views: [
      { label: 'Make one card', mediaSlot: 'landing.showcase.generator-single' },
      { label: 'Use a list', mediaSlot: 'landing.showcase.generator-bulk' },
    ] },
  { id: 'review', label: 'Review the set', kind: 'rendered-set' },
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const parseHomepageShowcaseStages = (value: unknown): HomepageShowcaseStage[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_HOMEPAGE_SHOWCASE_STAGES) return null;
  const stages: HomepageShowcaseStage[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || Object.keys(candidate).some((key) => !['id', 'label', 'kind', 'description', 'views'].includes(key))) return null;
    const id = candidate.id;
    const label = candidate.label;
    const kind = candidate.kind;
    const description = candidate.description;
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/u.test(id)
      || typeof label !== 'string' || !label.trim() || label.trim().length > 60
      || (kind !== 'screenshots' && kind !== 'rendered-set')
      || (description !== undefined && (typeof description !== 'string' || description.length > 220))) return null;
    if (stages.some((stage) => stage.id === id)) return null;
    const parsed: HomepageShowcaseStage = { id, label: label.trim(), kind };
    if (typeof description === 'string' && description.trim()) parsed.description = description.trim();
    if (kind === 'screenshots') {
      if (!Array.isArray(candidate.views) || candidate.views.length < 1 || candidate.views.length > MAX_HOMEPAGE_STAGE_VIEWS) return null;
      const views: HomepageShowcaseView[] = [];
      for (const view of candidate.views) {
        if (!isRecord(view) || Object.keys(view).some((key) => !['label', 'mediaSlot'].includes(key))
          || typeof view.label !== 'string' || !view.label.trim() || view.label.trim().length > 60
          || !HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS.includes(view.mediaSlot as HomepageShowcaseScreenshotSlot)
          || views.some((seen) => seen.mediaSlot === view.mediaSlot)) return null;
        views.push({ label: view.label.trim(), mediaSlot: view.mediaSlot as HomepageShowcaseScreenshotSlot });
      }
      parsed.views = views;
    } else if (candidate.views !== undefined) {
      return null;
    }
    stages.push(parsed);
  }
  return stages;
};

export const normalizeHomepageShowcaseStages = (value: unknown): HomepageShowcaseStage[] | undefined => (
  value === undefined ? undefined : (parseHomepageShowcaseStages(value) ?? undefined)
);

export const validateHomepageShowcaseStagesInput = (value: unknown): HomepageShowcaseStage[] => {
  const parsed = parseHomepageShowcaseStages(value);
  if (!parsed) throw new Error('Homepage walkthrough needs 1–6 unique stages. Screenshot stages require 1–3 named, approved image slots; rendered-set stages cannot reference external images.');
  return parsed;
};
