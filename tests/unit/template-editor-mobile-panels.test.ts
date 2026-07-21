import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('template editor mobile panels', () => {
  it('lets the visible mobile panel own vertical scrolling instead of clipping its nested viewport', () => {
    const styles = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(styles).toContain('overflow-y: auto;');
    expect(styles).toContain('.cardforge-maker-scroll [data-radix-scroll-area-viewport]');
    expect(styles).toContain('overflow: visible !important;');
    expect(styles).toContain('-webkit-overflow-scrolling: touch;');
  });
});
