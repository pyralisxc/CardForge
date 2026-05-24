create table if not exists public.cardforge_owner_settings (
  id text primary key default 'cardforge',
  business_name text not null default 'CardForge Studio',
  owner_name text not null default 'Cameron Locke',
  support_email text not null default 'Cameron.r.locke96@gmail.com',
  support_phone text not null default '',
  website_url text not null default 'http://localhost:9002',
  max_active_user_roadmap_items integer not null default 50 check (max_active_user_roadmap_items between 1 and 500),
  max_roadmap_suggestion_length integer not null default 200 check (max_roadmap_suggestion_length between 40 and 500),
  roadmap_negative_signal_min_total_votes integer not null default 20 check (roadmap_negative_signal_min_total_votes between 1 and 1000),
  roadmap_negative_signal_min_downvote_percent integer not null default 51 check (roadmap_negative_signal_min_downvote_percent between 1 and 100),
  updated_at timestamptz not null default now(),
  check (id = 'cardforge')
);

alter table public.cardforge_owner_settings
  add column if not exists max_active_user_roadmap_items integer not null default 50 check (max_active_user_roadmap_items between 1 and 500),
  add column if not exists max_roadmap_suggestion_length integer not null default 200 check (max_roadmap_suggestion_length between 40 and 500),
  add column if not exists roadmap_negative_signal_min_total_votes integer not null default 20 check (roadmap_negative_signal_min_total_votes between 1 and 1000),
  add column if not exists roadmap_negative_signal_min_downvote_percent integer not null default 51 check (roadmap_negative_signal_min_downvote_percent between 1 and 100);

create table if not exists public.cardforge_legal_documents (
  slug text primary key check (slug in ('privacy', 'terms', 'refund', 'contact')),
  title text not null,
  body text not null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists cardforge_owner_settings_touch_updated_at on public.cardforge_owner_settings;
create trigger cardforge_owner_settings_touch_updated_at
  before update on public.cardforge_owner_settings
  for each row
  execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_legal_documents_touch_updated_at on public.cardforge_legal_documents;
create trigger cardforge_legal_documents_touch_updated_at
  before update on public.cardforge_legal_documents
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_owner_settings enable row level security;
alter table public.cardforge_legal_documents enable row level security;

insert into public.cardforge_owner_settings (
  id,
  business_name,
  owner_name,
  support_email,
  support_phone,
  website_url
)
values (
  'cardforge',
  'CardForge Studio',
  'Cameron Locke',
  'Cameron.r.locke96@gmail.com',
  '',
  'http://localhost:9002'
)
on conflict (id) do nothing;

insert into public.cardforge_legal_documents (slug, title, body, published_at)
values
  (
    'privacy',
    'Privacy Policy',
    'CardForge Studio is a local-first card creation tool. Card projects, imported data, generated previews, and custom project files stay in browser storage or downloaded files unless a future cloud save feature is explicitly introduced.

We use account providers to identify signed-in users, unlock export access, and protect owner/developer tools. We may use lightweight database records for roadmap votes, feature suggestions, beta feedback, legal settings, and account-related product status.

We do not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.',
    now()
  ),
  (
    'terms',
    'Terms of Service',
    'CardForge Studio lets users create templates, generate previews, and export content according to their account access. You are responsible for the content, artwork, data, and intellectual property you bring into the tool.

The product is in active beta. Features, pricing, access levels, and export behavior may change as the service develops. Do not use CardForge for unlawful content or activity.

By using CardForge, you agree to use the service responsibly and to keep your own backups of local-first project data.',
    now()
  ),
  (
    'refund',
    'Refund and Cancellation Policy',
    'CardForge is currently operating as an early beta. Paid subscription and refund rules will be finalized before public self-serve billing launches.

If you have a billing, cancellation, or export-access issue, contact the support email listed on this site.',
    now()
  ),
  (
    'contact',
    'Contact and Support',
    'For support, beta access, developer account requests, legal questions, or billing questions, contact the support email listed on this site.',
    now()
  )
on conflict (slug) do nothing;
