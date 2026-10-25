export interface SourceImageDetail {
  scope: string;
  naturalWidth: number;
  naturalHeight: number;
  placedWidthMm: number;
  placedHeightMm: number;
  effectivePpi: number;
}

/** Vector lengths preserve physical size under rotation and account for zoom. */
export const transformedImageDimensions = (width: number, height: number, matrix: { a: number; b: number; c: number; d: number }) => ({
  width: width * Math.hypot(matrix.a, matrix.b),
  height: height * Math.hypot(matrix.c, matrix.d),
});

/** Uses source pixels at their actual placed size, including object-fit crop. */
export const measureSourceImageDetail = ({ scope, naturalWidth, naturalHeight, boxWidthMm, boxHeightMm, objectFit }: {
  scope: string; naturalWidth: number; naturalHeight: number; boxWidthMm: number; boxHeightMm: number; objectFit: string;
}): SourceImageDetail | null => {
  if (![naturalWidth, naturalHeight, boxWidthMm, boxHeightMm].every((value) => Number.isFinite(value) && value > 0)) return null;
  let placedWidthMm = boxWidthMm;
  let placedHeightMm = boxHeightMm;
  if (objectFit === 'cover' || objectFit === 'contain' || objectFit === 'scale-down') {
    const scale = objectFit === 'cover'
      ? Math.max(boxWidthMm / naturalWidth, boxHeightMm / naturalHeight)
      : Math.min(boxWidthMm / naturalWidth, boxHeightMm / naturalHeight);
    placedWidthMm = naturalWidth * scale;
    placedHeightMm = naturalHeight * scale;
  }
  return { scope, naturalWidth, naturalHeight, placedWidthMm, placedHeightMm,
    effectivePpi: Math.min(naturalWidth / placedWidthMm, naturalHeight / placedHeightMm) * 25.4 };
};

/** CSS layer separators exclude commas inside gradients, functions and URLs. */
export const splitCssLayers = (value: string): string[] => {
  const layers: string[] = [];
  let start = 0, depth = 0, quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\\') { index += 1; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) { layers.push(value.slice(start, index).trim()); start = index + 1; }
  }
  layers.push(value.slice(start).trim());
  return layers;
};

/** Resolves CSS background-size against its positioning box, before transforms. */
export const backgroundImageDimensions = (naturalWidth: number, naturalHeight: number, boxWidth: number, boxHeight: number, size: string) => {
  if (size === 'cover' || size === 'contain') {
    const scale = size === 'cover' ? Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight) : Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
    return { width: naturalWidth * scale, height: naturalHeight * scale };
  }
  const [x = 'auto', y = 'auto'] = size.trim().split(/\s+/);
  const length = (value: string, box: number): number | null => value === 'auto' ? null
    : value.endsWith('%') ? parseFloat(value) / 100 * box : value.endsWith('px') || value === '0' ? parseFloat(value) : NaN;
  let width = length(x, boxWidth), height = length(y, boxHeight);
  if (width === null && height === null) { width = naturalWidth; height = naturalHeight; }
  else if (width === null) width = height! * naturalWidth / naturalHeight;
  else if (height === null) height = width * naturalHeight / naturalWidth;
  return { width: width!, height: height! };
};
