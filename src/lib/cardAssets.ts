export interface CardAssetOption {
  id: string;
  name: string;
  url: string;
  kind: 'texture' | 'divider' | 'border' | 'frame' | 'part' | 'icon' | 'image' | 'template' | 'elementPreset';
  librarySource?: 'official' | 'developer' | 'local';
  accessTier?: 'official' | 'free' | 'paid' | 'developer' | 'hidden';
  registryStatus?: 'draft' | 'submitted' | 'voting' | 'publish_candidate' | 'published' | 'archived' | 'rejected' | 'localOnly';
  fileSizeBytes?: number;
  packId?: string;
  packName?: string;
  tileMode: 'repeat' | 'stretch' | 'contain';
  seamless: boolean;
  allowedTargets: Array<'text' | 'shape' | 'divider' | 'template' | 'imageFrame' | 'icon' | 'image'>;
  defaultBlendMode?: string;
  defaultOpacity?: number;
  defaultScale?: number;
  partRole?: 'outerFrame' | 'frameRail' | 'corner' | 'titlePlate' | 'artWindow' | 'rulesBox' | 'statGem' | 'costOrb' | 'panel' | 'overlay' | 'ornament';
  defaultWidth?: number;
  defaultHeight?: number;
}

export type CardAssetMetadataOverride = Partial<Pick<
  CardAssetOption,
  'id' | 'name' | 'tileMode' | 'seamless' | 'allowedTargets' | 'defaultBlendMode' | 'defaultOpacity' | 'defaultScale' | 'partRole' | 'defaultWidth' | 'defaultHeight' | 'packId' | 'packName'
>>;

export interface CardAssetDiscoveryInput {
  url: string;
  kind: CardAssetOption['kind'];
  relativePath?: string;
  metadata?: CardAssetMetadataOverride;
}

