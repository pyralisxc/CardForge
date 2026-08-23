create table if not exists public.cardforge_project_storage_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  provider text not null check (provider in ('google-drive')),
  external_account_id text not null check (char_length(btrim(external_account_id)) between 1 and 255),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 320),
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_auth_tag text not null,
  granted_scopes text[] not null default '{}'::text[],
  root_folder_id text not null check (char_length(btrim(root_folder_id)) between 1 and 255),
  status text not null default 'active' check (status in ('active', 'error')),
  status_note text not null default '',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, provider)
);

create index if not exists cardforge_project_storage_connections_owner_idx
  on public.cardforge_project_storage_connections (owner_user_id, provider);

alter table public.cardforge_project_storage_connections enable row level security;

revoke all privileges on table public.cardforge_project_storage_connections
  from public, anon, authenticated;
grant select, insert, update, delete on table public.cardforge_project_storage_connections
  to service_role;

comment on table public.cardforge_project_storage_connections is
  'Server-only per-account durable project-storage connections. Provider refresh credentials are encrypted by CardForge; browser and MCP clients never receive them.';

alter table public.cardforge_studio_documents
  add column if not exists source_project_provider text,
  add column if not exists source_project_external_id text,
  add column if not exists source_provider_revision text,
  add column if not exists source_project_revision text,
  add column if not exists source_project_name text;

alter table public.cardforge_studio_documents
  drop constraint if exists cardforge_studio_documents_project_source_lineage_check;

alter table public.cardforge_studio_documents
  add constraint cardforge_studio_documents_project_source_lineage_check
  check (
    (
      source_project_provider is null
      and source_project_external_id is null
      and source_provider_revision is null
      and source_project_revision is null
      and source_project_name is null
    )
    or (
      source_project_provider in ('google-drive')
      and char_length(btrim(source_project_external_id)) between 1 and 255
      and char_length(btrim(source_provider_revision)) between 1 and 80
      and source_project_revision ~ '^[a-f0-9]{64}$'
      and char_length(btrim(source_project_name)) between 1 and 160
    )
  );

create index if not exists cardforge_studio_documents_project_source_idx
  on public.cardforge_studio_documents (owner_user_id, source_project_provider, source_project_external_id)
  where source_project_provider is not null;
