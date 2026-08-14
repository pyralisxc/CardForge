import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CARDFORGE_EXAMPLES } from '@/features/public-site/client';

const readSource = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const SHIPPED_TEMPLATE_IDS = new Set([
  'default-playing-card-theme',
  'default-mtg-theme',
  'default-event-badge-theme',
  'default-cardforge-studio-back-poker',
  'default-obsidian-neon-card-back',
]);

describe('public examples', () => {
  it('publishes a small uniquely addressable first-party demonstration catalog', () => {
    expect(CARDFORGE_EXAMPLES.length).toBeGreaterThanOrEqual(2);

    const slugs = CARDFORGE_EXAMPLES.map((example) => example.slug);
    expect(slugs.every((slug) => slug.trim().length > 0)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const example of CARDFORGE_EXAMPLES) {
      expect(example.name.trim()).not.toBe('');
      expect(example.description).toMatch(/CardForge demonstration/i);
      expect(example.systemType.trim()).not.toBe('');
      expect(example.caseStudy.summary.trim()).not.toBe('');
      expect(example.caseStudy.workflow.length).toBeGreaterThan(0);
    }
  });

  it('mechanically derives every exact claimed count from reviewed rows', () => {
    for (const example of CARDFORGE_EXAMPLES) {
      expect(example.cardCount).toBe(example.rows.length);
      expect(example.rows.length).toBeGreaterThan(0);
      for (const row of example.rows) {
        expect(Object.keys(row).length).toBeGreaterThan(0);
        expect(Object.values(row).every((value) => value.trim().length > 0)).toBe(true);
      }
    }
  });

  it('references only the approved runtime templates and includes a shared card back', () => {
    for (const example of CARDFORGE_EXAMPLES) {
      expect(SHIPPED_TEMPLATE_IDS.has(example.frontTemplateId)).toBe(true);
      if (example.backTemplateId) {
        expect(SHIPPED_TEMPLATE_IDS.has(example.backTemplateId)).toBe(true);
      }
    }

    expect(CARDFORGE_EXAMPLES.some((example) => (
      example.backTemplateId === 'default-cardforge-studio-back-poker'
    ))).toBe(true);
  });

  it('states source/output facts and useful alternative text without customer claims', () => {
    for (const example of CARDFORGE_EXAMPLES) {
      expect(example.sourceFormat.trim()).not.toBe('');
      expect(example.outputFormats.length).toBeGreaterThan(0);
      expect(example.outputFormats.every((format) => format.trim().length > 0)).toBe(true);
      expect(example.altText.rows).toHaveLength(example.cardCount);
      expect(example.altText.rows.every((text) => text.trim().length > 0)).toBe(true);
      if (example.backTemplateId) expect(example.altText.back?.trim()).not.toBe('');
      expect(example).not.toHaveProperty('customer');
      expect(example).not.toHaveProperty('testimonial');
    }
  });

  it('resolves runtime templates and renders the homepage proof with the production card renderer', () => {
    const liveGallery = readSource('src/features/public-site/components/LiveExampleGallery.tsx');
    const heroProof = readSource('src/features/public-site/components/ExampleHeroProof.tsx');
    const model = readSource('src/features/public-site/model/examples.ts');

    expect(liveGallery).toContain("fetch('/api/templates'");
    expect(liveGallery).toMatch(/live card rendering is temporarily unavailable/i);
    expect(liveGallery).not.toContain('ExampleSetGallery');
    expect(heroProof).toContain("from '@/features/card-rendering/client'");
    expect(heroProof).toContain('<CardPreview');
    expect(heroProof).toContain('createBulkDisplayCards');
    expect(heroProof).toContain('<figure');
    expect(model).not.toContain('data/default-templates');
    expect(model).not.toContain('freeformCanvas');
  });

  it('does not retain page-only gallery components after the route is removed', () => {
    expect(() => readSource('src/features/public-site/components/ExampleCardSet.tsx')).toThrow();
    expect(() => readSource('src/features/public-site/components/ExampleSetGallery.tsx')).toThrow();
  });
});
