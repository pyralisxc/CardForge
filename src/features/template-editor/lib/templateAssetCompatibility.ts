import { resolveTemplateCardFormat } from '@/domain/card-formats';
import type { CardAssetOption, CardAssetOrientation, TCGCardTemplate } from '@/domain/templates';

export const getTemplateAssetOrientation = (
  template: TCGCardTemplate,
): CardAssetOrientation => {
  const { widthMm, heightMm } = resolveTemplateCardFormat(template);
  if (Math.abs(widthMm - heightMm) <= 0.05) return 'square';
  return widthMm > heightMm ? 'landscape' : 'portrait';
};

export const isTemplateAssetCompatible = (
  asset: CardAssetOption,
  template: TCGCardTemplate,
): boolean => (
  !asset.compatibleOrientations?.length
  || asset.compatibleOrientations.includes(getTemplateAssetOrientation(template))
);

export const filterCompatibleTemplateAssets = (
  assets: readonly CardAssetOption[],
  template: TCGCardTemplate,
): CardAssetOption[] => assets.filter((asset) => isTemplateAssetCompatible(asset, template));
