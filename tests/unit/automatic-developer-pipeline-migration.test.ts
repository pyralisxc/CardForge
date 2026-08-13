import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813181619_automatic_developer_pipeline.sql'),
  'utf8',
).toLowerCase().replace(/\s+/g, ' ');

describe('automatic developer pipeline migration', () => {
  it('stores automatic recommendations separately from persistent owner overrides', () => {
    expect(migration).toContain('add column if not exists automated_status');
    expect(migration).toContain('add column if not exists owner_status_override');
    expect(migration).toContain('add column if not exists automated_access_tier');
    expect(migration).toContain("coalesce(submission.owner_status_override, decisions.automated_status)");
    expect(migration).toContain('submission.owner_access_tier_override');
  });

  it('casts votes, recalculates totals, ranks tiers, and syncs the registry in one transaction', () => {
    expect(migration).toContain('create or replace function public.cardforge_cast_developer_asset_vote');
    expect(migration).toContain('cardforge_rebalance_developer_asset_pipeline');
    expect(migration).toContain('cardforge_sync_developer_asset_registry');
    expect(migration).toContain('pg_advisory_xact_lock');
  });

  it('keeps one authoritative published revision from being overwritten by older lineage rows', () => {
    expect(migration).toContain('current_active_submission_id');
    expect(migration).toContain('current_active_submission_id <> submission.id');
    expect(migration).toContain('submission.revision_number <= current_revision');
    expect(migration).toContain("decision_reason = 'superseded_revision'");
    expect(migration).toContain('and not exists ( select 1 from public.cardforge_asset_registry as registry');
    expect(migration).toContain("submission.revision_number > current_revision and submission.status <> 'published'");
    expect(migration).toContain("case when submission.status = 'published' then 0 else 1 end");
    expect(migration).toContain('submission.quality_score desc');
  });

  it('keeps every privileged function service-role-only', () => {
    for (const signature of [
      'cardforge_sync_developer_asset_registry(uuid)',
      'cardforge_rebalance_developer_asset_pipeline(text)',
      'cardforge_cast_developer_asset_vote(uuid, text, text, text)',
      'cardforge_update_developer_program_settings(jsonb, text)',
      'cardforge_set_developer_asset_owner_override(uuid, boolean, text, boolean, text, text, text)',
      'cardforge_migrate_pipeline_registry_storage(text, text, text, text, text, bigint, text)',
      'cardforge_migrate_pipeline_registry_metadata_urls(text, jsonb)',
    ]) {
      expect(migration).toContain(`revoke execute on function public.${signature} from public, anon, authenticated`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role`);
    }
  });

  it('preserves current live assets during rollout and scrubs public contributor identifiers', () => {
    expect(migration).toContain("when status = 'published' then 'published'");
    expect(migration).toContain("set access_tier = 'free' where status = 'published' and access_tier = 'developer'");
    expect(migration).toContain("metadata - 'developeremail' - 'developerid' - 'revisionauthor'");
    expect(migration).not.toContain("'revisionauthor', coalesce(submission.developer_email");
  });

  it('uses a recoverable owner-only purge handshake for complete asset lineages', () => {
    expect(migration).toContain('add column if not exists purge_state');
    expect(migration).toContain('cardforge_prepare_developer_asset_purge');
    expect(migration).toContain('cardforge_finalize_developer_asset_purge');
    expect(migration).toContain("set purge_state = 'pending'");
    expect(migration).toContain('registry_asset_id = lineage_asset_id');
    expect(migration).toContain('target_registry_asset_id = lineage_asset_id');
    expect(migration).toContain('delete from public.cardforge_asset_registry');
    expect(migration).toContain('cardforge_pipeline_asset_tombstones');
    expect(migration).toContain('pipeline_asset_deleted_by_owner');
    expect(migration).toContain('cardforge_prevent_deleted_pipeline_asset_recreation');
    expect(migration).toContain('cardforge_prevent_deleted_pipeline_submission_recreation');
    expect(migration).toContain('new.target_registry_asset_id');
    expect(migration).toContain('revoke all on table public.cardforge_pipeline_asset_tombstones from public, anon, authenticated');
    for (const signature of [
      'cardforge_prepare_developer_asset_purge(uuid, text)',
      'cardforge_finalize_developer_asset_purge(uuid)',
    ]) {
      expect(migration).toContain(`revoke execute on function public.${signature} from public, anon, authenticated`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role`);
    }
  });
});
