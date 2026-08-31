import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const preCutoverServerTables = [
  'cardforge_asset_registry',
  'cardforge_contact_requests',
  'cardforge_developer_asset_submissions',
  'cardforge_developer_asset_votes',
  'cardforge_developer_profiles',
  'cardforge_developer_program_settings',
  'cardforge_owner_settings',
  'cardforge_roadmap_items',
  'cardforge_roadmap_votes',
  'cardforge_site_content_blocks',
];

describe('legacy server table grants', () => {
  it('makes the fresh-project service-role boundary explicit', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260824000100_grant_legacy_server_tables_service_role.sql'),
      'utf8',
    );

    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
    for (const table of preCutoverServerTables) {
      expect(migration).toContain(`public.${table}`);
    }
  });
});
