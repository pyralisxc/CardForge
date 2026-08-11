-- Developer Cockpit: final canonical campaign media and production-package schema.
-- This migration has not been applied to production. It intentionally starts with the
-- final ownership model: CardForge IDs/relationships are public application identity;
-- Supabase bucket/object references remain server-only implementation details.

alter table public.cardforge_developer_profiles
  add column if not exists can_draft_campaigns boolean not null default false,
  add column if not exists can_propose_site_content boolean not null default false;

create table if not exists public.cardforge_social_campaigns (
  id uuid primary key default gen_random_uuid(),
  contributor_id text not null,
  contributor_email text,
  contributor_name text,
  creation_idempotency_key text not null check (char_length(creation_idempotency_key) between 16 and 160),
  title text not null check (char_length(title) between 1 and 120),
  objective text not null check (char_length(objective) between 1 and 600),
  destination_url text not null default '',
  source_reference text not null default '',
  license_notes text not null default '',
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'changes_requested', 'approved', 'provider_draft',
    'scheduled', 'published', 'failed', 'cancelled'
  )),
  requested_publish_at timestamptz,
  review_note text not null default '',
  reviewed_by text,
  submitted_at timestamptz,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contributor_id, creation_idempotency_key)
);

create table if not exists public.cardforge_campaign_media (
  id uuid primary key default gen_random_uuid(),
  ingesting_contributor_id text not null,
  contributor_email text,
  contributor_name text,
  ingest_idempotency_key text not null check (char_length(ingest_idempotency_key) between 16 and 160),
  media_kind text not null default 'image' check (media_kind in ('image')),
  original_mime_type text not null check (original_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  original_filename text not null default '' check (char_length(original_filename) <= 255),
  original_byte_count bigint not null check (original_byte_count > 0 and original_byte_count <= 12582912),
  width integer not null check (width > 0 and width <= 32768),
  height integer not null check (height > 0 and height <= 32768),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  perceptual_hash text,
  original_storage_bucket text not null,
  original_storage_path text not null,
  normalized_storage_bucket text not null,
  normalized_storage_path text not null,
  normalized_byte_count bigint not null check (normalized_byte_count > 0),
  normalized_mime_type text not null default 'image/webp' check (normalized_mime_type = 'image/webp'),
  rights_basis text not null default '' check (char_length(rights_basis) <= 1000),
  creator_credit text not null default '' check (char_length(creator_credit) <= 500),
  rights_restriction text not null default '' check (char_length(rights_restriction) <= 1000),
  rights_expires_at timestamptz,
  reusable_caption text not null default '' check (char_length(reusable_caption) <= 1000),
  reusable_description text not null default '' check (char_length(reusable_description) <= 2000),
  focal_x numeric(5,4),
  focal_y numeric(5,4),
  review_state text not null default 'needs_review' check (review_state in ('private', 'needs_review', 'approved', 'public', 'archived')),
  archived_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((focal_x is null and focal_y is null) or (focal_x between 0 and 1 and focal_y between 0 and 1)),
  unique (ingesting_contributor_id, ingest_idempotency_key),
  unique (ingesting_contributor_id, content_hash)
);

create table if not exists public.cardforge_campaign_media_derivatives (
  id uuid primary key default gen_random_uuid(),
  parent_media_id uuid not null references public.cardforge_campaign_media(id) on delete restrict,
  purpose text not null check (purpose in ('normalized_master', 'public_original', 'social_crop', 'thumbnail')),
  width integer not null check (width > 0 and width <= 32768),
  height integer not null check (height > 0 and height <= 32768),
  mime_type text not null check (mime_type in ('image/webp')),
  byte_count bigint not null check (byte_count > 0),
  storage_bucket text not null,
  storage_path text not null,
  crop_x numeric(5,4),
  crop_y numeric(5,4),
  crop_width numeric(5,4),
  crop_height numeric(5,4),
  exposure text not null default 'private' check (exposure in ('private', 'public')),
  promotion_key text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (crop_x is null and crop_y is null and crop_width is null and crop_height is null)
    or (crop_x between 0 and 1 and crop_y between 0 and 1 and crop_width > 0 and crop_width <= 1 and crop_height > 0 and crop_height <= 1)
  ),
  unique (parent_media_id, purpose, promotion_key)
);

