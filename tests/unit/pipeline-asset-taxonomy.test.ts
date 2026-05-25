import { describe, expect, it } from 'vitest';

import { buildDiscoveredCardAsset } from '@/lib/cardAssets';
import { DEVELOPER_ASSET_TYPES } from '@/lib/developerAssets';
import {
  developerAssetTypeToRegistryAssetKind,
  getAssetBadgeSummary,
  getAssetKindLabel,
  getDeveloperAssetTypeLabel,
  isLocalOnlyAsset,
  normalizeLocalLibraryAsset,
} from '@/lib/pipelineAssetTaxonomy';

describe('pipeline asset taxonomy', () => {
  it('uses product-facing labels for legacy asset kinds', () => {
    expect(getAssetKindLabel('part')).toBe('Card Part / Overlay');
    expect(getAssetKindLabel('part', { plural: true })).toBe('Card Parts / Overlays');
    expect(getDeveloperAssetTypeLabel('parts')).toBe('Card Parts / Overlays');
    expect(getDeveloperAssetTypeLabel('imageAssets')).toBe('Images');
    expect(getDeveloperAssetTypeLabel('elementPresets')).toBe('Pipeline Recipes');
  });

  it('keeps developer submission types mapped to registry kinds', () => {
    const mappedKinds = DEVELOPER_ASSET_TYPES.map((type) => developerAssetTypeToRegistryAssetKind(type));

    expect(mappedKinds).toEqual([
      'template',
      'elementPreset',
      'texture',
      'divider',
      'icon',
      'image',
      'part',
    ]);
    expect(DEVELOPER_ASSET_TYPES.map((type) => getDeveloperAssetTypeLabel(type, { plural: false }))).toEqual([
      'Template',
      'Pipeline Recipe',
      'Texture',
      'Divider',
      'Icon',
      'Image',
      'Card Part / Overlay',
    ]);
    expect(developerAssetTypeToRegistryAssetKind('parts')).toBe('part');
    expect(developerAssetTypeToRegistryAssetKind('imageAssets')).toBe('image');
    expect(developerAssetTypeToRegistryAssetKind('elementPresets')).toBe('elementPreset');
  });

  it('treats browser uploads as local-only library assets', () => {
    const asset = normalizeLocalLibraryAsset({
      id: 'custom-icon',
      name: 'Custom Icon',
      url: 'data:image/svg+xml;base64,abc',
      kind: 'icon',
      librarySource: 'local',
      accessTier: 'free',
      registryStatus: 'published',
      tileMode: 'contain',
      seamless: false,
      allowedTargets: ['icon'],
    });

    expect(isLocalOnlyAsset(asset)).toBe(true);
    expect(asset.accessTier).toBeUndefined();
    expect(asset.registryStatus).toBe('localOnly');
    expect(getAssetBadgeSummary(asset)).toEqual(['Local only', 'Icon']);
  });

  it('infers pack metadata from shipped asset paths', () => {
    const asset = buildDiscoveredCardAsset({
      url: '/card-assets/parts/arcane-forge/title-plates/ember-title-plate.svg',
      kind: 'part',
      relativePath: 'arcane-forge/title-plates/ember-title-plate.svg',
    });

    expect(asset.packId).toBe('arcane-forge');
    expect(asset.packName).toBe('Arcane Forge');
    expect(getAssetBadgeSummary(asset)).toEqual(['Official default', 'Card Part / Overlay', 'Arcane Forge']);
  });
});
