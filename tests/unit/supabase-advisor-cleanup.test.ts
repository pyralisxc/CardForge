import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607140002_database_advisor_cleanup.sql',
);

describe('Supabase advisor cleanup migration', () => {
  it('pins the trigger function search path', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain('alter function public.cardforge_touch_updated_at() set search_path = pg_catalog, public');
  });

  it('indexes the asset registry foreign key', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain('create index if not exists cardforge_asset_registry_developer_submission_id_idx');
    expect(sql).toContain('on public.cardforge_asset_registry (developer_submission_id)');
  });
});
