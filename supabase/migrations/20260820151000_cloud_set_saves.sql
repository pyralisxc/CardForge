create table if not exists public.cardforge_cloud_sets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  set_id text not null check (char_length(set_id) between 1 and 160),
  name text not null check (char_length(name) between 1 and 160),
  revision integer not null default 1 check (revision >= 1),
  payload jsonb not null,
  asset_manifest jsonb not null default '[]'::jsonb,
  card_count integer not null default 0 check (card_count >= 0),
  metadata_bytes integer not null default 0 check (metadata_bytes between 0 and 3145728),
  storage_bytes bigint not null default 0 check (storage_bytes between 0 and 134217728),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, set_id)
);

create index if not exists cardforge_cloud_sets_owner_updated_idx
  on public.cardforge_cloud_sets (owner_user_id, updated_at desc);

alter table public.cardforge_cloud_sets enable row level security;

comment on table public.cardforge_cloud_sets is
  'Private account-owned cloud mirrors of CardForge card sets. Browser access is mediated by CardForge server routes; artwork bytes live in the private cardforge-cloud-set-assets bucket.';

comment on column public.cardforge_cloud_sets.payload is
  'CardForge Transfer V1 set payload with embedded image data replaced by stable private cloud-asset references.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-cloud-set-assets',
  'cardforge-cloud-set-assets',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
on conflict (id) do nothing;

drop trigger if exists cardforge_cloud_sets_touch_updated_at on public.cardforge_cloud_sets;
create trigger cardforge_cloud_sets_touch_updated_at
  before update on public.cardforge_cloud_sets
  for each row
  execute function public.cardforge_touch_updated_at();

update public.cardforge_roadmap_items
set status = 'shipped', updated_at = now()
where source = 'official'
  and title = 'Cloud project saves for signed-in users';
