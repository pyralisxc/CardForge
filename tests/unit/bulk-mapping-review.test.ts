import { describe, expect, it } from 'vitest';

import { getBulkHeaderRowIdentity } from '@/features/card-generator/lib/bulkMappingReview';

describe('bulk mapping review header identity', () => {
  it('keeps duplicate CSV header rows unique while preserving the visible header text', () => {
    const headers = ['Rank', 'Rank', 'Center Mark'];

    const identities = headers.map((header, index) => getBulkHeaderRowIdentity(header, index));

    expect(identities.map((identity) => identity.key)).toEqual([
      'Rank-0',
      'Rank-1',
      'Center Mark-2',
    ]);
    expect(new Set(identities.map((identity) => identity.inputId)).size).toBe(headers.length);
    expect(identities.map((identity) => identity.label)).toEqual(headers);
  });
});
