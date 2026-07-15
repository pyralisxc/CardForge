-- Clear actionable security and performance advisor findings.

alter function public.cardforge_touch_updated_at()
  set search_path = pg_catalog, public;

create index if not exists cardforge_asset_registry_developer_submission_id_idx
  on public.cardforge_asset_registry (developer_submission_id);
