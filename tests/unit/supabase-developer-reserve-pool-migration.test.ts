import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260719111100_define_developer_reserve_pool.sql';

describe('developer reserve pool migration', () => {
  it('caps the roster at ten and makes the pool a share of the operating reserve', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('developer_reserve_share_percent integer not null default 50');
    expect(sql).toContain('check (max_active_developers between 1 and 10)');
    expect(sql).toContain('max_active_developers = least(max_active_developers, 10)');
    expect(sql).toContain('drop column if exists profit_share_pool_percent');
    expect(sql).toContain("'creator-pool',\n  3,");
    expect(sql).toContain("on conflict (slug, version) do update");
  });
});
