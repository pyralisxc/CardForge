import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('cloud Set mirror retirement', () => {
  it('removes every application-owned Cloud Mirror entry point', () => {
    const retiredPaths = [
      'src/app/api/cloud-sets/route.ts',
      'src/app/api/cloud-sets/prepare/route.ts',
      'src/features/project/model/cloudSet.ts',
      'src/features/project/hooks/useCloudSetActions.ts',
      'src/features/project/server/cloudSetStore.ts',
      'src/features/studio-documents/server/mcpCloudSetTools.ts',
      'src/features/studio-documents/server/mcpCloudSetBridge.ts',
    ];

    for (const path of retiredPaths) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(false);
    }
  });

  it('removes Cloud Mirror slots and tools from current runtime contracts', () => {
    const entitlements = readSource('src/domain/entitlements/index.ts');
    const environment = readSource('src/features/app-shell/environment/model.ts');
    const account = readSource('src/app/account/page.tsx');

    expect(entitlements).not.toContain('cloudSetLimit');
    expect(environment).not.toContain('cardforge-cloud');
    expect(environment).not.toContain('list_cloud_sets');
    expect(account).not.toContain('cloudSetLimit');
  });

  it('contracts the retired schema only after proving legacy data is empty', () => {
    const migration = readSource(
      'supabase/migrations/20260827063958_retire_cloud_set_mirror_schema.sql',
    );

    expect(migration).toContain('cardforge_cloud_set_mirrors_must_be_empty_before_retirement');
    expect(migration).toContain('cardforge_cloud_set_lineage_must_be_empty_before_retirement');
    expect(migration).toContain('drop column source_cloud_set_id');
    expect(migration).toContain('drop column source_cloud_revision');
    expect(migration).toContain('drop table public.cardforge_cloud_sets');
  });
});
