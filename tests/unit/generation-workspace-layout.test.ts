import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/features/card-generator/components/GenerationWorkspace.tsx'),
  'utf8',
);

describe('Generator workspace flow', () => {
  it('presents setup, generation, review, and export in top-to-bottom order', () => {
    const checkpoints = [
      'data-workflow-step="setup"',
      'data-workflow-step="generate"',
      'data-workflow-step="review"',
      'data-workflow-step="export"',
    ];

    let previousIndex = -1;
    for (const checkpoint of checkpoints) {
      const index = source.indexOf(checkpoint);
      expect(index, checkpoint).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
  });

  it('keeps one-card and list creation in the existing generator without hiding export in a tab', () => {
    expect(source).toContain('grid-cols-2');
    expect(source).toContain('value="single"');
    expect(source).toContain('value="bulk"');
    expect(source).not.toContain('value="export"');
    expect(source).not.toContain('lg:grid-cols-[340px_minmax(0,1fr)]');
  });

  it('uses a plain export summary and keeps detailed print controls collapsed', () => {
    expect(source).toContain('Print settings');
    expect(source).toContain('<details');
    expect(source).not.toContain('>Auth<');
    expect(source).not.toContain('>Session<');
    expect(source).not.toContain('>Access<');
    expect(source).not.toContain('>Account<');
  });
});
