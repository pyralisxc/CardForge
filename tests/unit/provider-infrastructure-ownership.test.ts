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

describe('provider infrastructure ownership', () => {
  it('has no root catch-all library', async () => {
    await expect(pathExists('src', 'lib')).resolves.toBe(false);
  });

  it('keeps provider and HTTP adapters under Infrastructure', async () => {
    const requiredPaths = [
      ['src', 'infrastructure', 'auth', 'clerk.ts'],
      ['src', 'infrastructure', 'database', 'supabaseServer.ts'],
      ['src', 'infrastructure', 'http', 'apiResponses.ts'],
      ['src', 'infrastructure', 'http', 'apiValidation.ts'],
      ['src', 'infrastructure', 'http', 'publicUrl.ts'],
      ['src', 'infrastructure', 'http', 'serverTiming.ts'],
      ['src', 'infrastructure', 'security', 'abuseProtection.ts'],
      ['src', 'shared', 'asyncTimeout.ts'],
    ];

    for (const requiredPath of requiredPaths) {
      await expect(pathExists(...requiredPath), requiredPath.join('/')).resolves.toBe(true);
    }
  });

  it('keeps generator error copy with Card Generator', async () => {
    await expect(pathExists('src', 'features', 'card-generator', 'lib', 'errorCopy.ts')).resolves.toBe(true);
  });

  it('exposes operational features through declared interfaces', async () => {
    for (const feature of ['account', 'app-shell', 'billing', 'owner']) {
      const hasClient = await pathExists('src', 'features', feature, 'client.ts');
      const hasClientDirectory = await pathExists('src', 'features', feature, 'client');
      const hasServer = await pathExists('src', 'features', feature, 'server.ts');
      expect(hasClient || hasClientDirectory || hasServer, `${feature} needs a declared interface`).toBe(true);
    }
  });

  it('keeps the Next proxy entry as thin composition', async () => {
    const proxy = await readFile(rootPath('src', 'proxy.ts'), 'utf8');
    expect(proxy).toContain("from '@/infrastructure/auth/middleware'");
    expect(proxy.split(/\r?\n/u).length).toBeLessThanOrEqual(20);
  });
});
