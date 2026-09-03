import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildAffectedVerification,
  classifyChangedPath,
} from '../../scripts/report-affected-verification.mjs';

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

  it('owns the non-browser gate once and keeps the compact browser lane independently merge-protected', async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const ci = await readFile(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const scripts = packageJson.scripts;

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
    expect(scripts['verify:full']).not.toContain('playwright');
    expect(ci).toContain('browser-golden:');
    expect(ci).toContain('npx playwright install --with-deps chromium');
    expect(ci).toContain('npm run smoke:golden');
  });
});
