import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Studio contextual boot', () => {
  it('keeps /studio as a compatibility translator and one contextual Studio runtime', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');
    const publicStudioClient = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/client/studio.ts'),
      'utf8',
    );
    const shell = readFileSync(resolve(process.cwd(), 'src/features/app-shell/components/CardForgeStudioShell.tsx'), 'utf8');

    expect(page).toContain('createContextualStudioHref');
    expect(page).toContain('redirect(contextualHref)');
    expect(page).not.toContain('CardForgeStudioShell');
    expect(page).not.toContain('useProjectStore');
    expect(publicStudioClient).toContain('CardForgeStudioShell');
    expect(publicStudioClient).not.toContain('StudioRuntimeLoader');
    expect(shell).toContain('data-studio-presentation="contextual-tool"');
    expect(shell).not.toContain('StudioCommandBar');
  });
});
