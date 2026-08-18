import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Studio mobile boot', () => {
  it('keeps the heavy Studio runtime out of the initial route module', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');
    const loader = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/StudioRuntimeLoader.tsx'),
      'utf8',
    );

    expect(page).toContain('StudioRuntimeLoader');
    expect(page).not.toContain("from '@/features/app-shell/client/studio'");
    expect(page).not.toContain('<CardForgeStudioShell');
    expect(loader).toContain("dynamic(");
    expect(loader).toContain("import('./CardForgeStudioShell')");
    expect(loader).toContain('shouldLoadRuntime');
    expect(loader).toContain('requestIdleCallback');
  });

  it('renders an explicit lightweight Studio loading state before runtime hydration', () => {
    const loader = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/StudioRuntimeLoader.tsx'),
      'utf8',
    );

    expect(loader).toContain('Opening CardForge Studio');
    expect(loader).toContain('The editor is loading separately so the page can become responsive first.');
    expect(loader).toContain('role="status"');
  });
});
