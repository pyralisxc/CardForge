import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260812063536_consolidate_developer_asset_registry.sql'),
  'utf8',
).toLowerCase().replace(/\s+/g, ' ');

describe('developer asset registry migration', () => {
  it('owns submission and registry transitions in one locked database command', () => {
    expect(migration).toContain('function public.cardforge_transition_developer_asset');
    expect(migration).toContain('for update');
    expect(migration).toContain('update public.cardforge_developer_asset_submissions');
    expect(migration).toContain('insert into public.cardforge_asset_registry');
    expect(migration).toContain('on conflict (asset_id) do update');
    expect(migration).toContain('security invoker');
    expect(migration).toContain("set search_path = ''");
  });

  it('keeps the transition command server-only', () => {
    expect(migration).toContain('revoke execute on function public.cardforge_transition_developer_asset');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.cardforge_transition_developer_asset');
    expect(migration).toContain('to service_role');
  });

  it('owns pipeline upserts and archives as atomic commands', () => {
    expect(migration).toContain('function public.cardforge_upsert_pipeline_registry_asset');
    expect(migration).toContain('function public.cardforge_archive_pipeline_registry_asset');
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain("raise exception 'pipeline_asset_not_found'");
    expect(migration).toContain('grant execute on function public.cardforge_upsert_pipeline_registry_asset');
    expect(migration).toContain('grant execute on function public.cardforge_archive_pipeline_registry_asset');
  });
});
