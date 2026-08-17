import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260816193738_native_marketing_command_center.sql',
  ),
  'utf8',
).toLowerCase();

describe('native marketing command center migration', () => {
  it('separates strategy, campaign grouping, destinations, connections, and deliveries', () => {
    expect(migration).toContain('create table public.cardforge_marketing_strategy');
    expect(migration).toContain('create table public.cardforge_marketing_campaigns');
    expect(migration).toContain('create table public.cardforge_marketing_destinations');
    expect(migration).toContain('create table public.cardforge_marketing_connections');
    expect(migration).toContain('alter table public.cardforge_social_campaigns');
    expect(migration).toContain('marketing_campaign_id uuid');
    expect(migration).toContain('content_pillar text');
    expect(migration).toContain('funnel_stage text');
    expect(migration).toContain('cardforge_marketing_strategy_touch_updated_at');
  });

  it('replaces Buffer delivery with native Meta and manual destinations', () => {
    expect(migration).toContain('drop constraint if exists cardforge_social_publish_jobs_provider_check');
    expect(migration).toContain("provider in ('meta', 'manual')");
    expect(migration).toContain('destination_id uuid');
    expect(migration).toContain("delivery_mode in ('automatic', 'manual')");
    expect(migration).toContain('publication_url text');
    expect(migration).toContain('cardforge_social_campaign_media_attachments_service_check');
    expect(migration).toContain("'provider_image'");
    expect(migration).toContain("mime_type in ('image/webp', 'image/jpeg')");
    expect(migration).not.toContain("'buffer'");
  });

  it('protects server-owned tables and provides an atomic delivery claim', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all privileges');
    expect(migration).toContain('grant all privileges');
    expect(migration).toContain('for update skip locked');
    expect(migration).toContain("set status = 'unknown'");
    expect(migration).toContain("stale_job.status = 'publishing'");
    expect(migration).toContain('cardforge_claim_due_marketing_deliveries');
    expect(migration).toContain('cardforge_create_marketing_content');
    expect(migration).toContain('cardforge_update_marketing_content');
    expect(migration).toContain('marketing_campaign_id = p_marketing_campaign_id');
  });

  it('migrates existing content into a real campaign without fixed generated IDs', () => {
    expect(migration).toContain("'founder_beta'");
    expect(migration).toContain('returning id into');
    expect(migration).toContain('cardforge_assign_default_marketing_campaign');
    expect(migration).toContain('before insert on public.cardforge_social_campaigns');
    expect(migration).not.toMatch(/marketing_campaign_id\s*=\s*'[0-9a-f-]{36}'/u);
  });
});
