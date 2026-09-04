import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildAffectedVerification,
  classifyChangedPath,
  specializedJobsForPath,
} from '../../scripts/report-affected-verification.mjs';
import { compactFailureTail, formatCiSummary } from '../../scripts/run-ci-check.mjs';

describe('agent verification routing', () => {
  it('routes a feature change to its exact owner, focused tests, and relevant documentation', async () => {
    const result = await buildAffectedVerification({
      root: process.cwd(),
      changedPaths: ['src/features/template-editor/lib/canvasCommands.ts'],
    });

    expect(result.owners).toEqual(['template-editor']);
    expect(result.tests).toContain('tests/product/unit/canvas-commands.test.ts');
    expect(result.tests).not.toContain('tests/product/unit/billing.test.ts');
    expect(result.docs).toContain('docs/architecture.md#card-and-template-model');
    expect(result.architectureBoundaryAffected).toBe(true);
    expect(result.providerVerification).toEqual([]);
  });

  it('preserves provider and risk guidance for a billing change', () => {
    expect(classifyChangedPath('src/features/billing/server/processStripeWebhook.ts')).toMatchObject({
      owner: 'billing',
      risk: 'high',
      providerVerification: 'Stripe',
    });
    expect(classifyChangedPath('src/features/project/client/provider-google-drive.ts')).toMatchObject({
      owner: 'project',
      risk: 'high',
      providerVerification: 'Google Drive',
    });
  });

  it('routes browser-owned changes to the existing golden job without treating server-only work as browser work', () => {
    expect(specializedJobsForPath('src/features/desk/components/Desk.tsx')).toEqual(['browser-golden']);
    expect(specializedJobsForPath('src/app/account/page.tsx')).toEqual(['browser-golden']);
    expect(specializedJobsForPath('src/features/billing/server/processStripeWebhook.ts')).toEqual([]);
    expect(specializedJobsForPath('docs/testing.md')).toEqual([]);
  });

  it('writes compact pass/failure summaries instead of requiring the full log for triage', () => {
    const noisyLog = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join('\n');
    expect(compactFailureTail(noisyLog).split('\n')).toHaveLength(40);
    expect(formatCiSummary({
      title: 'Repository gate',
      command: 'npm run verify:full',
      durationSeconds: 2.34,
      exitCode: 1,
      output: noisyLog,
    })).toContain('Failure tail');
  });

  it('owns the non-browser gate once and keeps the compact browser lane independently merge-protected', async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      workspaces: string[];
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const ci = await readFile(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const deploymentSmoke = await readFile(path.join(process.cwd(), '.github/workflows/deployment-smoke.yml'), 'utf8');
    const productionHealth = await readFile(path.join(process.cwd(), '.github/workflows/production-health.yml'), 'utf8');
    const scripts = packageJson.scripts;

    for (const workflow of [ci, deploymentSmoke, productionHealth]) {
      const runtimes = [...workflow.matchAll(/node-version: (\d+)/g)].map((match) => match[1]);
      expect(runtimes.length).toBeGreaterThan(0);
      expect(new Set(runtimes)).toEqual(new Set(['24']));
      expect(workflow).not.toMatch(/actions\/(?:checkout|setup-node)@v4/);
    }
    expect(deploymentSmoke.split('  production-smoke:')[1]).toContain('package-manager-cache: false');

    expect(scripts['test:infrastructure']).toBe('vitest run --config vitest.infrastructure.config.ts');
    expect(scripts['verify:focused']).toBe('node scripts/report-affected-verification.mjs --run');
    expect(scripts['architecture:report']).toBe('node scripts/check-architecture.mjs --report');
    expect(scripts['verify:full']).toBe([
      'npm run lint',
      'npm run typecheck',
      'npm run test:product',
      'npm run test:infrastructure',
      'npm run architecture:check',
      'npm run migrations:check',
      'npm run build',
    ].join(' && '));
    expect(scripts['smoke:golden']).toBe('playwright test --grep @golden --workers=1');
    expect(scripts['smoke:hosted']).toBe('playwright test --config playwright.hosted.config.ts --workers=1');
    expect(scripts['verify:full']).not.toContain('playwright');
    expect(ci).toContain('browser-golden:');
    expect(ci).toContain('fetch-depth: 2');
    expect(ci).toContain('--github-output');
    expect(ci).toContain('npx playwright install --with-deps chromium');
    expect(ci).toContain('npm run smoke:golden');
    expect(deploymentSmoke).toContain('types: [vercel.deployment.success]');
    expect(deploymentSmoke).toContain("github.event.client_payload.git.ref == 'vercel-preview'");
    expect(deploymentSmoke).toContain("github.event.client_payload.git.ref == 'main'");
    expect(deploymentSmoke).toContain('npm run smoke:hosted');
    expect(deploymentSmoke).toContain('--category=route');
    expect(productionHealth).toContain('cron: "7 */6 * * *"');
    expect(packageJson.workspaces).toContain('scripts/hosted-verification');
    const hostedPackage = JSON.parse(await readFile(path.join(process.cwd(), 'scripts/hosted-verification/package.json'), 'utf8'));
    expect(hostedPackage.private).toBe(true);
    expect(hostedPackage.dependencies).toEqual({
      '@playwright/test': packageJson.devDependencies['@playwright/test'],
      jszip: packageJson.dependencies.jszip,
    });
    for (const workflow of [deploymentSmoke, productionHealth]) {
      expect(workflow).toContain('npm ci --workspace @cardforge/hosted-verification --include-workspace-root=false --ignore-scripts');
    }
  });
});
