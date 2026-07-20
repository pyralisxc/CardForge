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
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(entryPath);
    }
  }

  return files;
};

describe('domain model ownership', () => {
  it('keeps card studio contracts in focused domain modules', () => {
    expect(pathExists('src', 'types', 'index.ts')).toBe(false);
    expect(pathExists('src', 'domain', 'cards', 'index.ts')).toBe(true);
    expect(pathExists('src', 'domain', 'templates', 'index.ts')).toBe(true);
    expect(pathExists('src', 'domain', 'rendering', 'index.ts')).toBe(true);
  });

  it('does not restore imports from the retired type root', () => {
    const files = [
      ...collectTypeScriptFiles(rootPath('src')),
      ...collectTypeScriptFiles(rootPath('tests')),
    ];
    const retiredImport = `@${'/types'}`;
    const offenders: string[] = [];

    for (const file of files) {
      if (readFileSync(file, 'utf8').includes(retiredImport)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps domain dependencies one-way', () => {
    const cards = readFileSync(rootPath('src', 'domain', 'cards', 'types.ts'), 'utf8');
    const templates = readFileSync(rootPath('src', 'domain', 'templates', 'types.ts'), 'utf8');
    const rendering = readFileSync(rootPath('src', 'domain', 'rendering', 'types.ts'), 'utf8');

    expect(cards).not.toContain('@/domain/');
    expect(templates).toContain("from '@/domain/cards'");
    expect(templates).not.toContain("from '@/domain/rendering'");
    expect(rendering).toContain("from '@/domain/cards'");
    expect(rendering).toContain("from '@/domain/templates'");
  });
});
