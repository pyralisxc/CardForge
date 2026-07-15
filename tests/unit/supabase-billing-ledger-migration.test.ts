import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/202607140004_billing_event_ledger.sql');

describe('billing ledger migration', () => {
  it('creates a private event ledger and ordered subscription state', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain('create table if not exists public.cardforge_billing_events');
    expect(sql).toContain('stripe_event_id text primary key');
    expect(sql).toContain('create table if not exists public.cardforge_billing_subscriptions');
    expect(sql).toContain('last_event_created_at timestamptz not null');
    expect(sql).toContain('revoke all on table public.cardforge_billing_events from public, anon, authenticated');
  });

  it('deduplicates, retries failures, and rejects stale subscription events atomically', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain('create or replace function public.cardforge_begin_billing_event');
    expect(sql).toContain("processing_status = 'failed'");
    expect(sql).toContain("return 'duplicate'");
    expect(sql).toContain("return 'stale'");
    expect(sql).toContain('grant execute on function public.cardforge_begin_billing_event(text, bigint, text, text, text, text) to service_role');
  });
});
