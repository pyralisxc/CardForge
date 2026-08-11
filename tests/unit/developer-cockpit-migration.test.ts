import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260727090000_developer_contribution_cockpit.sql',
);

describe('developer contribution cockpit migration', () => {
  it('creates durable campaign, delivery, and site proposal ledgers', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain('create table if not exists public.cardforge_social_campaigns');
    expect(sql).toContain('create table if not exists public.cardforge_social_publish_jobs');
    expect(sql).toContain('create table if not exists public.cardforge_site_content_proposals');
    expect(sql).toContain('can_draft_campaigns boolean not null default false');
    expect(sql).toContain('can_propose_site_content boolean not null default false');
  });

  it('keeps every cockpit table and storage bucket behind server-side access', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain('alter table public.cardforge_social_campaigns enable row level security');
    expect(sql).toContain('revoke all privileges on public.cardforge_social_campaigns, public.cardforge_campaign_media');
    expect(sql).toContain("values ('cardforge-social-sources', 'cardforge-social-sources', false");
    expect(sql).toContain("values ('cardforge-social-media', 'cardforge-social-media', true");
    expect(sql).toContain('grant all privileges on public.cardforge_social_campaigns, public.cardforge_campaign_media');
    expect(sql).not.toContain('all sequences in schema public');
  });

  it('uses canonical media records, relational attachments, derivatives, and idempotency', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain('create table if not exists public.cardforge_campaign_media');
    expect(sql).toContain('create table if not exists public.cardforge_campaign_media_derivatives');
    expect(sql).toContain('create table if not exists public.cardforge_social_campaign_media_attachments');
    expect(sql).toContain('create table if not exists public.cardforge_social_campaign_associations');
    expect(sql).toContain('unique (content_hash)');
    expect(sql).toContain('creation_idempotency_key');
    expect(sql).not.toContain('source_reference');
    expect(sql).not.toContain('license_notes');
  });

  it('restricts atomic site publication to the service role and rejects stale proposals', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

    expect(sql).toContain('security invoker');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('revoke execute on function public.cardforge_publish_site_content_proposal');
    expect(sql).toContain('grant execute on function public.cardforge_publish_site_content_proposal');
    expect(sql).toContain('current site copy changed after this proposal was created');
    expect(sql).toContain('expected_version');
  });
});
