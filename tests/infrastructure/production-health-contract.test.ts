import { describe, expect, it } from 'vitest';

import {
  assertContributorPublicTruth,
  assertContributorTermsPublicTruth,
  assertPrivacyPublicTruth,
  assertRepresentativeCatalogRouting,
} from '../../scripts/lib/production-health-contract.mjs';

describe('production health semantic contracts', () => {
  it('rejects retired public Contributor and legal claims', () => {
    expect(() => assertContributorPublicTruth('Contributors may propose clearer public-site text. Public-site editing remains owner-only.')).toThrow(/retired public-site/iu);
    expect(() => assertPrivacyPublicTruth('developer profiles, owner/developer accounts, Owner Console, browser-local Studio projects')).toThrow(/retired/iu);
    expect(() => assertContributorTermsPublicTruth('Developer Contributor Terms. Developer votes use the Developer path.')).toThrow(/retired/iu);
  });

  it('accepts the current Contributor and legal vocabulary', () => {
    expect(() => assertContributorPublicTruth('Approved contributors add shared assets. Public-site editing remains owner-only.')).not.toThrow();
    expect(() => assertPrivacyPublicTruth('Contributor profiles are provider records. Work remains separate from browser-local CardForge projects.')).not.toThrow();
    expect(() => assertContributorTermsPublicTruth('Contributor Terms. Contributors submit work through the review Pipeline.')).not.toThrow();
  });

  it('requires representative Set, Template, and icon destinations', () => {
    const catalog = {
      sets: { items: [{ id: 'standard-playing-card-deck', access: 'free', packageUrl: 'https://assets.example/starter.zip' }] },
      templates: { defaults: [{ id: 'default-mtg-theme' }] },
      assets: { icons: [{ id: 'arcane-star', previewUrl: 'https://assets.example/icon.svg', studioDestinations: ['element.icon'] }] },
      pipeline: { items: [
        { id: 'standard-playing-card-deck', assetType: 'set', previewUrl: 'https://assets.example/card.webp' },
        { id: 'default-mtg-theme', assetType: 'template', previewUrl: '/api/templates#default-mtg-theme' },
        { id: 'arcane-star', assetType: 'icon', previewUrl: 'https://assets.example/icon.svg' },
      ] },
    };
    expect(() => assertRepresentativeCatalogRouting(catalog)).not.toThrow();
    expect(() => assertRepresentativeCatalogRouting({ ...catalog, assets: { icons: [] } })).toThrow(/icon/iu);
  });
});
