-- Canonical whole-catalog recoverable Trash state, distinct from revision Trash.
-- This is inert until the exact-identity Owner commands and guarded expiry
-- processor are installed. Never migrate a live catalog item merely by adding
-- these columns.
begin;
set local lock_timeout = '5s';

alter table public.cardforge_pipeline_asset_lineages
  add column if not exists catalog_trashed_at timestamptz,
  add column if not exists catalog_purge_after timestamptz,
  add column if not exists catalog_retention_hold boolean not null default false,
  add column if not exists catalog_trash_registry_submission_id uuid,
  add column if not exists catalog_trash_registry_status text,
  add column if not exists catalog_trash_registry_access_tier text,
  add column if not exists catalog_trash_revision_high_water integer,
  add column if not exists catalog_claim_token uuid,
  add column if not exists catalog_claimed_at timestamptz;

-- No second timer, registry, queue, trigger, or automatic claim path.
-- The follow-up command must atomically capture the existing registry state
-- under locks, validate managed references, and derive the deadline from
-- cardforge_contributor_program_settings.trash_retention_days.
-- Before that complete command is available, nothing may write these fields.
-- The eventual guarded worker must recheck live managed dependencies,
-- high-water/revision identity, holds and restoration races before it invokes
-- the established tombstone + Storage-before-row lineage purge.

commit;
