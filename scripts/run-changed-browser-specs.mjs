import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const playwrightPatternsForSpecs = (specs, root = process.cwd()) => {
  if (!Array.isArray(specs) || specs.some((file) => typeof file !== 'string')) throw new Error('Expected a JSON array of browser specification paths.');
  return specs.map((file) => {
    if (!file.startsWith('tests/product/workflows/') || !file.endsWith('.spec.ts') || file.split('/').includes('..') || !existsSync(path.join(root, file))) {
      throw new Error(`Invalid browser specification: ${file}`);
    }
    return `${file.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`;
  });
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const patterns = playwrightPatternsForSpecs(JSON.parse(process.env.CHANGED_BROWSER_SPECS ?? '[]'));
    if (patterns.length) {
      const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...patterns, '--workers=1'], { stdio: 'inherit' });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
