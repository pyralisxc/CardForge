import type { CardAssetOption } from '@/lib/cardAssets';
import type { FreeformCardElement } from '@/types';

export const CARD_PART_ROLE_LABELS = {
  outerFrame: 'Outer Frame',
  frameRail: 'Frame Rail',
  corner: 'Corner',
  titlePlate: 'Title Plate',
  artWindow: 'Art Window',
  rulesBox: 'Rules Box',
  statGem: 'Stat Gem',
  costOrb: 'Cost Orb',
  panel: 'Panel',
  overlay: 'Overlay',
  ornament: 'Ornament',
} as const;

export type CardPartRole = keyof typeof CARD_PART_ROLE_LABELS;

export const getCardPartRoleLabel = (role?: string) =>
  role && role in CARD_PART_ROLE_LABELS
    ? CARD_PART_ROLE_LABELS[role as CardPartRole]
    : 'Part';

export const getCardPartPackName = (asset: CardAssetOption) => {
  const match = asset.url.match(/\/card-assets\/parts\/([^/]+)/);
  return match ? match[1].replace(/[-_]+/g, ' ') : 'Project';
};

export const getCardPartRoleOptions = (assets: CardAssetOption[]) => {
  const roles = new Set<CardPartRole>();
  assets.forEach((asset) => {
    if (asset.partRole && asset.partRole in CARD_PART_ROLE_LABELS) {
      roles.add(asset.partRole as CardPartRole);
    }
  });
  return [...roles].sort((a, b) => getCardPartRoleLabel(a).localeCompare(getCardPartRoleLabel(b)));
};

export const filterCardPartAssets = (
  assets: CardAssetOption[],
  search: string,
  role: CardPartRole | 'all',
) => {
  const normalizedSearch = search.trim().toLowerCase();
  return assets
    .filter((asset) => role === 'all' || asset.partRole === role)
    .filter((asset) => {
      if (!normalizedSearch) return true;
      return [
        asset.name,
        getCardPartPackName(asset),
        getCardPartRoleLabel(asset.partRole),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
};

export const buildCardPartElementPreset = (asset: CardAssetOption): Partial<FreeformCardElement> => ({
  name: asset.name,
  width: asset.defaultWidth ?? 220,
  height: asset.defaultHeight ?? 120,
  imageSource: asset.url,
  imageObjectFit: 'contain',
  backgroundColor: 'transparent',
  borderWidth: '_none_',
  borderRadius: 'rounded-none',
  strokeWidth: 0,
  appearance: {
    assetSource: asset.url,
    assetKind: 'part',
    tileMode: 'contain',
    textureOpacity: asset.defaultOpacity ?? 100,
    blendMode: asset.defaultBlendMode ?? 'normal',
    material: { baseColor: 'transparent', texture: { kind: 'none' } },
    border: { kind: 'none', width: 0 },
  },
});
