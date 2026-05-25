import type { CardAssetOption } from '@/lib/cardAssets';
import type {
  DeveloperAssetAccessTier,
  DeveloperAssetStatus,
  DeveloperAssetType,
} from '@/lib/developerAssets';

export type RegistryCreationAssetKind = Extract<
  CardAssetOption['kind'],
  'texture' | 'divider' | 'part' | 'icon' | 'image' | 'template' | 'elementPreset'
>;

const assetKindLabels: Record<CardAssetOption['kind'], { singular: string; plural: string }> = {
  texture: { singular: 'Texture', plural: 'Textures' },
  divider: { singular: 'Divider', plural: 'Dividers' },
  border: { singular: 'Border', plural: 'Borders' },
  frame: { singular: 'Frame', plural: 'Frames' },
  part: { singular: 'Card Part / Overlay', plural: 'Card Parts / Overlays' },
  icon: { singular: 'Icon', plural: 'Icons' },
  image: { singular: 'Image', plural: 'Images' },
  template: { singular: 'Template', plural: 'Templates' },
  elementPreset: { singular: 'Pipeline Recipe', plural: 'Pipeline Recipes' },
};

export const developerAssetTypeToRegistryAssetKind = (
  assetType: DeveloperAssetType
): RegistryCreationAssetKind => {
  if (assetType === 'templates') return 'template';
  if (assetType === 'elementPresets') return 'elementPreset';
  if (assetType === 'textures') return 'texture';
  if (assetType === 'dividers') return 'divider';
  if (assetType === 'icons') return 'icon';
  if (assetType === 'imageAssets') return 'image';
  return 'part';
};

export const getAssetKindLabel = (
  kind: CardAssetOption['kind'],
  options: { plural?: boolean } = {},
): string => {
  const labels = assetKindLabels[kind];
  return options.plural ? labels.plural : labels.singular;
};

export const getDeveloperAssetTypeLabel = (
  assetType: DeveloperAssetType,
  options: { plural?: boolean } = { plural: true },
): string => getAssetKindLabel(developerAssetTypeToRegistryAssetKind(assetType), options);

export const getDeveloperAssetStatusLabel = (status: DeveloperAssetStatus | 'localOnly'): string => {
  if (status === 'publish_candidate') return 'Publish Candidate';
  if (status === 'localOnly') return 'Local only';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const getDeveloperAssetTierLabel = (tier: DeveloperAssetAccessTier): string => {
  if (tier === 'free') return 'Starter Library';
  if (tier === 'paid') return 'Creator Pass';
  if (tier === 'developer') return 'Forge Review';
  if (tier === 'official') return 'Official Default';
  return 'Hidden';
};

export const getLibrarySourceLabel = (source?: CardAssetOption['librarySource']): string => {
  if (source === 'local') return 'Local only';
  if (source === 'developer') return 'Developer upload';
  return 'Official default';
};

export const isLocalOnlyAsset = (asset: Pick<CardAssetOption, 'librarySource' | 'registryStatus'>): boolean =>
  asset.librarySource === 'local' || asset.registryStatus === 'localOnly';

export const normalizeLocalLibraryAsset = (asset: CardAssetOption): CardAssetOption => ({
  ...asset,
  librarySource: 'local',
  accessTier: undefined,
  registryStatus: 'localOnly',
});

export const getAssetBadgeSummary = (asset: CardAssetOption): string[] => {
  if (isLocalOnlyAsset(asset)) {
    return ['Local only', getAssetKindLabel(asset.kind)];
  }

  return [
    getLibrarySourceLabel(asset.librarySource),
    getAssetKindLabel(asset.kind),
    asset.packName,
  ].filter((label): label is string => Boolean(label));
};