create table if not exists public.cardforge_social_campaign_media_attachments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.cardforge_social_campaigns(id) on delete cascade,
  service text not null,
  media_id uuid not null references public.cardforge_campaign_media(id) on delete restrict,
  derivative_id uuid references public.cardforge_campaign_media_derivatives(id) on delete restrict,
  display_order integer not null default 0 check (display_order >= 0 and display_order < 100),
  alt_text text not null check (char_length(alt_text) between 1 and 300),
  caption_override text not null default '' check (char_length(caption_override) <= 1000),
  crop_intent jsonb not null default '{}'::jsonb check (jsonb_typeof(crop_intent) = 'object'),
  created_at timestamptz not null default now(),
  unique (campaign_id, service, media_id, display_order)
);

create table if not exists public.cardforge_social_campaign_associations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.cardforge_social_campaigns(id) on delete cascade,
  kind text not null check (kind in ('pull_request', 'commit', 'release', 'feature', 'shared_asset', 'jam_recording')),
  external_key text not null check (char_length(external_key) between 1 and 500),
  reference_url text not null default '' check (char_length(reference_url) <= 2048),
  title_snapshot text not null default '' check (char_length(title_snapshot) <= 500),
  metadata_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_snapshot) = 'object'),
  note text not null default '' check (char_length(note) <= 1000),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, kind, external_key)
);

create table if not exists public.cardforge_social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.cardforge_social_campaigns(id) on delete cascade,
  provider text not null default 'buffer' check (provider = 'buffer'),
  service text not null,
  provider_channel_id text not null,
  provider_post_id text,
  status text not null check (status in ('provider_draft', 'scheduled', 'published', 'failed', 'cancelled', 'unknown')),
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
    'landing.hero.headline', 'landing.hero.body', 'landing.hero.support',
    'landing.demo.heading', 'landing.demo.body', 'about.hero.headline',
    'about.hero.body', 'sharing.message'
  )),
  base_body text not null,
  proposed_body text not null check (char_length(proposed_body) between 1 and 800),
  rationale text not null check (char_length(rationale) between 1 and 800),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'changes_requested', 'published', 'rejected', 'cancelled')),
  review_note text not null default '',
  reviewed_by text,
  submitted_at timestamptz,
  published_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cardforge_social_campaigns_contributor_idx on public.cardforge_social_campaigns (contributor_id, updated_at desc);
create index if not exists cardforge_social_campaigns_status_idx on public.cardforge_social_campaigns (status, updated_at desc);
create index if not exists cardforge_campaign_media_contributor_idx on public.cardforge_campaign_media (ingesting_contributor_id, created_at desc);
create index if not exists cardforge_campaign_media_review_idx on public.cardforge_campaign_media (review_state, created_at desc);
create index if not exists cardforge_campaign_media_hash_idx on public.cardforge_campaign_media (content_hash);
create index if not exists cardforge_campaign_media_derivatives_parent_idx on public.cardforge_campaign_media_derivatives (parent_media_id, created_at desc);
create index if not exists cardforge_campaign_media_derivatives_public_idx on public.cardforge_campaign_media_derivatives (exposure, approved_at desc);
create index if not exists cardforge_campaign_attachments_media_idx on public.cardforge_social_campaign_media_attachments (media_id, campaign_id);
create index if not exists cardforge_campaign_attachments_campaign_idx on public.cardforge_social_campaign_media_attachments (campaign_id, service, display_order);
create index if not exists cardforge_campaign_associations_campaign_idx on public.cardforge_social_campaign_associations (campaign_id, kind);
create index if not exists cardforge_social_publish_jobs_campaign_idx on public.cardforge_social_publish_jobs (campaign_id, updated_at desc);
create index if not exists cardforge_site_content_proposals_contributor_idx on public.cardforge_site_content_proposals (contributor_id, updated_at desc);
create index if not exists cardforge_site_content_proposals_status_idx on public.cardforge_site_content_proposals (status, updated_at desc);

