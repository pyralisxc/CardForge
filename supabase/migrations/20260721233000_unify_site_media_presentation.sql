alter table public.cardforge_site_media
  drop constraint if exists cardforge_site_media_slot_check;

alter table public.cardforge_site_media
  add constraint cardforge_site_media_slot_check check (slot in (
    'landing.hero',
    'landing.showcase.layout',
    'landing.showcase.generator-single',
    'landing.showcase.generator-bulk',
    'founder.portrait'
  ));

alter table public.cardforge_site_media
  alter column storage_path drop not null,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists presentation jsonb not null default '{}'::jsonb,
  add column if not exists previous_storage_path text,
  add column if not exists previous_alt text,
  add column if not exists previous_width integer,
  add column if not exists previous_height integer,
  add column if not exists previous_presentation jsonb,
  add column if not exists previous_updated_at timestamptz;

alter table public.cardforge_site_media
  drop constraint if exists cardforge_site_media_dimensions_check,
  drop constraint if exists cardforge_site_media_presentation_check,
  drop constraint if exists cardforge_site_media_previous_check;

alter table public.cardforge_site_media
  add constraint cardforge_site_media_dimensions_check check (
    (width is null and height is null)
    or (width between 1 and 20000 and height between 1 and 20000)
  ),
  add constraint cardforge_site_media_presentation_check check (
    jsonb_typeof(presentation) = 'object'
  ),
  add constraint cardforge_site_media_previous_check check (
    (previous_alt is null and previous_presentation is null)
    or (
      char_length(previous_alt) between 1 and 300
      and jsonb_typeof(previous_presentation) = 'object'
      and (
        (previous_width is null and previous_height is null)
        or (previous_width between 1 and 20000 and previous_height between 1 and 20000)
      )
    )
  );

insert into public.cardforge_site_media (
  slot,
  storage_path,
  alt,
  presentation,
  updated_at
)
select
  'founder.portrait',
  portrait_storage_path,
  portrait_alt,
  '{}'::jsonb,
  updated_at
from public.cardforge_founder_profile
where id = 'cameron-locke'
on conflict (slot) do nothing;

update storage.buckets
set file_size_limit = 12582912
where id = 'cardforge-public-media';
