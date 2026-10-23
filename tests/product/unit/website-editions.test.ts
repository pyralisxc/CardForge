import { describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
import { DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { getDefaultSiteMedia } from '@/features/public-site/model/siteMedia';
import {
  WEBSITE_PRESENTATION_SCHEMA_VERSION,
  assertWebsiteMediaReferencesPresent,
  validateWebsitePresentationManifest,
  validateWebsiteUrlDisposition,
  resolveWebsiteRedirectChain,
} from '@/features/public-site/model/websitePresentation';

const defaults = () => ({
  schemaVersion: WEBSITE_PRESENTATION_SCHEMA_VERSION,
  configuration: DEFAULT_PUBLIC_SITE_CONFIGURATION,
  content: DEFAULT_SITE_CONTENT_BLOCKS.map(({ slug, body }) => ({ slug, body })),
  media: [{
    slot: 'landing.hero' as const,
    storagePath: null,
    sha256: null,
    alt: 'Website cover',
    width: null,
    height: null,
    presentation: getDefaultSiteMedia('landing.hero').presentation,
  }],
});

describe('Website Editions presentation contract', () => {
  it('preserves chained retired URLs and rejects loops without silent deletion', () => {
    const old = { a:{kind:'redirect' as const,destination:'/b'} };
    const next = { b:{kind:'redirect' as const,destination:'/c'} };
    expect(resolveWebsiteRedirectChain(old,next,new Set(['c']))).toEqual({
      a:{kind:'redirect',destination:'/c'},b:{kind:'redirect',destination:'/c'},
    });
    expect(() => resolveWebsiteRedirectChain(old,{ b:{kind:'redirect',destination:'/a'} },new Set())).toThrow(/replacement/);
  });

  it('allows the current published presentation without domain snapshots', () => {
    const revision = validateWebsitePresentationManifest(defaults());
    expect(revision.schemaVersion).toBe(1);
    expect(revision.configuration.homepageSections.length).toBeGreaterThan(0);
    expect(JSON.stringify(revision)).not.toContain('providerCredentials');
  });

  it('refuses unsupported schemas, unrecognized domain keys and duplicate copy identities', () => {
    const base = defaults();
    expect(() => validateWebsitePresentationManifest({ ...base, schemaVersion: 2 })).toThrow(/compatibility/);
    expect(() => validateWebsitePresentationManifest({ ...base, providerCredentials: {} })).toThrow(/Invalid/);
    expect(() => validateWebsitePresentationManifest({ ...base, content: [base.content[0], base.content[0]] })).toThrow(/duplicate/);
  });

  it('requires exact media digests and refuses missing or changed archived bytes', () => {
    const base = defaults();
    const path = 'landing/hero/01234567-89ab-4cde-8123-0123456789ab.webp';
    const sha256 = 'b'.repeat(64);
    const revision = validateWebsitePresentationManifest({
      ...base,
      media: [{ ...base.media[0], storagePath: path, sha256 }],
    });
    expect(() => assertWebsiteMediaReferencesPresent(revision, new Map([[path, sha256]]))).not.toThrow();
    expect(() => assertWebsiteMediaReferencesPresent(revision, new Map())).toThrow(/unavailable/);
    expect(() => assertWebsiteMediaReferencesPresent(revision, new Map([[path, 'a'.repeat(64)]]))).toThrow(/match/);
    expect(() => validateWebsitePresentationManifest({
      ...base, media: [{ ...base.media[0], storagePath: path, sha256: null }],
    })).toThrow(/exact/);
  });

  it('requires a deliberate safe redirect when an authored public URL disappears', () => {
    const old = validateWebsitePresentationManifest(defaults());
    const withPage = {
      ...old,
      configuration: { ...old.configuration, pages: [{
        id: 'page-guide' as const, slug: 'guide', title: 'Guide',
        description: 'A guide to the complete CardForge creation and export journey.',
        keywords: ['guide'], published: true,
        sections: [{
          id: 'custom-guide', kind: 'custom' as const, visible: true,
          design: { layout: 'stack' as const, tone: 'charcoal' as const, spacing: 'balanced' as const, align: 'start' as const },
          blocks: [{ id: 'block-guide', kind: 'heading' as const, text: 'Guide' }],
        }],
      }] },
    };
    const previous = validateWebsitePresentationManifest(withPage);
    expect(() => validateWebsiteUrlDisposition(previous, old, {})).toThrow(/redirect/);
    expect(() => validateWebsiteUrlDisposition(previous, old, {
      guide: { kind: 'redirect', destination: 'https://other.example' },
    })).toThrow(/internal/);
    expect(validateWebsiteUrlDisposition(previous, old, {
      guide: { kind: 'redirect', destination: '/about' },
    })).toEqual({ guide: { kind: 'redirect', destination: '/about' } });
  });
});
