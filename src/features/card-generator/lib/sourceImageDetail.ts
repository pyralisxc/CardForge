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
