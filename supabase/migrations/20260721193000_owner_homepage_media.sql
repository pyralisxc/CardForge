create table if not exists public.cardforge_site_media (
  slot text primary key check (slot in (
    'landing.hero',
    'landing.showcase.layout',
    'landing.showcase.generator-single',
    'landing.showcase.generator-bulk'
  )),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  alt text not null check (char_length(alt) between 1 and 300),
  updated_at timestamptz not null default now()
);

drop trigger if exists cardforge_site_media_touch_updated_at on public.cardforge_site_media;
create trigger cardforge_site_media_touch_updated_at
  before update on public.cardforge_site_media
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_site_media enable row level security;
