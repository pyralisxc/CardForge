create table if not exists public.cardforge_personal_library_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  provider text not null check (provider in ('google-drive')),
  provider_file_id text not null check (char_length(btrim(provider_file_id)) between 8 and 255),
  provider_revision text not null check (char_length(btrim(provider_revision)) between 1 and 80),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 320),
  mime_type text not null check (char_length(btrim(mime_type)) between 1 and 160),
  asset_role text not null check (asset_role in ('artwork', 'frame', 'texture', 'divider', 'icon', 'font', 'reference')),
  byte_size bigint not null check (byte_size between 0 and 33554432),
  provider_modified_at timestamptz not null,
  provider_web_view_link text,
  content_hash text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, provider, provider_file_id)
);

create index if not exists cardforge_personal_library_owner_role_idx
  on public.cardforge_personal_library_items (owner_user_id, asset_role, updated_at desc);

create index if not exists cardforge_personal_library_owner_provider_idx
  on public.cardforge_personal_library_items (owner_user_id, provider, updated_at desc);

alter table public.cardforge_personal_library_items enable row level security;

revoke all privileges on table public.cardforge_personal_library_items
  from public, anon, authenticated;
grant select, insert, update, delete on table public.cardforge_personal_library_items
  to service_role;

comment on table public.cardforge_personal_library_items is
  'Server-owned metadata index for external personal-library files explicitly authorized to CardForge. File bytes remain with the connected provider until a user or agent materializes a selected asset into a CardForge project/workspace.';
