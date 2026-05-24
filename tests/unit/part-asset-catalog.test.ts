import { describe, expect, it } from 'vitest';

import type { CardAssetOption } from '@/lib/cardAssets';
import {
  buildCardPartElementPreset,
  filterCardPartAssets,
  getCardPartPackName,
  getCardPartRoleLabel,
  getCardPartRoleOptions,
} from '@/lib/partAssetCatalog';

const parts: CardAssetOption[] = [
  {
    id: 'arcane-title',
    name: 'Arcane Title Plate',
    url: '/card-assets/parts/arcane-forge/title-plates/arcane-title.webp',
    kind: 'part',
    tileMode: 'contain',
    seamless: false,
    allowedTargets: ['imageFrame', 'shape', 'template'],
    partRole: 'titlePlate',
    defaultWidth: 420,
    defaultHeight: 70,
  },
  {
    id: 'neon-orb',
    name: 'Neon Cost Orb',
    url: '/card-assets/parts/neon-relic/orbs/neon-orb.webp',
    kind: 'part',
    tileMode: 'contain',
    seamless: false,
    allowedTargets: ['imageFrame', 'shape', 'template'],
    partRole: 'costOrb',
    defaultWidth: 76,
    defaultHeight: 76,
  },
];

describe('part asset catalog', () => {
  it('derives professional catalog labels from part metadata', () => {
    expect(getCardPartPackName(parts[0])).toBe('arcane forge');
    expect(getCardPartRoleLabel(parts[0].partRole)).toBe('Title Plate');
    expect(getCardPartRoleOptions(parts)).toEqual(['costOrb', 'titlePlate']);
  });

  it('filters parts by search, pack name, and role', () => {
    expect(filterCardPartAssets(parts, 'arcane', 'all')).toEqual([parts[0]]);
    expect(filterCardPartAssets(parts, 'neon relic', 'all')).toEqual([parts[1]]);
    expect(filterCardPartAssets(parts, '', 'costOrb')).toEqual([parts[1]]);
  });

  it('builds insert presets for discovered part assets', () => {
    expect(buildCardPartElementPreset(parts[0])).toMatchObject({
      name: 'Arcane Title Plate',
      width: 420,
      height: 70,
      imageSource: '/card-assets/parts/arcane-forge/title-plates/arcane-title.webp',
      imageObjectFit: 'contain',
      borderWidth: '_none_',
      appearance: {
        assetKind: 'part',
        assetSource: '/card-assets/parts/arcane-forge/title-plates/arcane-title.webp',
      },
    });
  });
});
