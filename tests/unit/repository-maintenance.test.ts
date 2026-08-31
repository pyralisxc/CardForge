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
      'smoke:ui': 'playwright test tests/smoke/account-contribution-ux.spec.ts --workers=1',
      'pipeline:sync-defaults': 'node scripts/sync-pipeline-defaults.mjs',
    });
    expect(packageJson.scripts).not.toHaveProperty('audit:site');
    expect(packageJson.scripts).not.toHaveProperty('bulk:generate');
    expect(packageJson.scripts).not.toHaveProperty('qa:setup-accounts');

    const envExample = await readFile(rootPath('.env.example'), 'utf8');
    expect(envExample).not.toContain('CARDFORGE_QA_ACCOUNT_PASSWORD');
    for (const connectedStorageVariable of [
      'CARDFORGE_GOOGLE_STORAGE_CLIENT_ID=',
      'CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET=',
      'CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY=',
      'CARDFORGE_GOOGLE_PICKER_API_KEY=',
      'CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER=',
    ]) {
      expect(envExample).toContain(connectedStorageVariable);
    }
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
      expect(route).not.toContain(".from('cardforge_contributor_asset_submissions')");
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
    expect(pipelineSync).toContain('must match exactly one active Forge Pipeline contributor profile');
    expect(pipelineSync).not.toContain(".upsert({\n      clerk_user_id: ownerProfile.clerk_user_id");
  });

  it('uses the Forge Pipeline as the only runtime template and style catalog', async () => {
    const catalog = await readFile(
      rootPath('src', 'features', 'pipeline', 'lib', 'repositoryCatalog.ts'),
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

  it('keeps Template revisions and their binary media under one durable owner', async () => {
    const [migration, compatibilityMigration, bootstrapOwnershipMigration, bootstrapSync, browserAssets, pipelineAssets, studioHandoff, ttrpg, nameCard, eventBadge] = await Promise.all([
      readFile(rootPath('supabase', 'migrations', '20260827090000_content_addressed_template_assets.sql'), 'utf8'),
      readFile(rootPath('supabase', 'migrations', '20260827103000_template_registry_runtime_compatibility.sql'), 'utf8'),
      readFile(rootPath('supabase', 'migrations', '20260828151709_bootstrap_template_payload_ownership.sql'), 'utf8'),
      readFile(rootPath('scripts', 'sync-pipeline-defaults.mjs'), 'utf8'),
      readFile(rootPath('src', 'features', 'project', 'persistence', 'contentAddressedBrowserAssets.ts'), 'utf8'),
      readFile(rootPath('src', 'features', 'pipeline', 'lib', 'pipelineTemplateAssets.ts'), 'utf8'),
      readFile(rootPath('src', 'features', 'studio-documents', 'server', 'templateWorkingDocuments.ts'), 'utf8'),
      readFile(rootPath('data', 'pipeline-bootstrap', 'templates', 'default-ttrpg-stat-sheet.json'), 'utf8'),
      readFile(rootPath('data', 'pipeline-bootstrap', 'templates', 'default-name-card-theme.json'), 'utf8'),
      readFile(rootPath('data', 'pipeline-bootstrap', 'templates', 'default-event-badge-theme.json'), 'utf8'),
    ]);

    expect(browserAssets).toContain("BROWSER_PROJECT_ASSET_REFERENCE_PREFIX = 'cardforge-browser-asset://'");
    expect(pipelineAssets).toContain("PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX = 'cardforge-pipeline-asset://'");
    expect(studioHandoff).toContain('storePipelineTemplateAsset(bytes)');
    expect(studioHandoff).not.toContain("bytes.toString('base64')");
    expect(migration).toContain('create table if not exists public.cardforge_pipeline_template_assets');
    expect(migration).toContain("metadata - 'template'");
    expect(migration).toContain('cardforge_template_payload_has_no_embedded_media');
    expect(migration).not.toContain("'template', submission.source_payload");
    expect(compatibilityMigration).toContain('Temporary one-release projection');
    expect(bootstrapOwnershipMigration).toContain("coalesce(p_metadata, '{}'::jsonb) - 'template' - 'payload'");
    expect(bootstrapOwnershipMigration).toContain('source_payload = p_template_payload');
    expect(bootstrapSync).toContain("supabase.rpc('cardforge_upsert_pipeline_template_asset'");
    expect(bootstrapSync).toContain('p_template_payload: item.template_payload');
    for (const bootstrapTemplate of [ttrpg, nameCard, eventBadge]) {
      expect(bootstrapTemplate).not.toContain('data:image/');
    }
  });

  it('keeps Pipeline upload and submission in one route', async () => {
    await expect(pathExists('src', 'app', 'api', 'pipeline', 'upload', 'route.ts')).resolves.toBe(false);
    const pipelineRoute = await readFile(
      rootPath('src', 'app', 'api', 'pipeline', 'route.ts'),
      'utf8',
    );
    expect(pipelineRoute).toContain('createUploadedPipelineSubmission');
  });

  it('makes unused TypeScript declarations a build failure', async () => {
    const tsconfig = JSON.parse(await readFile(rootPath('tsconfig.json'), 'utf8')) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions?.noUnusedLocals).toBe(true);
    expect(tsconfig.compilerOptions?.noUnusedParameters).toBe(true);
  });
});
