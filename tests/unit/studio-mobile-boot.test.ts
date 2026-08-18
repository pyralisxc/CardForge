import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Studio mobile boot', () => {
  it('keeps the heavy Studio runtime and workspace hydration out of the initial route module', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');
    const publicStudioClient = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/client/studio.ts'),
      'utf8',
    );
    const loader = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/StudioRuntimeLoader.tsx'),
      'utf8',
    );

    expect(page).toContain("import { StudioRuntimeLoader } from '@/features/app-shell/client/studio'");
    expect(page).not.toContain('CardForgeStudioShell');
    expect(page).not.toContain('useProjectStore');
    expect(publicStudioClient).toContain('StudioRuntimeLoader');
    expect(loader).toContain('dynamic(');
    expect(loader).toContain("import('./ScopedCardForgeStudioShell')");
    expect(loader).not.toContain('useProjectStore');
    expect(loader).toContain('shouldLoadRuntime');
    expect(loader).toContain('requestIdleCallback');
  });

  it('stages scoped workspace hydration after the lightweight route shell', () => {
    const loader = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/StudioRuntimeLoader.tsx'),
      'utf8',
    );
    const scopedShell = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/ScopedCardForgeStudioShell.tsx'),
      'utf8',
    );
    const workspaceStore = readFileSync(
      resolve(process.cwd(), 'src/features/project/store/workspaceStore.ts'),
      'utf8',
    );

    expect(loader).toContain('Opening CardForge Studio');
    expect(loader).toContain('The editor is loading separately so the page can become responsive first.');
    expect(scopedShell).toContain('hydrateProjectWorkspaceForScope(persistenceScope)');
    expect(scopedShell).toContain('Restoring your Studio workspace');
    expect(workspaceStore).toContain('skipHydration: true');
    expect(loader).toContain('role="status"');
  });
});
