import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisplayCard } from '@/domain/rendering';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardPreview } from '@/features/card-rendering/components/CardPreview';
vi.mock('@/features/card-rendering/client', () => ({ CardPreview: () => null, DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR: '#fff' }));
import { clampProductionBackgroundRasterRounding, extendCardTrimCanvasToProductionBleed } from '@/features/card-generator/lib/cardPreviewExport';
import { compositeWhiteRgb } from '@/features/card-generator/lib/pressPdfCandidate';

const card = { uniqueId: 'print-proof', data: {}, template: { id: 'template', name: 'Template', aspectRatio: '63:88' } } as DisplayCard;
afterEach(() => vi.unstubAllGlobals());

const canvas = (alpha = 255) => ({ width: 630, height: 880, getContext: () => ({
  getImageData: () => ({ data: new Uint8ClampedArray([244, 226, 187, alpha]) }),
}) }) as unknown as HTMLCanvasElement;

describe('rectangular production background and clamped bleed', () => {
  it('projects the resolved authored background without changing the ordinary digital mask or border', () => {
    const source = { ...card, template: { ...card.template,
      baseBackgroundColor: '#f4e2bb', cardBackgroundImageUrl: '/authored-frame.png',
      cardBorderWidth: '3px', cardBorderStyle: 'solid', cardBorderColor: '#123456', cardBorderRadius: '22px',
    } } as DisplayCard;
    const normal = renderToStaticMarkup(createElement(CardPreview, { card: source, interactionOverlay: 'foreground' }));
    const background = renderToStaticMarkup(createElement(CardPreview, { card: source, productionLayer: 'background', interactionOverlay: 'foreground' }));
    const mask = renderToStaticMarkup(createElement(CardPreview, { card: source, productionLayer: 'mask' }));
    expect(normal).toContain('border-radius:22px');
    expect(normal).toContain('border-color:#123456');
    expect(normal).toContain('foreground');
    expect(background).toContain('border-radius:0');
    expect(background).toContain('border-width:3px');
    expect(background).toContain('border-color:transparent');
    expect(background).toContain('background-color:#f4e2bb');
    expect(background).toContain('background-image:url(/authored-frame.png)');
    expect(background).not.toContain('foreground');
    expect(mask).toContain('border-radius:22px');
    expect(mask).toContain('background-color:#fff');
    expect(mask).toContain('background-image:none');
  });

  it('clamps only independent physical raster rounding, not real background gaps', () => {
    const edge = { data: new Uint8ClampedArray([244, 226, 187, 254]) };
    const getImageData = vi.fn(() => edge), putImageData = vi.fn();
    const background = { width: 744, height: 1040, getContext: () => ({ getImageData, putImageData }) } as unknown as HTMLCanvasElement;
    clampProductionBackgroundRasterRounding(card, 'front', background, 744, 1040);
    expect(getImageData).toHaveBeenCalledWith(0, 1038, 744, 1);
    expect(putImageData).toHaveBeenCalledExactlyOnceWith(edge, 0, 1039);
    expect(edge.data[3]).toBe(254);
    getImageData.mockClear();
    clampProductionBackgroundRasterRounding(card, 'front', background, 744, 1050);
    expect(getImageData).not.toHaveBeenCalled();
  });

  it('extends only nearest background edge pixels, never reflected finished-card bands', () => {
    const context = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), putImageData: vi.fn() };
    const production = { width: 0, height: 0, getContext: () => context };
    vi.stubGlobal('document', { createElement: () => production });
    const trim = canvas(), background = canvas();
    const output = extendCardTrimCanvasToProductionBleed(card, 'front', trim, background, canvas());
    expect([output.width, output.height]).toEqual([690, 940]);
    expect(context.scale).not.toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledWith(background, 0, 0, 1, 880, 0, 30, 30, 880);
    expect(context.drawImage).toHaveBeenCalledWith(background, 0, 0, 630, 1, 30, 0, 630, 30);
    expect(context.drawImage).toHaveBeenCalledTimes(8);
    expect(context.putImageData).toHaveBeenCalledWith(expect.objectContaining({ data: new Uint8ClampedArray([244, 226, 187, 255]) }), 30, 30);
  });

  it('preserves intrinsic interior alpha and adds only missing outer-mask coverage', () => {
    const width = 63, height = 88;
    const pixels = () => new Uint8ClampedArray(width * height * 4).fill(255);
    const trim = pixels(), background = pixels(), mask = pixels();
    const interior = (10 * width + 10) * 4;
    const partial = (11 * width + 10) * 4;
    const opaqueBorder = (12 * width + 10) * 4;
    const missingCorner = 0;
    trim.set([0, 0, 0, 128], interior); background.set([0, 0, 0, 128], interior);
    trim.set([80, 40, 20, 64], partial); background.set([160, 100, 60, 128], partial); mask[partial + 3] = 128;
    trim.set([10, 20, 30, 255], opaqueBorder); background.set([200, 0, 0, 255], opaqueBorder); mask[opaqueBorder + 3] = 0;
    trim.set([0, 0, 0, 0], missingCorner); background.set([244, 226, 187, 255], missingCorner); mask[missingCorner + 3] = 0;
    const source = trim.slice();
    const pixelCanvas = (data: Uint8ClampedArray) => ({ width, height, getContext: () => ({
      getImageData: (x: number, y: number, w: number, h: number) => {
        const region = new Uint8ClampedArray(w * h * 4);
        for (let row = 0; row < h; row++) region.set(data.subarray(((y + row) * width + x) * 4, ((y + row) * width + x + w) * 4), row * w * 4);
        return { data: region, width: w, height: h };
      },
    }) }) as unknown as HTMLCanvasElement;
    const putImageData = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn(), putImageData }) }) });
    extendCardTrimCanvasToProductionBleed(card, 'front', pixelCanvas(trim), pixelCanvas(background), pixelCanvas(mask));
    const result: Uint8ClampedArray = putImageData.mock.calls[0][0].data;
    expect([...result.slice(interior, interior + 4)]).toEqual([0, 0, 0, 128]);
    expect([...compositeWhiteRgb(result.slice(interior, interior + 4))]).toEqual([127, 127, 127]);
    expect([...result.slice(partial, partial + 4)]).toEqual([120, 70, 40, 128]);
    expect([...result.slice(opaqueBorder, opaqueBorder + 4)]).toEqual([10, 20, 30, 255]);
    expect([...result.slice(missingCorner, missingCorner + 4)]).toEqual([244, 226, 187, 255]);
    for (let i = 0; i < mask.length; i += 4) {
      if (mask[i + 3] === 255) expect(result.slice(i, i + 4)).toEqual(source.slice(i, i + 4));
    }
    expect(trim).toEqual(source);
  });

  it('rejects genuinely transparent bleed backgrounds instead of inventing missing artwork', () => {
    expect(() => extendCardTrimCanvasToProductionBleed(card, 'front', canvas(), canvas(0), canvas())).toThrow(/opaque.*background/i);
    const mismatched = canvas(); mismatched.width = 10;
    expect(() => extendCardTrimCanvasToProductionBleed(card, 'front', canvas(), mismatched, canvas())).toThrow(/dimensions/i);
  });
});
