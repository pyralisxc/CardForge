create extension if not exists pgcrypto;

create table if not exists public.cardforge_developer_program_settings (
  id text primary key default 'default',
  max_active_developers integer not null default 25 check (max_active_developers between 1 and 100),
  monthly_submission_limit integer not null default 25 check (monthly_submission_limit between 1 and 250),
  monthly_published_requirement integer not null default 5 check (monthly_published_requirement between 0 and 100),
  minimum_votes_for_grading integer not null default 5 check (minimum_votes_for_grading between 1 and 1000),
  minimum_positive_vote_percent integer not null default 70 check (minimum_positive_vote_percent between 1 and 100),
  free_asset_minimum_positive_vote_percent integer not null default 60 check (free_asset_minimum_positive_vote_percent between 1 and 100),
  paid_asset_minimum_positive_vote_percent integer not null default 80 check (paid_asset_minimum_positive_vote_percent between 1 and 100),
  minimum_votes_for_tier_assignment integer not null default 5 check (minimum_votes_for_tier_assignment between 1 and 1000),
  show_paid_preview_to_free_users boolean not null default true,
  allow_paid_early_access_to_candidates boolean not null default false,
  owner_vote_weight integer not null default 1 check (owner_vote_weight between 1 and 3),
  archive_visible_limit integer not null default 100 check (archive_visible_limit between 1 and 500),
  profit_share_pool_percent integer not null default 10 check (profit_share_pool_percent between 0 and 50),
  owner_final_review_required boolean not null default true,
  publish_caps_by_type jsonb not null default '{
    "templates": 3,
    "elementPresets": 8,
    "textures": 8,
    "dividers": 8,
    "icons": 10,
    "imageAssets": 8,
    "parts": 8
  }'::jsonb,
  tier_caps_by_type jsonb not null default '{
    "templates": { "free": 6, "paid": 3 },
    "elementPresets": { "free": 16, "paid": 8 },
    "textures": { "free": 16, "paid": 8 },
    "dividers": { "free": 16, "paid": 8 },
    "icons": { "free": 20, "paid": 10 },
    "imageAssets": { "free": 16, "paid": 8 },
    "parts": { "free": 16, "paid": 8 }
  }'::jsonb,
  updated_at timestamptz not null default now(),
  check (id = 'default')
);

create table if not exists public.cardforge_developer_profiles (
  clerk_user_id text primary key,
  email text,
  status text not null default 'active' check (status in ('invited', 'active', 'inactive', 'suspended')),
  monthly_submission_limit_override integer check (monthly_submission_limit_override between 1 and 250),
  monthly_published_requirement_override integer check (monthly_published_requirement_override between 0 and 100),
  eligible_for_profit_share boolean not null default true,
  owner_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cardforge_developer_asset_submissions (
  id uuid primary key default gen_random_uuid(),
  developer_id text not null,
  developer_email text,
  asset_type text not null check (asset_type in ('templates', 'elementPresets', 'textures', 'dividers', 'icons', 'imageAssets', 'parts')),
  name text not null,
  description text not null default '',
  preview_url text not null default '',
  source_url text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected')),
  calculated_access_tier text not null default 'developer' check (calculated_access_tier in ('hidden', 'free', 'paid', 'developer', 'official')),
  owner_access_tier_override text check (owner_access_tier_override in ('hidden', 'free', 'paid', 'official')),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  tier_decision_reason text,
  owner_note text,
  decision_reason text,
  positive_votes integer not null default 0 check (positive_votes >= 0),
  negative_votes integer not null default 0 check (negative_votes >= 0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cardforge_developer_asset_votes (
  submission_id uuid not null references public.cardforge_developer_asset_submissions(id) on delete cascade,
  developer_id text not null,
  vote_value text not null check (vote_value in ('positive', 'negative')),
  vote_weight integer not null default 1 check (vote_weight between 1 and 3),
  voted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (submission_id, developer_id)
);

alter table public.cardforge_developer_program_settings
  add column if not exists free_asset_minimum_positive_vote_percent integer not null default 60 check (free_asset_minimum_positive_vote_percent between 1 and 100),
  add column if not exists paid_asset_minimum_positive_vote_percent integer not null default 80 check (paid_asset_minimum_positive_vote_percent between 1 and 100),
  add column if not exists minimum_votes_for_tier_assignment integer not null default 5 check (minimum_votes_for_tier_assignment between 1 and 1000),
  add column if not exists show_paid_preview_to_free_users boolean not null default true,
  add column if not exists allow_paid_early_access_to_candidates boolean not null default false,
  add column if not exists owner_vote_weight integer not null default 1 check (owner_vote_weight between 1 and 3),
  add column if not exists tier_caps_by_type jsonb not null default '{
    "templates": { "free": 6, "paid": 3 },
    "elementPresets": { "free": 16, "paid": 8 },
    "textures": { "free": 16, "paid": 8 },
    "dividers": { "free": 16, "paid": 8 },
    "icons": { "free": 20, "paid": 10 },
    "imageAssets": { "free": 16, "paid": 8 },
    "parts": { "free": 16, "paid": 8 }
  }'::jsonb;

alter table public.cardforge_developer_asset_submissions
  add column if not exists calculated_access_tier text not null default 'developer' check (calculated_access_tier in ('hidden', 'free', 'paid', 'developer', 'official')),
  add column if not exists owner_access_tier_override text check (owner_access_tier_override in ('hidden', 'free', 'paid', 'official')),
  add column if not exists quality_score integer not null default 0 check (quality_score between 0 and 100),
  add column if not exists tier_decision_reason text;

alter table public.cardforge_developer_asset_votes
  add column if not exists vote_weight integer not null default 1 check (vote_weight between 1 and 3);

create index if not exists cardforge_developer_asset_submissions_status_idx
  on public.cardforge_developer_asset_submissions (status, submitted_at desc);

create index if not exists cardforge_developer_asset_submissions_developer_idx
  on public.cardforge_developer_asset_submissions (developer_id, submitted_at desc);

create index if not exists cardforge_developer_asset_submissions_type_status_idx
  on public.cardforge_developer_asset_submissions (asset_type, status, updated_at desc);

create index if not exists cardforge_developer_asset_submissions_tier_idx
  on public.cardforge_developer_asset_submissions (calculated_access_tier, asset_type, updated_at desc);

drop trigger if exists cardforge_developer_program_settings_touch_updated_at on public.cardforge_developer_program_settings;
create trigger cardforge_developer_program_settings_touch_updated_at
  before update on public.cardforge_developer_program_settings
  for each row
  execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_developer_profiles_touch_updated_at on public.cardforge_developer_profiles;
create trigger cardforge_developer_profiles_touch_updated_at
  before update on public.cardforge_developer_profiles
  for each row
  execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_developer_asset_submissions_touch_updated_at on public.cardforge_developer_asset_submissions;
create trigger cardforge_developer_asset_submissions_touch_updated_at
  before update on public.cardforge_developer_asset_submissions
  for each row
  execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_developer_asset_votes_touch_updated_at on public.cardforge_developer_asset_votes;
create trigger cardforge_developer_asset_votes_touch_updated_at
  before update on public.cardforge_developer_asset_votes
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_developer_program_settings enable row level security;
alter table public.cardforge_developer_profiles enable row level security;
alter table public.cardforge_developer_asset_submissions enable row level security;
alter table public.cardforge_developer_asset_votes enable row level security;

insert into public.cardforge_developer_program_settings (id)
values ('default')
on conflict (id) do nothing;
