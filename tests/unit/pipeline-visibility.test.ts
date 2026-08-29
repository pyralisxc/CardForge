import { describe, expect, it } from 'vitest';

import { isPipelineRevisionVisibleToContributor } from '@/features/developer-assets/lib/pipelineVisibility';
import { parsePipelineLineageIds } from '@/features/developer-assets/lib/pipelineHearts';

describe('Pipeline revision visibility', () => {
  const visible = (overrides: Partial<Parameters<typeof isPipelineRevisionVisibleToContributor>[0]> = {}) => (
    isPipelineRevisionVisibleToContributor({
      developerId: 'author',
      status: 'voting',
      purgeState: null,
      viewerId: 'reviewer',
      contributor: true,
      owner: false,
      ...overrides,
    })
  );

  it('shows ordinary review revisions but hides another contributor draft and rejection', () => {
    expect(visible()).toBe(true);
    expect(visible({ status: 'draft' })).toBe(false);
    expect(visible({ status: 'rejected' })).toBe(false);
  });

  it('keeps an author own lifecycle visible and lets the owner inspect every active revision', () => {
    expect(visible({ viewerId: 'author', status: 'draft' })).toBe(true);
    expect(visible({ owner: true, contributor: true, status: 'rejected' })).toBe(true);
  });

  it('hides purging revisions and contributor-only records from normal accounts', () => {
    expect(visible({ purgeState: 'pending', owner: true })).toBe(false);
    expect(visible({ contributor: false })).toBe(false);
  });
});

describe('Pipeline lineage request validation', () => {
  const lineageId = '123e4567-e89b-42d3-a456-426614174000';

  it('deduplicates valid lineage IDs without silently accepting malformed input', () => {
    expect(parsePipelineLineageIds([lineageId, lineageId])).toEqual({ lineageIds: [lineageId], valid: true });
    expect(parsePipelineLineageIds(['not-a-lineage'])).toEqual({ lineageIds: [], valid: false });
  });

  it('enforces the explicit bulk request ceiling', () => {
    expect(parsePipelineLineageIds(Array.from({ length: 251 }, () => lineageId))).toEqual({ lineageIds: [], valid: false });
  });
});
