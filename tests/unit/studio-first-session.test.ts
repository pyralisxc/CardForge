import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio first-session experience', () => {
  const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');
  const bulkInput = readSource('src/features/card-generator/components/BulkCsvInputPanel.tsx');
  const gallery = readSource('src/features/card-generator/components/GeneratedCardGallery.tsx');
  const alerts = readSource('src/features/project/components/BrowserStorageAlerts.tsx');

  it('uses actionable existing-Studio choices instead of the retired step list', () => {
    expect(shell).toContain('Welcome to the forge');
    expect(shell).toContain('Start making cards');
    expect(shell).toContain('Design the layout first');
    expect(shell).toContain("setActiveTabAction('generator')");
    expect(shell).toContain("setActiveTabAction('template-maker')");
    expect(shell).not.toContain('const firstRunSteps');
  });

  it('leads list creation with plain text while keeping every supported start available', () => {
    expect(bulkInput).toContain("useState<BulkStarterChoice>('text')");
    for (const option of ['Plain text starter', 'Example CSV', 'Example JSON', 'Upload a file', 'Start blank']) {
      expect(bulkInput).toContain(option);
    }
    expect(bulkInput).toContain('Use text starter');
    expect(bulkInput).toContain('Choose file');
  });

  it('makes the existing card editor visible for every selected gallery card', () => {
    expect(gallery).toContain('Edit card');
    expect(gallery).toContain('onEditCardRequest(cardItem)');
    expect(gallery).toContain('aria-label={hasRepeatedExportButtons');
  });

  it('keeps backup guidance accurate for both project-file capability states', () => {
    expect(alerts).toContain('canUseProjectFiles');
    expect(alerts).toContain('Download a project backup periodically');
    expect(alerts).toContain('Portable project backups are available with Creator Pass.');
  });
});
