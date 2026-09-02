import { accessSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const exists = (path: string): boolean => {
  try {
    accessSync(join(process.cwd(), path));
    return true;
  } catch {
    return false;
  }
};

describe('repository security defaults', () => {
  it('does not publish the retired privileged owner identity', () => {
    const files = [
      'AGENTS.md',
      'src/app/api/templates/route.ts',
      'src/app/api/styles/route.ts',
      'scripts/sync-pipeline-defaults.mjs',
      'supabase/migrations/202605220003_owner_console.sql',
    ];

    for (const file of files) {
      expect(readFileSync(join(process.cwd(), file), 'utf8').toLowerCase()).not.toContain('cameron.r.locke96');
    }
  });

  it('keeps the retired reusable-QA identity system out of the repository', () => {
    for (const path of [
      '.github/workflows/authenticated-smoke.yml',
      'scripts/bootstrap-authenticated-smoke-users.mjs',
      'scripts/lib/authenticated-smoke-qa.mjs',
      'tests/product/workflows/auth-account.spec.ts',
      'tests/product/workflows/paid-project-import.spec.ts',
      'tests/product/unit/authenticated-smoke-qa.test.ts',
    ]) {
      expect(exists(path), path).toBe(false);
    }

    const entitlement = readFileSync(
      join(process.cwd(), 'src/features/account/lib/accountEntitlement.ts'),
      'utf8',
    );
    expect(entitlement).not.toContain('CARDFORGE_E2E_');
  });

  it('keeps routine Dependabot updates below major versions', () => {
    const dependabot = readFileSync(join(process.cwd(), '.github/dependabot.yml'), 'utf8');

    expect(dependabot).toContain('development-minor-and-patch');
    expect(dependabot).toContain('production-minors');
    expect(dependabot).toContain('github-actions-minor-and-patch');
    expect(dependabot.match(/version-update:semver-major/g)).toHaveLength(2);
  });

  it('documents live-provider verification without claiming automated auth proof', () => {
    const operations = readFileSync(join(process.cwd(), 'docs/operations.md'), 'utf8');

    expect(operations).toContain('Authenticated production smoke');
    expect(operations).toContain('former reusable QA accounts were retired');
    expect(operations).toContain('real signed-in owner/contributor account');
    expect(operations).toContain('ledgerCreated');
    expect(operations).toContain('Stripe Workbench');
    expect(operations).toContain('Solo-maintainer branch rule');
  });
});
