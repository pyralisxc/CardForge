/** Canonical render inputs. Printable names, content and arbitrary card columns
 * are not resources merely because their text resembles a URI. */
export const imageSourceFields = new Set([
  'imageSource', 'iconImageSource', 'assetSource', 'dividerAsset',
  'cardBackgroundImageUrl', 'cardBorderImageSource', 'backgroundImageUrl',
]);
export const cssImageFields = new Set(['backgroundImage', 'borderImageSource']);
export const printableDataFields = new Set(['templatePreviewData', 'data', 'backingData']);
export const isRenderResourceField = (key: string) => imageSourceFields.has(key) || cssImageFields.has(key);
