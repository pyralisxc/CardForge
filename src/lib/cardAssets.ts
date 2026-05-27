export interface CardAssetOption {
  id: string;
  name: string;
  url: string;
  kind: 'texture' | 'divider' | 'border' | 'frame' | 'part' | 'icon' | 'image' | 'template' | 'elementPreset';
  librarySource?: 'official' | 'developer' | 'local';
  accessTier?: 'free' | 'paid' | 'developer' | 'hidden';
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
    ...metadata,
    id: derivedId,
    name: metadata?.name || defaults.name,
    url,
    kind,
    tileMode: metadata?.tileMode || defaults.tileMode,
    seamless: metadata?.seamless ?? defaults.seamless,
    allowedTargets: metadata?.allowedTargets || defaults.allowedTargets,
    packId: metadata?.packId ?? inferredPackId,
    packName: metadata?.packName ?? inferredPackName,
    defaultBlendMode: metadata?.defaultBlendMode || defaults.defaultBlendMode,
    defaultOpacity: metadata?.defaultOpacity ?? defaults.defaultOpacity,
    defaultScale: metadata?.defaultScale ?? defaults.defaultScale,
    partRole: metadata?.partRole ?? defaults.partRole,
    defaultWidth: metadata?.defaultWidth ?? defaults.defaultWidth,
    defaultHeight: metadata?.defaultHeight ?? defaults.defaultHeight,
  };
};
