import { access, readFile } from 'node:fs/promises';
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

describe('repository maintenance policy', () => {
  it('keeps completed planning and local editor artifacts out of the live tree', async () => {
    const retiredPaths = [
      ['.vscode', 'settings.json'],
      ['docs', 'superpowers'],
      ['scripts', 'audit-site-health.mjs'],
      ['scripts', 'generate-bulk-csv.mjs'],
      ['scripts', 'setup-qa-accounts.mjs'],
      ['src', 'types', 'index.ts'],
    ];

    for (const retiredPath of retiredPaths) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('records ownership for the domain foundation', async () => {
    const codeowners = await readFile(rootPath('.github', 'CODEOWNERS'), 'utf8');

    expect(codeowners).toContain('/src/domain/ @pyralisxc');
  });

  it('exposes only maintained QA and operations scripts', async () => {
    const packageJson = JSON.parse(await readFile(rootPath('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      'architecture:check': 'node scripts/check-architecture.mjs',
      'health:production': 'node scripts/check-production-health.mjs',
      'qa:bootstrap-authenticated-smoke': 'node scripts/bootstrap-authenticated-smoke-users.mjs',
      'pipeline:sync-defaults': 'node scripts/sync-pipeline-defaults.mjs',
    });
    expect(packageJson.scripts).not.toHaveProperty('audit:site');
    expect(packageJson.scripts).not.toHaveProperty('bulk:generate');
    expect(packageJson.scripts).not.toHaveProperty('qa:setup-accounts');

    const envExample = await readFile(rootPath('.env.example'), 'utf8');
    expect(envExample).not.toContain('CARDFORGE_QA_ACCOUNT_PASSWORD');
  });

  it('runs the shrinking architecture baseline in normal CI', async () => {
    const ci = await readFile(rootPath('.github', 'workflows', 'ci.yml'), 'utf8');

    expect(ci).toContain('npm run architecture:check');
    await expect(pathExists('config', 'architecture-baseline.json')).resolves.toBe(true);
  });

  it('makes unused TypeScript declarations a build failure', async () => {
    const tsconfig = JSON.parse(await readFile(rootPath('tsconfig.json'), 'utf8')) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions?.noUnusedLocals).toBe(true);
    expect(tsconfig.compilerOptions?.noUnusedParameters).toBe(true);
  });
});
