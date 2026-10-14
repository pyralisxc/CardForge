import { describe, expect, it } from 'vitest';
import { measureSourceImageDetail, transformedImageDimensions, splitCssLayers, backgroundImageDimensions } from '@/features/card-generator/lib/sourceImageDetail';

describe('Source detail at placed size', () => {
  it('preserves layered gradients and data URLs when splitting CSS backgrounds', () => {
    expect(splitCssLayers('linear-gradient(rgb(1, 2, 3), red), url("data:image/png;base64,a,b")')).toEqual(['linear-gradient(rgb(1, 2, 3), red)', 'url("data:image/png;base64,a,b")']);
  });
  it('measures CSS sizing at actual placement including crop, percentages and intrinsic repetition', () => {
    expect(backgroundImageDimensions(1200, 600, 50, 50, 'cover')).toEqual({ width: 100, height: 50 });
    expect(backgroundImageDimensions(1200, 600, 50, 50, 'contain')).toEqual({ width: 50, height: 25 });
    expect(backgroundImageDimensions(1200, 600, 50, 50, '50% auto')).toEqual({ width: 25, height: 12.5 });
    expect(backgroundImageDimensions(1200, 600, 50, 50, 'auto')).toEqual({ width: 1200, height: 600 });
    expect(backgroundImageDimensions(1200, 600, 50, 50, '20px 30px')).toEqual({ width: 20, height: 30 });
  });
  it('preserves source detail under rotation while accounting for artwork zoom', () => {
    const c = Math.SQRT1_2;
    expect(transformedImageDimensions(50, 50, { a: c, b: c, c: -c, d: c }).width).toBeCloseTo(50);
    expect(transformedImageDimensions(50, 50, { a: c * 2, b: c * 2, c: -c * 2, d: c * 2 }).height).toBeCloseTo(100);
  });
  it('does not mistake an upscaled export canvas for original artwork detail', () => {
    const detail = measureSourceImageDetail({ scope: 'artwork', naturalWidth: 64, naturalHeight: 64,
      boxWidthMm: 63, boxHeightMm: 88, objectFit: 'cover' });
    expect(detail!.effectivePpi).toBeCloseTo(64 / 88 * 25.4);
  });
  it('accounts for cover cropping and preserves high detail for small icons', () => {
    const cover = measureSourceImageDetail({ scope: 'cover', naturalWidth: 1200, naturalHeight: 600,
      boxWidthMm: 50, boxHeightMm: 50, objectFit: 'cover' });
    expect(cover!.placedWidthMm).toBe(100);
    expect(cover!.effectivePpi).toBeCloseTo(304.8);
    const icon = measureSourceImageDetail({ scope: 'icon', naturalWidth: 64, naturalHeight: 64,
      boxWidthMm: 2, boxHeightMm: 2, objectFit: 'contain' });
    expect(icon!.effectivePpi).toBeGreaterThan(800);
  });
  it('does not fabricate detail for unloaded or unplaced images', () => {
    expect(measureSourceImageDetail({ scope: 'missing', naturalWidth: 0, naturalHeight: 0,
      boxWidthMm: 10, boxHeightMm: 10, objectFit: 'cover' })).toBeNull();
  });
});
