import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607140001_harden_privileged_functions.sql'
);

describe('privileged Supabase function hardening migration', () => {
  it('removes public execution and keeps the Founder Beta RPC server-only', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain(
      'revoke execute on function public.cardforge_claim_founder_beta(text, text) from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant execute on function public.cardforge_claim_founder_beta(text, text) to service_role'
    );
    expect(sql).toContain(
      'revoke execute on function public.rls_auto_enable() from public, anon, authenticated'
    );
  });

  it('makes future public-schema functions private by default', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain(
      'alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated'
    );
  });
});
