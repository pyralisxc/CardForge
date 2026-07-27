-- Developer Cockpit: least-privilege contribution scopes, durable marketing
-- packages, provider delivery history, and owner-published site-copy proposals.

alter table public.cardforge_developer_profiles
  add column if not exists can_draft_campaigns boolean not null default false,
  add column if not exists can_propose_site_content boolean not null default false;

create table if not exists public.cardforge_social_campaigns (
  id uuid primary key default gen_random_uuid(),
  contributor_id text not null,
  contributor_email text,
  contributor_name text,
  title text not null check (char_length(title) between 1 and 120),
  objective text not null check (char_length(objective) between 1 and 600),
  destination_url text not null default '',
  source_reference text not null default '',
  license_notes text not null default '',
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  status text not null default 'draft' check (status in (
    'draft',
    'submitted',
    'changes_requested',
    'approved',
    'provider_draft',
    'scheduled',
    'published',
    'failed',
    'cancelled'
  )),
  requested_publish_at timestamptz,
  review_note text not null default '',
  reviewed_by text,
  submitted_at timestamptz,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cardforge_social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.cardforge_social_campaigns(id) on delete cascade,
  provider text not null default 'buffer' check (provider = 'buffer'),
  service text not null,
  provider_channel_id text not null,
  provider_post_id text,
  status text not null check (status in (
    'provider_draft',
    'scheduled',
    'published',
    'failed',
    'cancelled',
    'unknown'
  )),
  scheduled_for timestamptz,
  error_message text not null default '',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, provider_channel_id)
);

create table if not exists public.cardforge_site_content_proposals (
  id uuid primary key default gen_random_uuid(),
  contributor_id text not null,
  contributor_email text,
  contributor_name text,
  slug text not null check (slug in (
    'landing.hero.headline',
    'landing.hero.body',
    'landing.hero.support',
    'landing.demo.heading',
    'landing.demo.body',
    'about.hero.headline',
    'about.hero.body',
    'sharing.message'
  )),
  base_body text not null,
  proposed_body text not null check (char_length(proposed_body) between 1 and 800),
  rationale text not null check (char_length(rationale) between 1 and 800),
  status text not null default 'draft' check (status in (
    'draft',
    'submitted',
    'changes_requested',
    'published',
    'rejected',
    'cancelled'
  )),
  review_note text not null default '',
  reviewed_by text,
  submitted_at timestamptz,
  published_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cardforge_social_campaigns_contributor_idx
  on public.cardforge_social_campaigns (contributor_id, updated_at desc);
create index if not exists cardforge_social_campaigns_status_idx
  on public.cardforge_social_campaigns (status, updated_at desc);
create index if not exists cardforge_social_publish_jobs_campaign_idx
  on public.cardforge_social_publish_jobs (campaign_id, updated_at desc);
create index if not exists cardforge_site_content_proposals_contributor_idx
  on public.cardforge_site_content_proposals (contributor_id, updated_at desc);
create index if not exists cardforge_site_content_proposals_status_idx
  on public.cardforge_site_content_proposals (status, updated_at desc);

drop trigger if exists cardforge_social_campaigns_touch_updated_at on public.cardforge_social_campaigns;
create trigger cardforge_social_campaigns_touch_updated_at
  before update on public.cardforge_social_campaigns
  for each row execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_social_publish_jobs_touch_updated_at on public.cardforge_social_publish_jobs;
create trigger cardforge_social_publish_jobs_touch_updated_at
  before update on public.cardforge_social_publish_jobs
  for each row execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_site_content_proposals_touch_updated_at on public.cardforge_site_content_proposals;
create trigger cardforge_site_content_proposals_touch_updated_at
  before update on public.cardforge_site_content_proposals
  for each row execute function public.cardforge_touch_updated_at();

alter table public.cardforge_social_campaigns enable row level security;
alter table public.cardforge_social_publish_jobs enable row level security;
alter table public.cardforge_site_content_proposals enable row level security;

revoke all privileges on public.cardforge_social_campaigns from public, anon, authenticated;
revoke all privileges on public.cardforge_social_publish_jobs from public, anon, authenticated;
revoke all privileges on public.cardforge_site_content_proposals from public, anon, authenticated;

grant all privileges on public.cardforge_social_campaigns to service_role;
grant all privileges on public.cardforge_social_publish_jobs to service_role;
grant all privileges on public.cardforge_site_content_proposals to service_role;

create or replace function public.cardforge_publish_site_content_proposal(
  proposal_id uuid,
  expected_version integer,
  reviewer_id text,
  owner_review_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  proposal_record public.cardforge_site_content_proposals%rowtype;
  live_body text;
begin
  select *
  into proposal_record
  from public.cardforge_site_content_proposals
  where id = proposal_id
  for update;

  if not found then
    raise exception 'Site-copy proposal not found.';
  end if;
  if proposal_record.status <> 'submitted' then
    raise exception 'Only a submitted site-copy proposal can be published.';
  end if;
  if proposal_record.version <> expected_version then
    raise exception 'Site-copy proposal changed before publication.';
  end if;

  select body
  into live_body
  from public.cardforge_site_content_blocks
  where slug = proposal_record.slug
  for update;

  if coalesce(live_body, '') is distinct from proposal_record.base_body then
    raise exception 'Current site copy changed after this proposal was created.';
  end if;

  insert into public.cardforge_site_content_blocks (slug, body, updated_at)
  values (proposal_record.slug, proposal_record.proposed_body, now())
  on conflict (slug) do update
  set body = excluded.body,
      updated_at = excluded.updated_at;

  update public.cardforge_site_content_proposals
  set status = 'published',
      reviewed_by = reviewer_id,
      review_note = left(coalesce(owner_review_note, ''), 1200),
      published_at = now(),
      version = version + 1
  where id = proposal_record.id
    and version = expected_version;

  if not found then
    raise exception 'Site-copy proposal changed before publication.';
  end if;
end;
$$;

revoke execute on function public.cardforge_publish_site_content_proposal(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_publish_site_content_proposal(uuid, integer, text, text)
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-social-sources',
  'cardforge-social-sources',
  false,
  12582912,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-social-media',
  'cardforge-social-media',
  true,
  12582912,
  array['image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.cardforge_social_campaigns is
  'Durable CardForge-owned marketing package ledger. Provider scheduling and delivery remain separate publish jobs.';
comment on table public.cardforge_social_publish_jobs is
  'Buffer delivery ledger. Provider identifiers and errors remain available after contributor access changes.';
comment on table public.cardforge_site_content_proposals is
  'Developer-authored public-copy proposals. Only an owner action may publish proposed_body to the live site-content store.';
