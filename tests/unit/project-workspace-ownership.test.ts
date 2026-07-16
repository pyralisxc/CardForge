import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = async (...parts: string[]) => {
  try {
    await access(rootPath(...parts));
    return true;
  } catch {
    return false;
  }
};

const collectTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTypeScriptFiles(entryPath));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(entryPath);
  }

  return files;
};

describe('project workspace ownership', () => {
  it('owns workspace state, persistence, assets, and project documents behind one client interface', async () => {
    const ownedPaths = [
      ['src', 'features', 'project', 'client.ts'],
      ['src', 'features', 'project', 'model', 'projectDocument.ts'],
      ['src', 'features', 'project', 'persistence', 'indexedDbStorage.ts'],
      ['src', 'features', 'project', 'persistence', 'projectAssets.ts'],
      ['src', 'features', 'project', 'store', 'workspaceStore.ts'],
      ['src', 'features', 'project', 'store', 'templateSlice.ts'],
      ['src', 'features', 'project', 'store', 'outputSlice.ts'],
      ['src', 'features', 'project', 'store', 'appearanceSlice.ts'],
      ['src', 'features', 'project', 'store', 'settingsSlice.ts'],
      ['src', 'features', 'project', 'store', 'selectors.ts'],
    ];

    for (const ownedPath of ownedPaths) {
      await expect(pathExists(...ownedPath), ownedPath.join('/')).resolves.toBe(true);
    }
  });

  it('does not restore the root store or old Project paths', async () => {
    const retiredPaths = [
      ['src', 'store', 'appStore.ts'],
      ['src', 'store', 'selectors.ts'],
      ['src', 'features', 'project', 'lib', 'browserStorage.ts'],
      ['src', 'features', 'project', 'lib', 'projectAccess.ts'],
      ['src', 'features', 'project', 'lib', 'projectDocument.ts'],
      ['src', 'features', 'project', 'lib', 'projectLocalAssets.ts'],
      ['src', 'features', 'project', 'lib', 'serverProjectAccess.ts'],
    ];

    for (const retiredPath of retiredPaths) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('keeps Project independent from product workflows and legacy roots', async () => {
    const files = await collectTypeScriptFiles(rootPath('src', 'features', 'project'));
    const forbidden = [
      '@/features/account/',
      '@/features/card-generator/',
      '@/features/developer-assets/',
      '@/features/template-editor/',
      '@/lib/',
      '@/store/',
    ];
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (forbidden.some((token) => source.includes(token))) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('allows consumers to import Project only through declared interfaces', async () => {
    const sourceFiles = await collectTypeScriptFiles(rootPath('src'));
    const projectRoot = `${path.sep}features${path.sep}project${path.sep}`;
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      if (file.includes(projectRoot)) continue;
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/from\s+['"](@\/features\/project\/[^'"]+)['"]/g)) {
        if (match[1] !== '@/features/project/client' && match[1] !== '@/features/project/server') {
          offenders.push(`${path.relative(process.cwd(), file)} -> ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('uses direct IndexedDB persistence without app-store or localStorage compatibility', async () => {
    const projectFiles = await collectTypeScriptFiles(rootPath('src', 'features', 'project'));
    const projectSource = (await Promise.all(projectFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    const productionFiles = await collectTypeScriptFiles(rootPath('src'));
    const productionSource = (await Promise.all(productionFiles.map((file) => readFile(file, 'utf8')))).join('\n');

    expect(projectSource).not.toContain('createMigratingBrowserStorage');
    expect(projectSource).not.toContain('localStorage');
    expect(productionSource).not.toContain("@/store/");
    expect(productionSource).not.toContain('useAppStore');
    expect(projectSource).toContain('indexedDB');
  });
});
