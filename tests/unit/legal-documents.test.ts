import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEFAULT_BUSINESS_IDENTITY, formatBusinessIdentityDescription } from '@/features/business-identity/client';
import {
  DEFAULT_LEGAL_DOCUMENTS,
  LegalDocumentBody,
  PublicLegalPage,
  normalizeLegalDocumentInput,
  parseLegalBody,
} from '@/features/legal/client';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/client';

describe('legal document rules', () => {
  it('ships every public legal document', () => {
    expect(DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug)).toEqual([
      'privacy',
      'terms',
      'creator-pass-terms',
      'supporter-terms',
      'refund',
      'contributor-terms',
      'contact',
      'accessibility',
    ]);
  });

  it('ships defaults as versioned publications tied to a business identity', () => {
    for (const document of DEFAULT_LEGAL_DOCUMENTS) {
      expect(document.version).toBeGreaterThan(0);
      expect(document.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${document.effectiveDate}T00:00:00.000Z`))).toBe(false);
      expect(document.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number.isNaN(Date.parse(document.publishedAt))).toBe(false);
      expect(document.businessIdentityVersion).toBeGreaterThan(0);
    }
  });

  it('identifies Cameron Locke in Oregon across active operator-facing defaults', () => {
    const approvedOperatorDescription = formatBusinessIdentityDescription(DEFAULT_BUSINESS_IDENTITY);
    const documents = Object.fromEntries(
      DEFAULT_LEGAL_DOCUMENTS.map((document) => [document.slug, document]),
    );

    for (const slug of ['privacy', 'terms', 'refund', 'contact', 'contributor-terms'] as const) {
      expect(documents[slug].body).toContain(approvedOperatorDescription);
    }

    expect(documents.terms.body).toContain(
      'Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio.',
    );
    expect(documents.contact.body).toContain('Cameron Locke handles support');
    expect(documents['contributor-terms'].body).toContain(
      'Your Contributor agreement is with Cameron Locke as the legal operator of CardForge Studio.',
    );
    expect(documents.privacy.body).toContain('local-first card creation tool');
    expect(documents.terms.body).toContain('The product is in active beta.');
    expect(documents.refund.body).toContain('Nothing in this policy limits rights that cannot legally be limited.');
    expect(documents.accessibility.body).toContain('WCAG 2.2 Level AA');
    expect(documents.accessibility.body).not.toContain('fully conforms');
  });

  it('covers the required privacy architecture without unsupported promises', () => {
    const privacy = DEFAULT_LEGAL_DOCUMENTS.find(({ slug }) => slug === 'privacy')?.body ?? '';
    for (const requiredDisclosure of [
      'browser IndexedDB',
      'downloaded project files',
      'Clerk',
      'Stripe',
      'Supabase',
      'Resend',
      'Vercel',
      'Google Analytics and PostHog',
      'anonymous identifier kept only in browser session storage',
      'does not use PostHog session replay',
      'does not receive recordings of page content',
      'cookies and similar authentication technologies',
      'contact requests',
      'roadmap suggestions and votes',
      'Contributor submissions',
      'retained for periods that vary',
      'access or deletion inquiry',
      'no method of transmission or storage is completely secure',
      'children under 13',
      'Policy changes',
      DEFAULT_BUSINESS_IDENTITY.legalEmail,
    ]) {
      expect(privacy, requiredDisclosure).toContain(requiredDisclosure);
    }
  });

  it('keeps supporter payments separate from product access and ownership', () => {
    const supporterTerms = DEFAULT_LEGAL_DOCUMENTS.find(({ slug }) => slug === 'supporter-terms')?.body ?? '';
    for (const requiredLimitation of [
      'separate from Creator Pass',
      'does not grant product access or any other CardForge entitlement',
      'equity or ownership interest',
      'profit rights',
      'voting or control rights',
      'does not represent support as tax deductible',
      'does not guarantee a feature, benefit, or roadmap influence',
    ]) {
      expect(supporterTerms, requiredLimitation).toContain(requiredLimitation);
    }
  });

  it('distinguishes one-time and recurring support with an explicit cancellation path', () => {
    const supporterTerms = DEFAULT_LEGAL_DOCUMENTS.find(({ slug }) => slug === 'supporter-terms')?.body ?? '';
    expect(supporterTerms).toContain('One-time support is a single charge and does not renew.');
    expect(supporterTerms).toContain('Recurring support renews');
    expect(supporterTerms).toContain('until canceled');
    expect(supporterTerms).toContain('Stripe-hosted supporter management link');
    expect(supporterTerms).toContain('does not retroactively refund completed charges');
  });

  it('parses constrained legal Markdown into semantic blocks', () => {
    expect(parseLegalBody(`## Your choices

Use the service responsibly.

- Keep your own backups
- Contact [support](mailto:support@cardforges.com)`)).toEqual([
      { type: 'heading', level: 2, text: 'Your choices' },
      { type: 'paragraph', text: 'Use the service responsibly.' },
      { type: 'list', items: ['Keep your own backups', 'Contact [support](mailto:support@cardforges.com)'] },
    ]);
  });

  it('renders headings, lists, and safe inline links', () => {
    const html = renderToStaticMarkup(React.createElement(LegalDocumentBody, {
      body: `## Your choices

- Read the [privacy policy](/privacy)
- Email [support](mailto:support@cardforges.com)
- Visit the [CardForge site](https://cardforges.com)`,
    }));

    expect(html).toContain('<h2');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="mailto:support@cardforges.com"');
    expect(html).toContain('href="https://cardforges.com"');
  });

  it('keeps the renderer source free of the raw HTML injection sink', () => {
    const rendererSource = readFileSync(
      join(process.cwd(), 'src/features/legal/components/LegalDocumentBody.tsx'),
      'utf8',
    );
    expect(rendererSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('rejects raw HTML and unsafe link protocols', () => {
    for (const rawHtml of [
      'Read <strong>this</strong>.',
      '<!-- hidden publication note -->',
      '<!DOCTYPE html>',
      '<?xml version="1.0"?>',
      '<![CDATA[hidden markup]]>',
    ]) {
      expect(() => parseLegalBody(rawHtml), rawHtml).toThrow(/raw HTML/i);
    }
    expect(() => parseLegalBody('[Run this](javascript:alert(1))')).toThrow(/unsafe link/i);
    expect(() => parseLegalBody('[Download](data:text/html,bad)')).toThrow(/unsafe link/i);
    expect(() => parseLegalBody('[External](//example.com/path)')).toThrow(/unsafe link/i);
  });

  it('renders the same canonical operator description and contact details', () => {
    const document = DEFAULT_LEGAL_DOCUMENTS.find(({ slug }) => slug === 'privacy');
    expect(document).toBeDefined();
    const html = renderToStaticMarkup(React.createElement(PublicLegalPage, {
      businessIdentity: DEFAULT_BUSINESS_IDENTITY,
      document: document!,
      siteConfiguration: DEFAULT_PUBLIC_SITE_CONFIGURATION,
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
      effectiveDate: '2026-07-16',
      expectedBusinessIdentityVersion: 3,
    })).toEqual({
      ok: true,
      value: {
        slug: 'privacy',
        title: 'Privacy',
        body: 'Updated privacy copy',
        effectiveDate: '2026-07-16',
        expectedBusinessIdentityVersion: 3,
      },
    });
    expect(normalizeLegalDocumentInput({
      slug: 'contributor-terms',
      title: ' Contributor Terms ',
      body: ' Contributor policy ',
      effectiveDate: '2026-07-17',
      expectedBusinessIdentityVersion: 4,
    }).ok).toBe(true);
    expect(normalizeLegalDocumentInput({ slug: 'unknown', title: 'Nope', body: 'Nope' }).ok).toBe(false);
    expect(normalizeLegalDocumentInput({
      slug: 'terms', title: 'Terms', body: 'Terms body', effectiveDate: '2026-02-31', expectedBusinessIdentityVersion: 1,
    }).ok).toBe(false);
    expect(normalizeLegalDocumentInput({
      slug: 'terms', title: 'Terms', body: 'Terms body', effectiveDate: '2026-07-16', expectedBusinessIdentityVersion: 0,
    }).ok).toBe(false);
    expect(normalizeLegalDocumentInput({
      slug: 'terms', title: 'Terms', body: '[bad](javascript:alert(1))', effectiveDate: '2026-07-16', expectedBusinessIdentityVersion: 1,
    }).ok).toBe(false);
  });
});
