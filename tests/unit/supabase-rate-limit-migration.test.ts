import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/202607140003_abuse_rate_limits.sql');

describe('abuse rate-limit migration', () => {
  it('creates an atomic service-only limiter', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain('create table if not exists public.cardforge_rate_limit_buckets');
    expect(sql).toContain('security definer');
    expect(sql).toContain('revoke execute on function public.cardforge_consume_rate_limit(text, integer, integer) from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.cardforge_consume_rate_limit(text, integer, integer) to service_role');
    expect(sql).toContain('revoke all on table public.cardforge_rate_limit_buckets from public, anon, authenticated');
  });
});
