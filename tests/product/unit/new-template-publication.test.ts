import { describe, expect, it } from 'vitest';

import { normalizeContentTaxonomyTags } from '@/features/pipeline/lib/contentTaxonomy';
import { createNewSharedTemplateId } from '@/features/pipeline/lib/pipelineRegistryCommands';

describe('new Template publication', () => {
  it('creates a stable contributor-owned shared id without trusting a local id as the public id', () => {
    const input = {
      contributorId: 'contributor-1',
      localTemplateId: 'draft-local-1',
      name: 'Summer Event Poster',
    };
    const first = createNewSharedTemplateId(input);
    expect(createNewSharedTemplateId(input)).toBe(first);
    expect(first).toMatch(/^community-summer-event-poster-[a-f0-9]{12}$/);
    expect(createNewSharedTemplateId({ ...input, contributorId: 'contributor-2' })).not.toBe(first);
  });

  it('normalizes only contributor-supplied taxonomy', () => {
    expect(normalizeContentTaxonomyTags(' Games, Event Poster, games, TCG! ')).toEqual([
      'games',
      'event-poster',
      'tcg',
    ]);
    expect(normalizeContentTaxonomyTags(undefined)).toEqual([]);
  });
});
