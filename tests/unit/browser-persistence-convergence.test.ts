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

describe('browser persistence convergence', () => {
  it('keeps product browser persistence in Project-owned IndexedDB', async () => {
    await expect(pathExists('src', 'features', 'project', 'persistence', 'preferences.ts')).resolves.toBe(true);
    const sourceFiles = await collectTypeScriptFiles(rootPath('src'));
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const source = await readFile(file, 'utf8');
      if (source.includes('localStorage')) offenders.push(path.relative(process.cwd(), file));
    }
    expect(offenders).toEqual([]);
  });

  it('folds Template Library behavior into Template Editor ownership', async () => {
    await expect(pathExists('src', 'features', 'template-library')).resolves.toBe(false);
    await expect(pathExists('src', 'features', 'template-editor', 'client.ts')).resolves.toBe(true);

    const shell = await readFile(
      rootPath('src', 'features', 'app-shell', 'components', 'CardForgeStudioShell.tsx'),
      'utf8',
    );
    expect(shell).toContain("from '@/features/template-editor/client'");
    expect(shell).not.toContain('@/features/template-library/');
  });
});
