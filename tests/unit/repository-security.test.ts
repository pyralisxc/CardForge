import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

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

  it('fails authenticated production smoke when protected configuration is incomplete', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/authenticated-smoke.yml'),
      'utf8',
    );
    const requiredSecrets = [
      'CARDFORGE_E2E_FREE_EMAIL',
      'CARDFORGE_E2E_PAID_EMAIL',
      'CARDFORGE_E2E_DEV_EMAIL',
      'CARDFORGE_E2E_OWNER_EMAIL',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    expect(workflow).toContain('Verify required protected secrets');
    expect(workflow).toContain('CARDFORGE_E2E_REQUIRE_AUTH: "true"');
    expect(workflow).toContain('Missing required protected secrets');
    for (const secret of requiredSecrets) {
      expect(workflow).toContain(secret);
    }
  });

  it('retains reviewable authenticated smoke evidence on success and failure', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/authenticated-smoke.yml'),
      'utf8',
    );

    expect(workflow).toContain('Upload authenticated smoke evidence');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('playwright-report');
    expect(workflow).toContain('test-results');
  });

  it('bootstraps protected reusable QA identities before authenticated browser tests', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/authenticated-smoke.yml'),
      'utf8',
    );
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const bootstrapScript = readFileSync(
      join(process.cwd(), 'scripts/bootstrap-authenticated-smoke-users.mjs'),
      'utf8',
    );
    const verifyIndex = workflow.indexOf('Verify required protected secrets');
    const bootstrapIndex = workflow.indexOf('Ensure reusable Clerk QA accounts');
    const playwrightIndex = workflow.indexOf('npx playwright install --with-deps chromium');

    expect(packageJson.scripts?.['qa:bootstrap-authenticated-smoke']).toBe(
      'node scripts/bootstrap-authenticated-smoke-users.mjs',
    );
    expect(workflow).toContain('npm run qa:bootstrap-authenticated-smoke');
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(bootstrapIndex).toBeGreaterThan(verifyIndex);
    expect(playwrightIndex).toBeGreaterThan(bootstrapIndex);
    expect(bootstrapScript).toContain('summarizeQaBootstrap');
    expect(bootstrapScript).not.toContain('console.error(error)');
    expect(bootstrapScript).not.toContain('account.email');
    expect(bootstrapScript).not.toContain('account.userId');
  });

  it('keeps routine Dependabot updates below major versions', () => {
    const dependabot = readFileSync(join(process.cwd(), '.github/dependabot.yml'), 'utf8');

    expect(dependabot).toContain('development-minor-and-patch');
    expect(dependabot).toContain('production-minors');
    expect(dependabot).toContain('github-actions-minor-and-patch');
    expect(dependabot.match(/version-update:semver-major/g)).toHaveLength(2);
  });

  it('records an explicit status and evidence for every launch risk', () => {
    const riskRegister = readFileSync(join(process.cwd(), 'docs/risk-register.md'), 'utf8');

    expect(riskRegister).toContain('| Area | Risk | Priority | Status | Evidence / next review |');
    expect(riskRegister).toContain('Implemented; live proof open');
    expect(riskRegister).toContain('29766156342');
    expect(riskRegister).toContain('Accepted');
    expect(riskRegister).toContain('Closed');
  });

  it('documents the provider-owned launch closure procedure', () => {
    const operations = readFileSync(join(process.cwd(), 'docs/operations.md'), 'utf8');

    expect(operations).toContain('Authenticated production smoke');
    expect(operations).toContain('ledgerCreated');
    expect(operations).toContain('Stripe Workbench');
    expect(operations).toContain('Solo-maintainer branch rule');
  });
});
