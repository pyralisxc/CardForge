import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEFAULT_BUSINESS_IDENTITY, formatBusinessIdentityDescription } from '@/features/business-identity/client';
import {
  DEFAULT_LEGAL_DOCUMENTS,
  PublicLegalPage,
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

  it('identifies Cameron Locke in Oregon across active operator-facing defaults', () => {
    const approvedOperatorDescription = formatBusinessIdentityDescription(DEFAULT_BUSINESS_IDENTITY);
    const documents = Object.fromEntries(
      DEFAULT_LEGAL_DOCUMENTS.map((document) => [document.slug, document]),
    );

    for (const slug of ['privacy', 'terms', 'refund', 'contact', 'developer-terms'] as const) {
      expect(documents[slug].body).toContain(approvedOperatorDescription);
    }

    expect(documents.terms.body).toContain(
      'Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio.',
    );
    expect(documents.contact.body).toContain('Cameron Locke handles support');
    expect(documents['developer-terms'].body).toContain(
      'Your developer contribution agreement is with Cameron Locke as the legal operator of CardForge Studio.',
    );

    expect(documents.privacy.body).toContain('local-first card creation tool');
    expect(documents.terms.body).toContain('The product is in active beta.');
    expect(documents.refund.body).toContain('Nothing in this policy limits rights that cannot legally be limited.');
    expect(documents['creator-pool'].body).toContain('not active payout infrastructure today');
  });

  it('renders the same canonical operator description and contact details', () => {
    const document = DEFAULT_LEGAL_DOCUMENTS.find(({ slug }) => slug === 'privacy');
    expect(document).toBeDefined();

    const html = renderToStaticMarkup(React.createElement(PublicLegalPage, {
      businessIdentity: DEFAULT_BUSINESS_IDENTITY,
      document: document!,
    }));

    expect(html).toContain(formatBusinessIdentityDescription(DEFAULT_BUSINESS_IDENTITY));
    expect(html).toContain('Legal operator: Cameron Locke');
    expect(html).toContain('Jurisdiction: Oregon, United States');
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
