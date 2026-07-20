import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = (...parts: string[]) => existsSync(rootPath(...parts));

const collectTypeScriptFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectTypeScriptFiles(entryPath));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(entryPath);
  }
  return files;
};

describe('browser persistence convergence', () => {
  it('keeps product browser persistence in Project-owned IndexedDB', () => {
    expect(pathExists('src', 'features', 'project', 'persistence', 'preferences.ts')).toBe(true);
    const sourceFiles = collectTypeScriptFiles(rootPath('src'));
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      if (source.includes('localStorage')) offenders.push(path.relative(process.cwd(), file));
    }
    expect(offenders).toEqual([]);
  });

  it('folds Template Library behavior into Template Editor ownership', () => {
    expect(pathExists('src', 'features', 'template-library')).toBe(false);
    expect(pathExists('src', 'features', 'template-editor', 'client.ts')).toBe(true);

    const shell = readFileSync(
      rootPath('src', 'features', 'app-shell', 'components', 'CardForgeStudioShell.tsx'),
      'utf8',
    );
    expect(shell).toContain("from '@/features/template-editor/client'");
    expect(shell).not.toContain('@/features/template-library/');
  });
});
