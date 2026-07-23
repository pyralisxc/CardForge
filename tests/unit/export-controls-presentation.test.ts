import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const controlsSource = readFileSync(
  resolve(process.cwd(), 'src/features/card-generator/components/ExportControlsPanel.tsx'),
  'utf8',
);
const individualSource = readFileSync(
  resolve(process.cwd(), 'src/features/card-generator/components/ExportCardImageButton.tsx'),
  'utf8',
);

describe('export controls presentation', () => {
  it('makes each destination and its quality ownership explicit', () => {
    expect(controlsSource).toContain('Individual images and PNG set');
    expect(controlsSource).toContain('Print PDF');
    expect(controlsSource).toContain('Tabletop Simulator');
    expect(controlsSource).toContain('Fixed 4K PNG');
    expect(controlsSource).toContain('Raster images have fixed pixels');
    expect(controlsSource).toContain('Estimated PNG ZIP size');
    expect(controlsSource).toContain('does not affect this export');
  });

  it('does not advertise a browser TIFF fallback as a real TIFF file', () => {
    expect(individualSource.toLowerCase()).not.toContain('tiff');
    expect(individualSource).toContain('blob.type !== mimeType');
  });
});
