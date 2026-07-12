import type { CardData, FreeformCardElement } from '@/types';

export const IMAGE_FIELD_OVERRIDE_DATA_PREFIX = '__cardforgeImageField.';

export type ImageFieldOverrideProperty =
  | 'fit'
  | 'positionX'
  | 'positionY'
  | 'flipX'
  | 'flipY'
  | 'scale'
  | 'offsetX'
  | 'offsetY'
  | 'rotation'
  | 'frameX'
  | 'frameY'
  | 'frameWidth'
  | 'frameHeight';

export const IMAGE_FIELD_OVERRIDE_PROPERTIES: ImageFieldOverrideProperty[] = [
  'fit',
  'positionX',
  'positionY',
  'flipX',
  'flipY',
  'scale',
  'offsetX',
  'offsetY',
  'rotation',
  'frameX',
  'frameY',
  'frameWidth',
  'frameHeight',
];

const imageOverrideProperties = new Set<ImageFieldOverrideProperty>(IMAGE_FIELD_OVERRIDE_PROPERTIES);
const validFits = new Set<NonNullable<FreeformCardElement['imageObjectFit']>>(['cover', 'contain', 'fill', 'none']);
const cssPositionKeywords = new Set(['left', 'center', 'right', 'top', 'bottom']);
const truthyValues = new Set(['true', '1', 'yes', 'on']);

export interface ParsedImageFieldOverrideColumn {
  fieldKey: string;
  property: ImageFieldOverrideProperty;
}

export interface ResolvedImageElementOverrides {
  element: FreeformCardElement;
  imageStyle: {
    objectFit: NonNullable<FreeformCardElement['imageObjectFit']>;
    objectPosition: string;
    transform: string;
  };
}

export const buildImageFieldOverrideDataKey = (
  fieldKey: string,
  property: ImageFieldOverrideProperty,
): string => `${IMAGE_FIELD_OVERRIDE_DATA_PREFIX}${fieldKey}.${property}`;

const isImageFieldOverrideProperty = (value: string): value is ImageFieldOverrideProperty =>
  imageOverrideProperties.has(value as ImageFieldOverrideProperty);

export const parseImageFieldOverrideColumnHeader = (
  header: string,
  fieldKeys: Iterable<string>,
): ParsedImageFieldOverrideColumn | null => {
  const trimmed = header.trim();
  if (!trimmed) return null;

  const candidates = Array.from(fieldKeys)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const fieldKey of candidates) {
    const prefix = `${fieldKey}.image.`;
    if (!trimmed.startsWith(prefix)) continue;
    const property = trimmed.slice(prefix.length);
    if (isImageFieldOverrideProperty(property)) return { fieldKey, property };
  }

  return null;
};

export const isRecognizedImageFieldOverrideColumn = (header: string, fieldKeys: Iterable<string>): boolean =>
  parseImageFieldOverrideColumnHeader(header, fieldKeys) !== null;

const stringValue = (value: CardData[string]): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  return raw || undefined;
};

const numberValue = (value: CardData[string]): number | undefined => {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const booleanValue = (value: CardData[string]): boolean | undefined => {
  const raw = stringValue(value);
  if (!raw) return undefined;
  return truthyValues.has(raw.toLowerCase());
};

const positionValue = (value: CardData[string], fallback: string): string => {
  const raw = stringValue(value);
  if (!raw) return fallback;
  if (cssPositionKeywords.has(raw.toLowerCase())) return raw.toLowerCase();
  if (/^-?\d+(\.\d+)?%$/.test(raw) || /^-?\d+(\.\d+)?px$/.test(raw)) return raw;
  return fallback;
};

const getDataValue = (
  data: CardData,
  fieldKey: string,
  property: ImageFieldOverrideProperty,
): CardData[string] => data[buildImageFieldOverrideDataKey(fieldKey, property)];

export const buildImageTransform = ({
  offsetX = 0,
  offsetY = 0,
  rotation = 0,
  scale = 1,
  flipX = false,
  flipY = false,
}: {
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scale?: number;
  flipX?: boolean;
  flipY?: boolean;
}): string => [
  `translate(${offsetX}px, ${offsetY}px)`,
  `rotate(${rotation}deg)`,
  `scale(${scale})`,
  flipX ? 'scaleX(-1)' : null,
  flipY ? 'scaleY(-1)' : null,
].filter(Boolean).join(' ');

export const resolveImageElementOverrides = (
  element: FreeformCardElement,
  data: CardData,
  fieldKey: string | undefined,
): ResolvedImageElementOverrides => {
  const fitRaw = fieldKey ? stringValue(getDataValue(data, fieldKey, 'fit')) : undefined;
  const objectFit = fitRaw && validFits.has(fitRaw as NonNullable<FreeformCardElement['imageObjectFit']>)
    ? fitRaw as NonNullable<FreeformCardElement['imageObjectFit']>
    : element.imageObjectFit || 'cover';
  const positionX = fieldKey
    ? positionValue(getDataValue(data, fieldKey, 'positionX'), element.imageObjectPositionX || 'center')
    : element.imageObjectPositionX || 'center';
  const positionY = fieldKey
    ? positionValue(getDataValue(data, fieldKey, 'positionY'), element.imageObjectPositionY || 'center')
    : element.imageObjectPositionY || 'center';
  const scale = Math.max(0.05, fieldKey ? numberValue(getDataValue(data, fieldKey, 'scale')) ?? element.imageScale ?? 1 : element.imageScale ?? 1);
  const offsetX = fieldKey ? numberValue(getDataValue(data, fieldKey, 'offsetX')) ?? element.imageOffsetX ?? 0 : element.imageOffsetX ?? 0;
  const offsetY = fieldKey ? numberValue(getDataValue(data, fieldKey, 'offsetY')) ?? element.imageOffsetY ?? 0 : element.imageOffsetY ?? 0;
  const rotation = fieldKey ? numberValue(getDataValue(data, fieldKey, 'rotation')) ?? element.imageRotation ?? 0 : element.imageRotation ?? 0;
  const contentFlipX = fieldKey ? booleanValue(getDataValue(data, fieldKey, 'flipX')) ?? false : false;
  const contentFlipY = fieldKey ? booleanValue(getDataValue(data, fieldKey, 'flipY')) ?? false : false;

  return {
    element: {
      ...element,
      x: fieldKey ? numberValue(getDataValue(data, fieldKey, 'frameX')) ?? element.x : element.x,
      y: fieldKey ? numberValue(getDataValue(data, fieldKey, 'frameY')) ?? element.y : element.y,
      width: fieldKey ? numberValue(getDataValue(data, fieldKey, 'frameWidth')) ?? element.width : element.width,
      height: fieldKey ? numberValue(getDataValue(data, fieldKey, 'frameHeight')) ?? element.height : element.height,
      imageObjectFit: objectFit,
      imageObjectPositionX: positionX,
      imageObjectPositionY: positionY,
      imageScale: scale,
      imageOffsetX: offsetX,
      imageOffsetY: offsetY,
      imageRotation: rotation,
    },
    imageStyle: {
      objectFit,
      objectPosition: `${positionX} ${positionY}`,
      transform: buildImageTransform({ offsetX, offsetY, rotation, scale, flipX: contentFlipX, flipY: contentFlipY }),
    },
  };
};
