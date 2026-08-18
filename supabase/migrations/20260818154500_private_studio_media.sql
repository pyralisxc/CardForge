-- Private account-owned Studio media.
-- Clerk ownership is enforced by CardForge server routes. Browser roles never access
-- this table or bucket directly; stable /api/studio-media/... URLs stream authorized content.

create table if not exists public.cardforge_studio_media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null check (char_length(owner_user_id) between 1 and 255),
  name text not null check (char_length(name) between 1 and 160),
  media_kind text not null check (media_kind in ('image', 'texture', 'divider', 'icon')),
  creation_source text not null default 'studio' check (creation_source in ('studio', 'gpt')),
  original_filename text not null default '' check (char_length(original_filename) <= 255),
  original_mime_type text not null check (original_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  original_byte_count bigint not null check (original_byte_count > 0 and original_byte_count <= 8388608),
  normalized_mime_type text not null default 'image/webp' check (normalized_mime_type = 'image/webp'),
  normalized_byte_count bigint not null check (normalized_byte_count > 0),
  width integer not null check (width > 0 and width <= 8192),
  height integer not null check (height > 0 and height <= 8192),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, media_kind, content_hash)
);

create index if not exists cardforge_studio_media_owner_updated_idx
  on public.cardforge_studio_media (owner_user_id, updated_at desc, id);

create index if not exists cardforge_studio_media_storage_idx
  on public.cardforge_studio_media (storage_bucket, storage_path);

drop trigger if exists cardforge_studio_media_touch_updated_at
  on public.cardforge_studio_media;
create trigger cardforge_studio_media_touch_updated_at
  before update on public.cardforge_studio_media
  for each row execute function public.cardforge_touch_updated_at();

alter table public.cardforge_studio_media enable row level security;

revoke all privileges on public.cardforge_studio_media
  from public, anon, authenticated;
grant all privileges on public.cardforge_studio_media
  to service_role;

insert into storage.buckets (id, name, public)
values ('cardforge-studio-media', 'cardforge-studio-media', false)
on conflict (id) do update
set public = false;

comment on table public.cardforge_studio_media is
  'Private account-owned Studio artwork metadata. Clerk identity is authorized by CardForge server routes; browser roles have no direct table or bucket access.';
comment on column public.cardforge_studio_media.owner_user_id is
  'Immutable Clerk user id used by server-side ownership checks.';
comment on column public.cardforge_studio_media.storage_path is
  'Protected Supabase object path. Application documents reference the stable CardForge content route, not this path.';
