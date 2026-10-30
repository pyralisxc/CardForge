import { normalizeAppearanceForElement, type FreeformCardElement, type CardAssetOption } from '@/domain/templates';
import { isSvgAssetSource } from '@/domain/templates/vectorAssets';
import { appearanceToElementRenderFields } from '@/features/card-rendering/client';
import { DEFAULT_DIVIDER_SIZE } from './elementKits';

/** Only the empty native seed adopts catalog geometry; later choices preserve authored layout. */
export function buildDividerLibrarySelection(element: FreeformCardElement, asset: CardAssetOption): Partial<FreeformCardElement> {
  const previous = normalizeAppearanceForElement(element);
  const appearance = {
    ...previous, dividerAsset: asset.url, assetKind: 'divider' as const,
    assetRenderMode: isSvgAssetSource(asset.url) ? 'original' as const : undefined,
    textureOpacity: asset.defaultOpacity ?? 100, blendMode: asset.defaultBlendMode ?? 'normal',
    tileMode: asset.tileMode ?? 'stretch', shapeRole: 'divider' as const,
    material: { ...previous.material, baseColor: 'transparent', texture: { kind: 'none' as const } },
    border: { ...previous.border, kind: 'none' as const, width: 0 },
  };
  const isDefault = element.type === 'shape' && element.shapeKind === 'line' && element.shapeRole === 'divider'
    && element.width === DEFAULT_DIVIDER_SIZE.width && element.height === DEFAULT_DIVIDER_SIZE.height
    && !previous.dividerAsset && !previous.assetSource && !element.backgroundImageUrl
    && !previous.material?.texture?.assetSource && !previous.material?.texture?.imageSource;
  const recommended = Number.isFinite(asset.defaultWidth) && Number.isFinite(asset.defaultHeight)
    && asset.defaultWidth! > 0 && asset.defaultHeight! > 0;
  return { appearance, ...appearanceToElementRenderFields({ ...element, appearance }),
    ...(isDefault && recommended ? { width: asset.defaultWidth, height: asset.defaultHeight } : {}) };
}
