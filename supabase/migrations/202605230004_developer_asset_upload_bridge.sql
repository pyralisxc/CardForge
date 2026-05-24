insert into storage.buckets (id, name, public)
values ('cardforge-developer-assets', 'cardforge-developer-assets', true)
on conflict (id) do update
set public = true;

alter table public.cardforge_developer_asset_submissions
  add column if not exists source_file_size_bytes bigint check (source_file_size_bytes is null or source_file_size_bytes >= 0),
  add column if not exists source_mime_type text,
  add column if not exists source_storage_bucket text,
  add column if not exists source_storage_path text,
  add column if not exists registry_asset_id text references public.cardforge_asset_registry(asset_id) on delete set null;

create index if not exists cardforge_developer_asset_submissions_registry_asset_idx
  on public.cardforge_developer_asset_submissions (registry_asset_id);

create index if not exists cardforge_developer_asset_submissions_source_storage_idx
  on public.cardforge_developer_asset_submissions (source_storage_bucket, source_storage_path);
