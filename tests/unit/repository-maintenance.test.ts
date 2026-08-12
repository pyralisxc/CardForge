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
      ['src', 'components', 'card-forge', 'CardPreview.tsx'],
      ['src', 'lib', 'cardPreviewExport.tsx'],
      ['src', 'types', 'index.ts'],
      ['config', 'architecture-baseline.json'],
      ['docs', 'architecture-refactor-design.md'],
      ['docs', 'architecture-refactor-plans'],
      ['AGENTS-snippet.md'],
      ['data', 'user-templates'],
      ['docs', 'cardforge-public-identity-overhaul-design.md'],
      ['docs', 'showcase-homepage-design.md'],
      ['docs', 'stripe-support-rollout.md'],
      ['output'],
    ];

    for (const retiredPath of retiredPaths) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('records ownership for the architecture foundation', async () => {
    const codeowners = await readFile(rootPath('.github', 'CODEOWNERS'), 'utf8');

    expect(codeowners).toContain('/src/domain/ @pyralisxc');
    expect(codeowners).toContain('/src/features/card-rendering/ @pyralisxc');
    expect(codeowners).toContain('/src/shared/ @pyralisxc');
  });

  it('exposes only maintained QA and operations scripts', async () => {
    const packageJson = JSON.parse(await readFile(rootPath('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      'architecture:check': 'node scripts/check-architecture.mjs',
      'migrations:check': 'node scripts/check-migration-safety.mjs',
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

  it('runs zero-exception architecture enforcement in normal CI', async () => {
    const ci = await readFile(rootPath('.github', 'workflows', 'ci.yml'), 'utf8');

    expect(ci).toContain('npm run architecture:check');
    await expect(pathExists('config', 'architecture-baseline.json')).resolves.toBe(false);
  });

  it('keeps shared-library persistence behind atomic feature commands', async () => {
    const [templateRoute, styleRoute, pipelineSync] = await Promise.all([
      readFile(rootPath('src', 'app', 'api', 'templates', 'route.ts'), 'utf8'),
      readFile(rootPath('src', 'app', 'api', 'styles', 'route.ts'), 'utf8'),
      readFile(rootPath('scripts', 'sync-pipeline-defaults.mjs'), 'utf8'),
    ]);

    for (const route of [templateRoute, styleRoute]) {
      expect(route).not.toContain(".from('cardforge_asset_registry')");
      expect(route).not.toContain(".from('cardforge_developer_asset_submissions')");
    }
    expect(templateRoute).not.toMatch(/fs\.(?:writeFile|unlink|mkdir)/u);
    expect(pipelineSync).toContain("rpc('cardforge_upsert_pipeline_registry_asset'");
    expect(pipelineSync).not.toContain(".from('cardforge_asset_registry')");
  });

  it('keeps developer upload and submission in one route', async () => {
    await expect(pathExists('src', 'app', 'api', 'developer-assets', 'upload', 'route.ts')).resolves.toBe(false);
    const developerAssetRoute = await readFile(
      rootPath('src', 'app', 'api', 'developer-assets', 'route.ts'),
      'utf8',
    );
    expect(developerAssetRoute).toContain('createUploadedDeveloperAssetSubmission');
  });

  it('makes unused TypeScript declarations a build failure', async () => {
    const tsconfig = JSON.parse(await readFile(rootPath('tsconfig.json'), 'utf8')) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions?.noUnusedLocals).toBe(true);
    expect(tsconfig.compilerOptions?.noUnusedParameters).toBe(true);
  });
});
