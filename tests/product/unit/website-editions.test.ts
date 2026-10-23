import { describe, expect, it, vi } from 'vitest';

const routeState = vi.hoisted(() => ({ owner: true }));
vi.mock('server-only', () => ({}));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: async () => ({ isOwner: routeState.owner, userId: routeState.owner ? 'owner-test' : null }) }));
vi.mock('@/features/public-site/server/websiteEditionStore', () => ({
  activateWebsiteRevision: async () => { throw new (await import('@/features/public-site/model/websitePresentation')).WebsitePresentationValidationError('A historical public URL needs an explicit valid replacement redirect.'); },
  WebsiteEditionStoreError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
vi.mock('@/features/public-site/server/websitePresentationResolver', () => ({}));

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

describe('website redirect validation response', () => {
  it('rejects an authenticated activation with a validation error as 400, not 503', async () => {
    const { PATCH } = await import('@/app/api/owner/website-revisions/route');
    const request = new Request('https://cardforges.com/api/owner/website-revisions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revisionId: '10000000-0000-4000-8000-000000000001',
        operationId: '20000000-0000-4000-8000-000000000002',
        expectedGeneration: 1,
        urlDisposition: {},
      }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false, error: { code: 'website_revision_invalid' },
    });
  });
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
