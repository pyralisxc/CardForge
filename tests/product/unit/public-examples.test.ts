import { describe, expect, it } from 'vitest';

import { CARDFORGE_EXAMPLES } from '@/features/public-site/client';

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

});