drop trigger if exists cardforge_social_campaigns_touch_updated_at on public.cardforge_social_campaigns;
create trigger cardforge_social_campaigns_touch_updated_at before update on public.cardforge_social_campaigns for each row execute function public.cardforge_touch_updated_at();
drop trigger if exists cardforge_campaign_media_touch_updated_at on public.cardforge_campaign_media;
create trigger cardforge_campaign_media_touch_updated_at before update on public.cardforge_campaign_media for each row execute function public.cardforge_touch_updated_at();
drop trigger if exists cardforge_social_publish_jobs_touch_updated_at on public.cardforge_social_publish_jobs;
create trigger cardforge_social_publish_jobs_touch_updated_at before update on public.cardforge_social_publish_jobs for each row execute function public.cardforge_touch_updated_at();
drop trigger if exists cardforge_site_content_proposals_touch_updated_at on public.cardforge_site_content_proposals;
create trigger cardforge_site_content_proposals_touch_updated_at before update on public.cardforge_site_content_proposals for each row execute function public.cardforge_touch_updated_at();

alter table public.cardforge_social_campaigns enable row level security;
alter table public.cardforge_campaign_media enable row level security;
alter table public.cardforge_campaign_media_derivatives enable row level security;
alter table public.cardforge_social_campaign_media_attachments enable row level security;
alter table public.cardforge_social_campaign_associations enable row level security;
alter table public.cardforge_social_publish_jobs enable row level security;
alter table public.cardforge_site_content_proposals enable row level security;

revoke all privileges on public.cardforge_social_campaigns, public.cardforge_campaign_media, public.cardforge_campaign_media_derivatives, public.cardforge_social_campaign_media_attachments, public.cardforge_social_campaign_associations, public.cardforge_social_publish_jobs, public.cardforge_site_content_proposals from public, anon, authenticated;
grant all privileges on public.cardforge_social_campaigns, public.cardforge_campaign_media, public.cardforge_campaign_media_derivatives, public.cardforge_social_campaign_media_attachments, public.cardforge_social_campaign_associations, public.cardforge_social_publish_jobs, public.cardforge_site_content_proposals to service_role;

create or replace function public.cardforge_publish_site_content_proposal(proposal_id uuid, expected_version integer, reviewer_id text, owner_review_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare proposal_record public.cardforge_site_content_proposals%rowtype; live_body text;
begin
  select * into proposal_record from public.cardforge_site_content_proposals where id = proposal_id for update;
  if not found then raise exception 'Site-copy proposal not found.'; end if;
  if proposal_record.status <> 'submitted' then raise exception 'Only a submitted site-copy proposal can be published.'; end if;
  if proposal_record.version <> expected_version then raise exception 'Site-copy proposal changed before publication.'; end if;
  select body into live_body from public.cardforge_site_content_blocks where slug = proposal_record.slug for update;
  if coalesce(live_body, '') is distinct from proposal_record.base_body then raise exception 'Current site copy changed after this proposal was created.'; end if;
  insert into public.cardforge_site_content_blocks (slug, body, updated_at) values (proposal_record.slug, proposal_record.proposed_body, now())
  on conflict (slug) do update set body = excluded.body, updated_at = excluded.updated_at;
  update public.cardforge_site_content_proposals set status = 'published', reviewed_by = reviewer_id, review_note = left(coalesce(owner_review_note, ''), 1200), published_at = now(), version = version + 1
  where id = proposal_record.id and version = expected_version;
  if not found then raise exception 'Site-copy proposal changed before publication.'; end if;
end;
$$;
revoke execute on function public.cardforge_publish_site_content_proposal(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.cardforge_publish_site_content_proposal(uuid, integer, text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardforge-social-sources', 'cardforge-social-sources', false, 12582912, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardforge-social-media', 'cardforge-social-media', true, 12582912, array['image/webp'])
on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

comment on table public.cardforge_campaign_media is 'Canonical CardForge campaign-media registry. Object storage paths are server-only implementation details.';
comment on table public.cardforge_campaign_media_derivatives is 'Stable protected/public derivatives. Public URL is derived output, never media identity.';
comment on table public.cardforge_social_campaign_media_attachments is 'Campaign-contextual media relationship: channel ordering, alt text, crop intent, and caption override.';
comment on table public.cardforge_social_campaign_associations is 'Durable CardForge-owned snapshots of development and production references.';
