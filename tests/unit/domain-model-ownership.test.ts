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
    if (entry.isDirectory()) {
      files.push(...await collectTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(entryPath);
    }
  }

  return files;
};

describe('domain model ownership', () => {
  it('keeps card studio contracts in focused domain modules', async () => {
    await expect(pathExists('src', 'types', 'index.ts')).resolves.toBe(false);
    await expect(pathExists('src', 'domain', 'cards', 'index.ts')).resolves.toBe(true);
    await expect(pathExists('src', 'domain', 'templates', 'index.ts')).resolves.toBe(true);
    await expect(pathExists('src', 'domain', 'rendering', 'index.ts')).resolves.toBe(true);
  });

  it('does not restore imports from the retired type root', async () => {
    const files = [
      ...await collectTypeScriptFiles(rootPath('src')),
      ...await collectTypeScriptFiles(rootPath('tests')),
    ];
    const retiredImport = `@${'/types'}`;
    const offenders: string[] = [];

    for (const file of files) {
      if ((await readFile(file, 'utf8')).includes(retiredImport)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps domain dependencies one-way', async () => {
    const cards = await readFile(rootPath('src', 'domain', 'cards', 'types.ts'), 'utf8');
    const templates = await readFile(rootPath('src', 'domain', 'templates', 'types.ts'), 'utf8');
    const rendering = await readFile(rootPath('src', 'domain', 'rendering', 'types.ts'), 'utf8');

    expect(cards).not.toContain('@/domain/');
    expect(templates).toContain("from '@/domain/cards'");
    expect(templates).not.toContain("from '@/domain/rendering'");
    expect(rendering).toContain("from '@/domain/cards'");
    expect(rendering).toContain("from '@/domain/templates'");
  });
});
