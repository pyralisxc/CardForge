import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUSINESS_IDENTITY,
  formatBusinessIdentityDescription,
  hydrateBusinessIdentity,
  normalizeBusinessIdentityInput,
  validateBusinessIdentityWrite,
} from '@/features/business-identity/client';

describe('business identity', () => {
  it('represents the approved CardForge Studio operator identity', () => {
    expect(DEFAULT_BUSINESS_IDENTITY).toEqual({
      identityVersion: 1,
      brandName: 'CardForge Studio',
      legalOperatorName: 'Cameron Locke',
      entityType: 'sole_proprietor',
      jurisdictionState: 'Oregon',
      jurisdictionCountry: 'United States',
      assumedBusinessNameStatus: 'unverified',
      supportEmail: 'pyraliscameron@gmail.com',
      legalEmail: 'pyraliscameron@gmail.com',
      websiteUrl: 'https://cardforges.com',
      effectiveDate: '2026-07-16',
      copyrightHolder: 'Cameron Locke',
    });

    expect(formatBusinessIdentityDescription(DEFAULT_BUSINESS_IDENTITY)).toBe(
      'CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.',
    );
    expect(formatBusinessIdentityDescription(DEFAULT_BUSINESS_IDENTITY)).not.toContain('d/b/a');
  });

  it('normalizes a partial update without resetting omitted values', () => {
    const current = {
      ...DEFAULT_BUSINESS_IDENTITY,
      supportEmail: 'current@example.com',
      supportPhone: '503-555-0100',
      identityVersion: 3,
    };

    expect(normalizeBusinessIdentityInput({ legalEmail: '  LEGAL@Example.com  ' }, current)).toEqual({
      ...current,
      legalEmail: 'legal@example.com',
    });
  });

  it('falls back safely for invalid values and only renders d/b/a after registration', () => {
    const normalized = normalizeBusinessIdentityInput({
      identityVersion: -2,
      entityType: 'corporation',
      jurisdictionState: '  Oregon  ',
      assumedBusinessNameStatus: 'pending',
      websiteUrl: 'javascript:alert(1)',
      effectiveDate: 'not-a-date',
      supportPhone: '   ',
    });

    expect(normalized).toEqual({
      ...DEFAULT_BUSINESS_IDENTITY,
      supportPhone: undefined,
    });
    expect(formatBusinessIdentityDescription(normalized)).not.toContain('d/b/a');

    expect(formatBusinessIdentityDescription({
      ...normalized,
      assumedBusinessNameStatus: 'registered',
    })).toBe(
      'CardForge Studio is a software product created and operated by Cameron Locke, d/b/a CardForge Studio, an independent sole proprietor based in Oregon.',
    );
  });

  it('keeps repository defaults immutable and accepts only absolute HTTPS websites', () => {
    expect(Object.isFrozen(DEFAULT_BUSINESS_IDENTITY)).toBe(true);
    expect(normalizeBusinessIdentityInput({
      websiteUrl: 'http://cardforges.com',
    }).websiteUrl).toBe(DEFAULT_BUSINESS_IDENTITY.websiteUrl);
    expect(normalizeBusinessIdentityInput({
      websiteUrl: '/contact',
    }).websiteUrl).toBe(DEFAULT_BUSINESS_IDENTITY.websiteUrl);
    expect(normalizeBusinessIdentityInput({
      websiteUrl: ' HTTPS://CARDFORGES.COM:443/about/ ',
    }).websiteUrl).toBe('https://cardforges.com/about');
    expect(normalizeBusinessIdentityInput({
      websiteUrl: 'https://user:secret@cardforges.com/about',
    }).websiteUrl).toBe(DEFAULT_BUSINESS_IDENTITY.websiteUrl);
    expect(normalizeBusinessIdentityInput({
      websiteUrl: 'https://cardforges.com/about#team',
    }).websiteUrl).toBe(DEFAULT_BUSINESS_IDENTITY.websiteUrl);
    expect(normalizeBusinessIdentityInput({
      websiteUrl: 'https://cardforges.com/about?source=owner',
    }).websiteUrl).toBe(DEFAULT_BUSINESS_IDENTITY.websiteUrl);
  });

  it('tolerantly normalizes unknown input without allowing identity-version injection', () => {
    const current = {
      ...DEFAULT_BUSINESS_IDENTITY,
      identityVersion: 7,
      supportEmail: 'current@example.com',
    };

    for (const value of [null, undefined, 42, 'identity', true, [], ['supportEmail']]) {
      expect(normalizeBusinessIdentityInput(value, current)).toEqual(current);
    }

    expect(normalizeBusinessIdentityInput({
      identityVersion: 99,
      supportEmail: 'NEXT@example.com',
    }, current)).toEqual({
      ...current,
      supportEmail: 'next@example.com',
    });
  });

  it('hydrates only storage-compatible identity versions', () => {
    expect(hydrateBusinessIdentity({ identityVersion: 4 }).identityVersion).toBe(4);
    expect(hydrateBusinessIdentity({ identityVersion: 0 }).identityVersion).toBe(1);
    expect(hydrateBusinessIdentity({ identityVersion: 2_147_483_648 }).identityVersion).toBe(1);
    expect(hydrateBusinessIdentity({ identityVersion: 1.5 }).identityVersion).toBe(1);
    expect(hydrateBusinessIdentity({ identityVersion: '4' }).identityVersion).toBe(1);
  });

  it('returns clear field errors for malformed owner writes', () => {
    const result = validateBusinessIdentityWrite({
      identityVersion: 99,
      brandName: '   ',
      supportEmail: 'not-an-email',
      legalEmail: 'also-invalid',
      websiteUrl: 'https://cardforges.com/?source=owner',
      effectiveDate: '2026-02-31',
      assumedBusinessNameStatus: 'pending',
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        identityVersion: 'Identity version is server-owned.',
        brandName: 'Brand name is required.',
        supportEmail: 'Enter a valid support email address.',
        legalEmail: 'Enter a valid legal email address.',
        websiteUrl: 'Website must be an absolute HTTPS URL without credentials, query parameters, or a fragment.',
        effectiveDate: 'Effective date must be a valid date in YYYY-MM-DD format.',
        assumedBusinessNameStatus: 'Assumed business name status must be unverified or registered.',
      },
    });
  });

  it('strictly validates and canonicalizes a safe partial owner write', () => {
    const current = {
      ...DEFAULT_BUSINESS_IDENTITY,
      identityVersion: 5,
      supportPhone: '503-555-0100',
    };
    const result = validateBusinessIdentityWrite({
      legalEmail: ' LEGAL@Example.com ',
      websiteUrl: 'HTTPS://CARDFORGES.COM:443/contact/',
      supportPhone: ' ',
    }, current);

    expect(result).toEqual({
      ok: true,
      value: {
        ...current,
        legalEmail: 'legal@example.com',
        websiteUrl: 'https://cardforges.com/contact',
        supportPhone: undefined,
      },
    });
  });

  it('rejects misspelled or unknown owner-write fields', () => {
    expect(validateBusinessIdentityWrite({
      supportEamil: 'support@example.com',
    })).toEqual({
      ok: false,
      errors: {
        form: 'Unknown business identity field: supportEamil.',
      },
    });
  });
});
