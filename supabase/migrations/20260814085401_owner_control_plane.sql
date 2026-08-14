begin;

alter table public.cardforge_owner_settings
  add column if not exists announcement_enabled boolean not null default false,
  add column if not exists announcement_message text not null default '',
  add column if not exists primary_cta_label text not null default 'Try the Studio',
  add column if not exists primary_cta_href text not null default '/studio',
  add column if not exists creator_pass_offer_visible boolean not null default true,
  add column if not exists support_offer_visible boolean not null default true,
  add column if not exists homepage_title text not null default 'Build Complete Card Sets',
  add column if not exists homepage_description text not null default 'Create highly customized card sets from reusable layouts and structured data, then review and export the whole set in your browser.',
  add column if not exists homepage_share_image_url text not null default '',
  add column if not exists primary_navigation jsonb not null default '[
    {"id":"about","label":"How it works","href":"/about","visible":true},
    {"id":"roadmap","label":"Roadmap","href":"/roadmap","visible":true},
    {"id":"account","label":"Account","href":"/account","visible":true}
  ]'::jsonb,
  add column if not exists homepage_sections jsonb not null default '[
    {"id":"showcase","visible":true},
    {"id":"workflow","visible":true},
    {"id":"access","visible":true},
    {"id":"founder","visible":true},
    {"id":"final_cta","visible":true}
  ]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_announcement_message_length' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_announcement_message_length check (char_length(announcement_message) <= 240);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_announcement_message_required' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_announcement_message_required check (not announcement_enabled or char_length(btrim(announcement_message)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_primary_cta_label_length' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_primary_cta_label_length check (char_length(primary_cta_label) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_primary_cta_href_safe' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_primary_cta_href_safe check (primary_cta_href ~ '^/[A-Za-z0-9_-][A-Za-z0-9/_-]*$' or primary_cta_href = '/');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_homepage_title_length' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_homepage_title_length check (char_length(homepage_title) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_homepage_description_length' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_homepage_description_length check (char_length(homepage_description) between 40 and 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_homepage_share_image_url_safe' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_homepage_share_image_url_safe check (homepage_share_image_url = '' or homepage_share_image_url ~ '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_primary_navigation_array' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_primary_navigation_array check (jsonb_typeof(primary_navigation) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cardforge_owner_homepage_sections_array' and conrelid = 'public.cardforge_owner_settings'::regclass) then
    alter table public.cardforge_owner_settings add constraint cardforge_owner_homepage_sections_array check (jsonb_typeof(homepage_sections) = 'array');
  end if;
end $$;

create table if not exists public.cardforge_owner_activity (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text not null,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  summary text not null,
  outcome text not null default 'succeeded'
    check (outcome in ('succeeded', 'partial', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (char_length(action) between 1 and 120),
  check (char_length(target_type) between 1 and 80),
  check (char_length(summary) between 1 and 500),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists cardforge_owner_activity_created_at_idx
  on public.cardforge_owner_activity (created_at desc);

create index if not exists cardforge_owner_activity_target_idx
  on public.cardforge_owner_activity (target_type, target_id, created_at desc);

alter table public.cardforge_owner_activity enable row level security;

revoke all privileges on table public.cardforge_owner_activity from public, anon, authenticated;
grant select, insert on table public.cardforge_owner_activity to service_role;

comment on table public.cardforge_owner_activity is
  'Append-only owner control-plane history. Provider credentials and sensitive payloads must never be stored here.';

comment on column public.cardforge_owner_settings.primary_navigation is
  'Owner-controlled labels, visibility, and order for the code-allowlisted primary public navigation.';

comment on column public.cardforge_owner_settings.homepage_sections is
  'Owner-controlled visibility and order for the code-allowlisted homepage sections.';

commit;
