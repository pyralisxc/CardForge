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
      'smoke:ui': 'playwright test tests/smoke/developer-cockpit-ux.spec.ts --workers=1',
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
    expect(pipelineSync).toContain(".from('cardforge_asset_registry')");
    expect(pipelineSync).toContain(".from('cardforge_pipeline_asset_tombstones')");
    expect(pipelineSync).toContain('existingRegistryByAssetId');
    expect(pipelineSync).toContain('preserved ${items.length - newItems.length} existing owner decisions');
    expect(pipelineSync).toContain("rpc('cardforge_migrate_pipeline_registry_storage'");
    expect(pipelineSync).toContain("rpc('cardforge_migrate_pipeline_registry_metadata_urls'");
    expect(pipelineSync).toContain('CARDFORGE_OWNER_ACCOUNT_EMAILS');
    expect(pipelineSync).not.toContain('CARDFORGE_E2E_OWNER_EMAIL');
    expect(pipelineSync).not.toContain('CARDFORGE_PIPELINE_OWNER_EMAIL');
    expect(pipelineSync).not.toContain(".eq('decision_reason', 'pipeline_owner_edit')");
    expect(pipelineSync).toContain('configuredOwnerEmail');
    expect(pipelineSync).toContain('must match exactly one active Forge Pipeline developer profile');
    expect(pipelineSync).not.toContain(".upsert({\n      clerk_user_id: ownerProfile.clerk_user_id");
  });

  it('uses the Forge Pipeline as the only runtime template and style catalog', async () => {
    const catalog = await readFile(
      rootPath('src', 'features', 'developer-assets', 'lib', 'repositoryCatalog.ts'),
      'utf8',
    );

    expect(catalog).toContain('getPublishedRegistryContentRows');
    expect(catalog).not.toContain("from 'fs'");
    expect(catalog).not.toContain("from 'path'");
    expect(catalog).not.toContain('data/default-templates');
    expect(catalog).not.toContain('data/styles');
    expect(catalog).not.toContain('readBuiltIn');
    expect(catalog.match(/id: row\.asset_id/g)).toHaveLength(2);
    expect(catalog).not.toContain('id: template.id || row.asset_id');
    expect(catalog).not.toContain('id: style.id || row.asset_id');
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
