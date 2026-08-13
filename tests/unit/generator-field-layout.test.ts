import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/features/card-generator/components/GeneratorFieldGroups.tsx'),
  'utf8',
);

describe('single-output field layout', () => {
  it('uses one field column on phones and two once space is available', () => {
    expect(source.match(/className="grid grid-cols-1 gap-2 sm:grid-cols-2"/g)).toHaveLength(2);
    expect(source).not.toContain('className="grid grid-cols-2 gap-2"');
    expect(source).toContain('className="sm:col-span-2"');
  });

  it('does not change field width based on its content or editor type', () => {
    expect(source).not.toContain('shouldUseFullWidthGeneratorField');
    expect(source).not.toContain("? 'md:col-span-2'");
  });
});
