import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { createDefaultHomepageShowcaseExamples } from '@/features/public-site/model/examples';
import { matchesHomepageShowcaseTemplatePin } from '@/features/public-site/components/FinishedSetShowcase';

const template = {
  id: 'published-template',
  name: 'Published Template',
  aspectRatio: '63:88',
  templateRevision: 4,
  templateRevisionId: 'revision-4',
} as TCGCardTemplate;

describe('homepage showcase Template revision pins', () => {
  it('matches only the exact asset revision the Owner approved', () => {
    expect(matchesHomepageShowcaseTemplatePin(template, {
      templateId: 'published-template',
      revision: 4,
      revisionId: 'revision-4',
    })).toBe(true);

    expect(matchesHomepageShowcaseTemplatePin(template, {
      templateId: 'published-template',
      revision: 3,
      revisionId: 'revision-3',
    })).toBe(false);

    expect(matchesHomepageShowcaseTemplatePin(template, {
      templateId: 'other-template',
      revision: 4,
      revisionId: 'revision-4',
    })).toBe(false);

    expect(matchesHomepageShowcaseTemplatePin(template, {
      templateId: 'published-template',
      revision: null,
    })).toBe(false);
  });

  it('pins checked-in default demonstrations to their bootstrap revision', () => {
    const examples = createDefaultHomepageShowcaseExamples();
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.every((example) => example.frontTemplateRevision === 1)).toBe(true);
    expect(examples
      .filter((example) => example.backTemplateId)
      .every((example) => example.backTemplateRevision === 1)).toBe(true);
  });
});
