import { describe, expect, it } from 'vitest';

import { rasterizeSvgToPng } from '@/lib/server/sharpRaster';

describe('Sharp raster foundation', () => {
  it('rasterizes SVG card art to explicit PNG dimensions', async () => {
    const svg = `
      <svg width="63" height="88" viewBox="0 0 63 88" xmlns="http://www.w3.org/2000/svg">
        <rect width="63" height="88" fill="#020617"/>
        <rect x="4" y="4" width="55" height="80" rx="4" fill="none" stroke="#14f1ff" stroke-width="1.5"/>
        <text x="31.5" y="44" text-anchor="middle" font-size="6" fill="#f8fafc">CardForge</text>
      </svg>
    `;

    const result = await rasterizeSvgToPng(svg, 744, 1039);

    expect(result.widthPx).toBe(744);
    expect(result.heightPx).toBe(1039);
    expect(result.bytes.byteLength).toBeGreaterThan(1000);
    expect(Array.from(result.bytes.slice(1, 4)).map((value) => String.fromCharCode(value)).join('')).toBe('PNG');
  });
});
