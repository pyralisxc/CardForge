-- First-party pages share the canonical Owner settings revision, RLS and audit commands.
-- This adds no role grants, executable content, user data store or production publication.
alter table public.cardforge_owner_settings
  add column if not exists site_pages jsonb not null default '[]'::jsonb;

alter table public.cardforge_owner_settings
  add constraint cardforge_owner_site_pages_array
  check (jsonb_typeof(site_pages) = 'array' and jsonb_array_length(site_pages) <= 32);

comment on column public.cardforge_owner_settings.site_pages is
  'Owner-authored first-party pages: stable identity, safe path, SEO and code-registered sections. Uses the settings row publication revision.';
