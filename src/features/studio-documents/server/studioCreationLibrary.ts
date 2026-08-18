import { CARD_FONT_OPTIONS, mergeCardFontOptions } from '@/domain/rendering';
import type { CardAssetOption, AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import {
  getCachedCardForgeStudioAssets,
  getCachedCardForgeStudioBootstrap,
} from '@/features/developer-assets/server/catalogCache';

export const STUDIO_CREATION_LIBRARY_KINDS = [
  'template',
  'style',
  'font',
  'texture',
  'divider',
  'icon',
  'image',
] as const;
export type StudioCreationLibraryKind = typeof STUDIO_CREATION_LIBRARY_KINDS[number];

export interface StudioCreationLibraryItem {
  id: string;
  name: string;
  kind: StudioCreationLibraryKind;
  description?: string;
  url?: string;
  value?: string;
  category?: string;
  packName?: string;
  allowedTargets?: string[];
  studioDestinations?: string[];
  defaultWidth?: number;
  defaultHeight?: number;
}

const templateItem = (template: TCGCardTemplate): StudioCreationLibraryItem => ({
  id: template.id ?? template.name,
  name: template.name,
  kind: 'template',
  description: template.templateDescription,
  category: template.templateCategory,
});

const styleItem = (style: AppearanceStylePreset): StudioCreationLibraryItem => ({
  id: style.id,
  name: style.name,
  kind: 'style',
  category: style.kind,
  allowedTargets: [...style.targets],
  studioDestinations: style.studioDestinations ? [...style.studioDestinations] : undefined,
});

const assetItem = (
  asset: CardAssetOption,
  kind: Extract<StudioCreationLibraryKind, 'texture' | 'divider' | 'icon' | 'image'>,
): StudioCreationLibraryItem => ({
  id: asset.id,
  name: asset.name,
  kind,
  url: asset.url,
  packName: asset.packName,
  allowedTargets: [...asset.allowedTargets],
  studioDestinations: asset.studioDestinations ? [...asset.studioDestinations] : undefined,
  defaultWidth: asset.defaultWidth,
  defaultHeight: asset.defaultHeight,
});

const searchableText = (item: StudioCreationLibraryItem): string => [
  item.id,
  item.name,
  item.kind,
  item.description,
  item.category,
  item.packName,
  ...(item.allowedTargets ?? []),
  ...(item.studioDestinations ?? []),
].filter(Boolean).join(' ').toLowerCase();

export const searchStudioCreationLibrary = async ({
  query = '',
  kinds,
  limit = 20,
}: {
  query?: string;
  kinds?: StudioCreationLibraryKind[];
  limit?: number;
}): Promise<StudioCreationLibraryItem[]> => {
  const [bootstrap, assetManifest] = await Promise.all([
    getCachedCardForgeStudioBootstrap('dev'),
    getCachedCardForgeStudioAssets('dev'),
  ]);
  const fonts = mergeCardFontOptions(CARD_FONT_OPTIONS, bootstrap.fonts.fonts ?? []);
  const items: StudioCreationLibraryItem[] = [
    ...bootstrap.templates.defaults.map(templateItem),
    ...bootstrap.styles.styles.map(styleItem),
    ...fonts.map((font) => ({
      id: font.value,
      name: font.name,
      kind: 'font' as const,
      value: font.value,
      category: font.category,
      url: font.sourceUrl,
    })),
    ...assetManifest.assets.textures.map((asset) => assetItem(asset, 'texture')),
    ...assetManifest.assets.dividers.map((asset) => assetItem(asset, 'divider')),
    ...assetManifest.assets.icons.map((asset) => assetItem(asset, 'icon')),
    ...assetManifest.assets.imageAssets.map((asset) => assetItem(asset, 'image')),
  ];
  const allowedKinds = kinds && kinds.length > 0 ? new Set(kinds) : null;
  const normalizedQuery = query.trim().toLowerCase();
  const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));

  return items
    .filter((item) => !allowedKinds || allowedKinds.has(item.kind))
    .filter((item) => !normalizedQuery || searchableText(item).includes(normalizedQuery))
    .sort((left, right) => {
      if (!normalizedQuery) return left.name.localeCompare(right.name);
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      const leftStarts = leftName.startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = rightName.startsWith(normalizedQuery) ? 0 : 1;
      return leftStarts - rightStarts || leftName.localeCompare(rightName);
    })
    .slice(0, boundedLimit);
};
