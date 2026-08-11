import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607140001_harden_privileged_functions.sql'
);
const retirementMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260811183544_retire_founder_beta.sql'
);

describe('privileged Supabase function hardening migration', () => {
  it('removes the retired promotion RPC and tables', () => {
    const sql = readFileSync(retirementMigrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain(
      'drop function if exists public.cardforge_claim_founder_beta(text, text)'
    );
    expect(sql).toContain(
      'drop table if exists public.cardforge_founder_beta_claims'
    );
    expect(sql).toContain(
      'drop table if exists public.cardforge_founder_beta_campaigns'
    );
    expect(sql).toContain("raise exception 'cardforge_developer_contribution_cockpit_required'");
  });

  it('makes future public-schema functions private by default', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain(
      'alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated'
    );
  });
});
