import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEGAL_DOCUMENTS,
  normalizeLegalDocumentInput,
} from '@/features/legal/client';

describe('legal document rules', () => {
  it('ships every public legal document', () => {
    expect(DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug)).toEqual([
      'privacy',
      'terms',
      'refund',
      'contact',
      'developer-terms',
      'creator-pool',
    ]);
  });

  it('accepts only known complete legal documents', () => {
    expect(normalizeLegalDocumentInput({
      slug: 'privacy',
      title: ' Privacy ',
      body: ' Updated privacy copy ',
    })).toEqual({
      ok: true,
      value: {
        slug: 'privacy',
        title: 'Privacy',
        body: 'Updated privacy copy',
      },
    });
    expect(normalizeLegalDocumentInput({
      slug: 'developer-terms',
      title: ' Developer Terms ',
      body: ' Contributor policy ',
    })).toEqual({
      ok: true,
      value: {
        slug: 'developer-terms',
        title: 'Developer Terms',
        body: 'Contributor policy',
      },
    });
    expect(normalizeLegalDocumentInput({
      slug: 'unknown',
      title: 'Nope',
      body: 'Nope',
    }).ok).toBe(false);
  });
});
