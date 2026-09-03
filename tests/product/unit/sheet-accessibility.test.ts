import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('sheet accessibility', () => {
  it('keeps the shared close control comfortably touch sized without enlarging its icon', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/ui/sheet.tsx'),
      'utf8',
    );

    expect(source).toContain('inline-flex size-11 items-center justify-center');
    expect(source).toContain('<X className="h-4 w-4" />');
  });
});