export const CARD_TEXTURE_ASSETS: CardAssetOption[] = [
  { id: 'parchment-grain', name: 'Parchment Grain', url: '/card-assets/textures/parchment-grain.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'multiply', defaultOpacity: 42, defaultScale: 160 },
  { id: 'dark-leather', name: 'Dark Leather', url: '/card-assets/textures/dark-leather.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'overlay', defaultOpacity: 46, defaultScale: 180 },
  { id: 'hammered-metal', name: 'Hammered Metal Surface', url: '/card-assets/textures/hammered-metal.svg', kind: 'texture', tileMode: 'contain', seamless: false, allowedTargets: ['shape', 'template'], defaultBlendMode: 'overlay', defaultOpacity: 40, defaultScale: 150 },
  { id: 'purple-foil', name: 'Purple Foil Surface', url: '/card-assets/textures/purple-foil.svg', kind: 'texture', tileMode: 'contain', seamless: false, allowedTargets: ['shape', 'template'], defaultBlendMode: 'screen', defaultOpacity: 44, defaultScale: 190 },
  { id: 'arcane-hatch', name: 'Arcane Hatch', url: '/card-assets/textures/arcane-hatch.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'soft-light', defaultOpacity: 54, defaultScale: 140 },
  { id: 'ink-wash', name: 'Ink Wash Surface', url: '/card-assets/textures/ink-wash.svg', kind: 'texture', tileMode: 'contain', seamless: false, allowedTargets: ['shape', 'template'], defaultBlendMode: 'multiply', defaultOpacity: 34, defaultScale: 170 },
  { id: 'stone-grain', name: 'Stone Grain', url: '/card-assets/textures/stone-grain.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'overlay', defaultOpacity: 42, defaultScale: 160 },
  { id: 'worn-paper', name: 'Worn Paper', url: '/card-assets/textures/worn-paper.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'multiply', defaultOpacity: 38, defaultScale: 170 },
];

export const CARD_DIVIDER_ASSETS: CardAssetOption[] = [
  { id: 'gilded-filigree', name: 'Gilded Filigree', url: '/card-assets/dividers/gilded-filigree.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'gem-center', name: 'Gem Center', url: '/card-assets/dividers/gem-center.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'runic-thread', name: 'Runic Thread', url: '/card-assets/dividers/runic-thread.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'double-rule', name: 'Double Rule', url: '/card-assets/dividers/double-rule.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'vine-rule', name: 'Vine Rule', url: '/card-assets/dividers/vine-rule.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'arcane-chevron', name: 'Arcane Chevron', url: '/card-assets/dividers/arcane-chevron.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
];

export const SEAMLESS_TEXTURE_ASSETS = CARD_TEXTURE_ASSETS.filter(asset =>
  asset.kind === 'texture' && asset.seamless && asset.tileMode === 'repeat',
);

export const findCardAsset = (idOrUrl?: string): CardAssetOption | undefined =>
  [...CARD_TEXTURE_ASSETS, ...CARD_DIVIDER_ASSETS].find(asset => asset.id === idOrUrl || asset.url === idOrUrl);

const toTitleCase = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const slugifyAssetId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/\\/g, '/')
    .replace(/\//g, '-')
    .replace(/^-+|-+$/g, '');

export const buildDiscoveredCardAsset = ({
  url,
  kind,
  relativePath,
  metadata,
}: CardAssetDiscoveryInput): CardAssetOption => {
  const normalizedRelativePath = (relativePath || url)
    .replace(/^\/card-assets\/(?:textures|dividers|parts|icons|images|templates|element-presets)\//, '')
    .replace(/\\/g, '/');
  const stem = normalizedRelativePath.replace(/\.[^.]+$/, '');
  const inferredPackId = stem.includes('/') ? stem.split('/')[0] : undefined;
  const inferredPackName = inferredPackId ? toTitleCase(inferredPackId) : undefined;
  const derivedId = metadata?.id || slugifyAssetId(stem);
  const known = findCardAsset(metadata?.id || url || derivedId);
  const defaults: CardAssetOption = kind === 'texture'
    ? {
        id: derivedId,
        name: toTitleCase(stem.split('/').pop() || stem),
        url,
        kind,
        tileMode: 'repeat',
        seamless: true,
        allowedTargets: ['text', 'shape', 'template'],
        defaultBlendMode: 'multiply',
        defaultOpacity: 42,
        defaultScale: 160,
      }
    : kind === 'part'
      ? {
          id: derivedId,
          name: toTitleCase(stem.split('/').pop() || stem),
          url,
          kind,
          tileMode: 'contain',
          seamless: false,
          allowedTargets: ['imageFrame', 'shape', 'template'],
          defaultBlendMode: 'normal',
          defaultOpacity: 100,
          defaultScale: 100,
          partRole: 'ornament',
          defaultWidth: 220,
        defaultHeight: 120,
      }
    : kind === 'icon'
      ? {
          id: derivedId,
          name: toTitleCase(stem.split('/').pop() || stem),
          url,
          kind,
          tileMode: 'contain',
          seamless: false,
          allowedTargets: ['icon'],
          defaultBlendMode: 'normal',
          defaultOpacity: 100,
          defaultScale: 100,
          defaultWidth: 64,
          defaultHeight: 64,
        }
      : kind === 'image'
        ? {
            id: derivedId,
            name: toTitleCase(stem.split('/').pop() || stem),
            url,
            kind,
            tileMode: 'contain',
            seamless: false,
            allowedTargets: ['image', 'imageFrame', 'template'],
            defaultBlendMode: 'normal',
            defaultOpacity: 100,
            defaultScale: 100,
            defaultWidth: 300,
            defaultHeight: 180,
          }
      : kind === 'template'
        ? {
            id: derivedId,
            name: toTitleCase(stem.split('/').pop() || stem),
            url,
            kind,
            tileMode: 'contain',
            seamless: false,
            allowedTargets: ['template'],
            defaultBlendMode: 'normal',
            defaultOpacity: 100,
            defaultScale: 100,
          }
        : kind === 'elementPreset'
          ? {
              id: derivedId,
              name: toTitleCase(stem.split('/').pop() || stem),
              url,
              kind,
              tileMode: 'contain',
              seamless: false,
              allowedTargets: ['shape', 'text', 'template'],
              defaultBlendMode: 'normal',
              defaultOpacity: 100,
              defaultScale: 100,
            }
    : {
        id: derivedId,
        name: toTitleCase(stem.split('/').pop() || stem),
        url,
        kind,
        tileMode: 'stretch',
        seamless: false,
        allowedTargets: ['divider'],
        defaultBlendMode: 'normal',
        defaultOpacity: 100,
        defaultScale: 100,
      };

  return {
    ...defaults,
    ...known,
    ...metadata,
    id: derivedId,
    name: metadata?.name || known?.name || defaults.name,
    url,
    kind,
    tileMode: metadata?.tileMode || known?.tileMode || defaults.tileMode,
    seamless: metadata?.seamless ?? known?.seamless ?? defaults.seamless,
    allowedTargets: metadata?.allowedTargets || known?.allowedTargets || defaults.allowedTargets,
    packId: metadata?.packId ?? known?.packId ?? inferredPackId,
    packName: metadata?.packName ?? known?.packName ?? inferredPackName,
    defaultBlendMode: metadata?.defaultBlendMode || known?.defaultBlendMode || defaults.defaultBlendMode,
    defaultOpacity: metadata?.defaultOpacity ?? known?.defaultOpacity ?? defaults.defaultOpacity,
    defaultScale: metadata?.defaultScale ?? known?.defaultScale ?? defaults.defaultScale,
    partRole: metadata?.partRole ?? known?.partRole ?? defaults.partRole,
    defaultWidth: metadata?.defaultWidth ?? known?.defaultWidth ?? defaults.defaultWidth,
    defaultHeight: metadata?.defaultHeight ?? known?.defaultHeight ?? defaults.defaultHeight,
  };
};
