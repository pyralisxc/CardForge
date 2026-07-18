import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_LEGAL_DOCUMENTS } from '@/features/legal/client';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260717074826_billing_purpose_support.sql',
);
const consolidationMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260718053529_consolidate_public_routes_and_sharing.sql',
);

describe('billing purpose support migration', () => {
  it('adds constrained purpose reporting and a service-role-only v2 claim RPC', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain("billing_purpose in ('product_access', 'creator_support', 'unmatched')");
    expect(sql).toContain("billing_offering in ('creator_pass', 'support_one_time', 'support_monthly')");
    expect(sql).toContain('create or replace function public.cardforge_begin_billing_event_v2');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).not.toContain('create policy');
    expect(sql).toContain('create table if not exists public.cardforge_billing_entitlement_locks');
    expect(sql).toContain('alter table public.cardforge_billing_entitlement_locks enable row level security');
    expect(sql).toContain('cardforge_acquire_billing_entitlement_lock');
    expect(sql).toContain('cardforge_release_billing_entitlement_lock');
  });

  it('keeps unmatched subscription events out of the ordering baseline', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain("p_billing_purpose <> 'unmatched'");
    expect(sql).toContain("processing_status = 'ignored'");
    expect(sql).toContain("return 'stale'");
  });

  it('accepts same-second subscription events for current-state reconciliation', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain('excluded.last_event_created_at >= public.cardforge_billing_subscriptions.last_event_created_at');
    expect(sql).not.toContain('excluded.last_event_id >= public.cardforge_billing_subscriptions.last_event_id');
  });

  it('published the original payment-lane terms as immutable versions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const slug of ['supporter-terms', 'refund'] as const) {
      expect(sql).toContain(`'${slug}'`);
    }
    expect(sql.toLowerCase()).toContain('max(version)');
    expect(sql.toLowerCase()).toContain("date '2026-07-17'");
  });

  it('publishes the current consolidated-route terms as later immutable versions', async () => {
    const sql = await readFile(consolidationMigrationPath, 'utf8');
    for (const slug of ['supporter-terms', 'refund'] as const) {
      const document = DEFAULT_LEGAL_DOCUMENTS.find((candidate) => candidate.slug === slug);
      expect(document).toBeDefined();
      expect(sql).toContain(document!.body);
    }
    expect(sql.toLowerCase()).toContain('max(existing.version)');
    expect(sql.toLowerCase()).toContain("date '2026-07-17'");
  });
});
