-- Native marketing command center: strategy, campaign grouping, destinations,
-- encrypted provider connections, and a provider-neutral delivery queue.
-- Existing developer campaign packages are preserved as individual content items.

alter table public.cardforge_campaign_media_derivatives
  drop constraint if exists cardforge_campaign_media_derivatives_purpose_check;

alter table public.cardforge_campaign_media_derivatives
  drop constraint if exists cardforge_campaign_media_derivatives_mime_type_check;

alter table public.cardforge_campaign_media_derivatives
  add constraint cardforge_campaign_media_derivatives_purpose_check
    check (purpose in ('normalized_master', 'public_original', 'provider_image', 'social_crop', 'thumbnail'));

alter table public.cardforge_campaign_media_derivatives
  add constraint cardforge_campaign_media_derivatives_mime_type_check
    check (mime_type in ('image/webp', 'image/jpeg'));

create table public.cardforge_marketing_strategy (
  id text primary key default 'cardforge' check (id = 'cardforge'),
  primary_audience text not null check (primary_audience in (
    'tabletop-designers', 'deck-creators', 'small-publishers', 'educators-facilitators'
  )),
  validation_audience text not null check (validation_audience in (
    'tabletop-designers', 'deck-creators', 'small-publishers', 'educators-facilitators'
  )),
  positioning text not null check (char_length(positioning) between 1 and 1000),
  offer text not null check (char_length(offer) between 1 and 1000),
  default_call_to_action text not null check (char_length(default_call_to_action) between 1 and 200),
  enabled_pillars jsonb not null default '[]'::jsonb check (jsonb_typeof(enabled_pillars) = 'array'),
  approved_claims jsonb not null default '[]'::jsonb check (jsonb_typeof(approved_claims) = 'array'),
  prohibited_claims jsonb not null default '[]'::jsonb check (jsonb_typeof(prohibited_claims) = 'array'),
  version integer not null default 1 check (version > 0),
  updated_by text,
  updated_at timestamptz not null default now(),
  check (primary_audience <> validation_audience)
);

create table public.cardforge_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  name text not null check (char_length(name) between 1 and 160),
  objective text not null check (char_length(objective) between 1 and 1000),
  audience_key text not null check (audience_key in (
    'tabletop-designers', 'deck-creators', 'small-publishers', 'educators-facilitators'
  )),
  offer text not null default '' check (char_length(offer) <= 1000),
  status text not null default 'planning' check (status in (
    'planning', 'active', 'paused', 'completed', 'cancelled'
  )),
  starts_on date,
  ends_on date,
  success_metric text not null default '' check (char_length(success_metric) <= 1000),
  utm_campaign text not null unique check (utm_campaign ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create table public.cardforge_marketing_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'meta'),
  service text not null check (service in ('facebook', 'instagram')),
  external_account_id text not null check (char_length(external_account_id) between 1 and 500),
  display_name text not null check (char_length(display_name) between 1 and 160),
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_auth_tag text not null,
  encryption_key_version integer not null default 1 check (encryption_key_version > 0),
  granted_scopes jsonb not null default '[]'::jsonb check (jsonb_typeof(granted_scopes) = 'array'),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  status_note text not null default '' check (char_length(status_note) <= 1000),
  connected_by text not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, service, external_account_id)
);

create table public.cardforge_marketing_destinations (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  connection_id uuid references public.cardforge_marketing_connections(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  service text not null check (service in (
    'facebook', 'instagram', 'threads', 'bluesky', 'linkedin', 'x',
    'pinterest', 'tiktok', 'youtube', 'mastodon', 'googlebusiness',
    'reddit', 'discord', 'boardgamegeek'
  )),
  kind text not null check (kind in ('owned', 'community')),
  provider text not null check (provider in ('meta', 'manual')),
  publishing_mode text not null check (publishing_mode in ('automatic', 'manual')),
  external_account_id text not null default '' check (char_length(external_account_id) <= 500),
  url text not null default '' check (char_length(url) <= 2048),
  rules_url text not null default '' check (char_length(rules_url) <= 2048),
  rules_summary text not null default '' check (char_length(rules_summary) <= 2000),
  posting_guidance text not null default '' check (char_length(posting_guidance) <= 2000),
  audience_keys jsonb not null default '[]'::jsonb check (jsonb_typeof(audience_keys) = 'array'),
  rules_checked_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'community' and provider = 'manual' and publishing_mode = 'manual' and url <> '')
    or kind = 'owned'
  ),
  check ((publishing_mode = 'automatic' and connection_id is not null) or publishing_mode = 'manual')
);

alter table public.cardforge_social_campaigns
  add column if not exists marketing_campaign_id uuid references public.cardforge_marketing_campaigns(id) on delete restrict,
  add column if not exists audience_key text not null default 'tabletop-designers' check (audience_key in (
    'tabletop-designers', 'deck-creators', 'small-publishers', 'educators-facilitators'
  )),
  add column if not exists content_pillar text not null default 'product-proof' check (content_pillar in (
    'product-proof', 'creator-education', 'build-in-public', 'customer-research', 'launch-update'
  )),
  add column if not exists funnel_stage text not null default 'awareness' check (funnel_stage in (
    'awareness', 'consideration', 'activation', 'feedback'
  )),
  add column if not exists content_kind text not null default 'demonstration' check (content_kind in (
    'demonstration', 'education', 'question', 'update', 'creator-story'
  )),
  add column if not exists call_to_action text not null default '' check (char_length(call_to_action) <= 500),
  add column if not exists creation_source text not null default 'human' check (creation_source in (
    'human', 'developer', 'ai-assisted'
  )),
  add column if not exists utm_content text not null default '' check (
    utm_content = '' or utm_content ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  );

alter table public.cardforge_social_publish_jobs
  drop constraint if exists cardforge_social_publish_jobs_provider_check,
  drop constraint if exists cardforge_social_publish_jobs_status_check,
  drop constraint if exists cardforge_social_publish_jobs_service_check;

alter table public.cardforge_social_campaign_media_attachments
  drop constraint if exists cardforge_social_campaign_media_attachments_service_check;

alter table public.cardforge_social_campaign_media_attachments
  add constraint cardforge_social_campaign_media_attachments_service_check
    check (service in (
      'facebook', 'instagram', 'threads', 'bluesky', 'linkedin', 'x',
      'pinterest', 'tiktok', 'youtube', 'mastodon', 'googlebusiness',
      'reddit', 'discord', 'boardgamegeek'
    ));

alter table public.cardforge_social_publish_jobs
  add column if not exists destination_id uuid references public.cardforge_marketing_destinations(id) on delete restrict,
  add column if not exists delivery_mode text not null default 'automatic' check (delivery_mode in ('automatic', 'manual')),
  add column if not exists publication_url text not null default '' check (char_length(publication_url) <= 2048),
  add column if not exists manual_note text not null default '' check (char_length(manual_note) <= 2000),
  add column if not exists idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 16 and 160),
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_token text,
  add column if not exists next_attempt_at timestamptz;

alter table public.cardforge_social_publish_jobs
  alter column provider set default 'manual';

alter table public.cardforge_social_publish_jobs
  add constraint cardforge_social_publish_jobs_provider_check
    check (provider in ('meta', 'manual')),
  add constraint cardforge_social_publish_jobs_service_check
    check (service in (
      'facebook', 'instagram', 'threads', 'bluesky', 'linkedin', 'x',
      'pinterest', 'tiktok', 'youtube', 'mastodon', 'googlebusiness',
      'reddit', 'discord', 'boardgamegeek'
    )),
  add constraint cardforge_social_publish_jobs_status_check
    check (status in (
      'planned', 'ready', 'provider_draft', 'scheduled', 'publishing',
      'published', 'failed', 'cancelled', 'skipped', 'unknown'
    ));

create index cardforge_marketing_campaigns_status_idx
  on public.cardforge_marketing_campaigns (status, updated_at desc);
create index cardforge_marketing_destinations_active_idx
  on public.cardforge_marketing_destinations (active, service, kind);
create index cardforge_marketing_destinations_connection_idx
  on public.cardforge_marketing_destinations (connection_id)
  where connection_id is not null;
create index cardforge_social_campaigns_marketing_campaign_idx
  on public.cardforge_social_campaigns (marketing_campaign_id, updated_at desc);
create index cardforge_social_publish_jobs_destination_idx
  on public.cardforge_social_publish_jobs (destination_id, updated_at desc)
  where destination_id is not null;
create index cardforge_social_publish_jobs_due_idx
  on public.cardforge_social_publish_jobs (scheduled_for, next_attempt_at)
  where delivery_mode = 'automatic' and status in ('scheduled', 'failed');

drop trigger if exists cardforge_marketing_strategy_touch_updated_at on public.cardforge_marketing_strategy;
create trigger cardforge_marketing_strategy_touch_updated_at
  before update on public.cardforge_marketing_strategy
  for each row execute function public.cardforge_touch_updated_at();
drop trigger if exists cardforge_marketing_campaigns_touch_updated_at on public.cardforge_marketing_campaigns;
create trigger cardforge_marketing_campaigns_touch_updated_at
  before update on public.cardforge_marketing_campaigns
  for each row execute function public.cardforge_touch_updated_at();
drop trigger if exists cardforge_marketing_connections_touch_updated_at on public.cardforge_marketing_connections;
create trigger cardforge_marketing_connections_touch_updated_at
  before update on public.cardforge_marketing_connections
  for each row execute function public.cardforge_touch_updated_at();
drop trigger if exists cardforge_marketing_destinations_touch_updated_at on public.cardforge_marketing_destinations;
create trigger cardforge_marketing_destinations_touch_updated_at
  before update on public.cardforge_marketing_destinations
  for each row execute function public.cardforge_touch_updated_at();

alter table public.cardforge_marketing_strategy enable row level security;
alter table public.cardforge_marketing_campaigns enable row level security;
alter table public.cardforge_marketing_connections enable row level security;
alter table public.cardforge_marketing_destinations enable row level security;

revoke all privileges on
  public.cardforge_marketing_strategy,
  public.cardforge_marketing_campaigns,
  public.cardforge_marketing_connections,
  public.cardforge_marketing_destinations
from public, anon, authenticated;

grant all privileges on
  public.cardforge_marketing_strategy,
  public.cardforge_marketing_campaigns,
  public.cardforge_marketing_connections,
  public.cardforge_marketing_destinations
to service_role;

comment on table public.cardforge_marketing_strategy is
  'Owner-approved market, positioning, offer, claims, and content-pillar source of truth.';
comment on table public.cardforge_marketing_campaigns is
  'Campaign-level objective and measurement grouping for individual developer content packages.';
comment on table public.cardforge_marketing_connections is
  'Server-only encrypted provider credentials. Ciphertext is never included in client DTOs.';
comment on table public.cardforge_marketing_destinations is
  'Owned accounts and rule-aware communities. Community publishing is always a guided manual task.';

create or replace function public.cardforge_claim_due_marketing_deliveries(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.cardforge_social_publish_jobs
language sql
security invoker
set search_path = ''
as $$
  with stale as (
    update public.cardforge_social_publish_jobs as stale_job
    set status = 'unknown',
        error_message = 'Delivery worker stopped before publication could be confirmed. Review before retrying.',
        claimed_at = null,
        claim_token = null,
        last_checked_at = now()
    where stale_job.status = 'publishing'
      and stale_job.claimed_at < now() - interval '10 minutes'
    returning stale_job.id
  ), due as (
    select job.id
    from public.cardforge_social_publish_jobs as job
    where job.delivery_mode = 'automatic'
      and job.provider = 'meta'
      and job.status in ('scheduled', 'failed')
      and job.scheduled_for is not null
      and job.scheduled_for <= now()
      and (job.next_attempt_at is null or job.next_attempt_at <= now())
      and (job.claimed_at is null or job.claimed_at < now() - interval '10 minutes')
    order by job.scheduled_for, job.created_at
    limit least(greatest(p_limit, 1), 25)
    for update skip locked
  ), claimed as (
    update public.cardforge_social_publish_jobs as job
    set status = 'publishing',
        claimed_at = now(),
        claim_token = p_worker_id,
        attempt_count = job.attempt_count + 1
    from due
    where job.id = due.id
    returning job.*
  )
  select * from claimed;
$$;

revoke all on function public.cardforge_claim_due_marketing_deliveries(text, integer)
  from public, anon, authenticated;
grant execute on function public.cardforge_claim_due_marketing_deliveries(text, integer)
  to service_role;

create or replace function public.cardforge_create_marketing_content(
  p_contributor_id text,
  p_contributor_email text,
  p_contributor_name text,
  p_idempotency_key text,
  p_title text,
  p_objective text,
  p_destination_url text,
  p_production_note text,
  p_variants jsonb,
  p_requested_publish_at timestamptz,
  p_attachments jsonb,
  p_associations jsonb,
  p_marketing_campaign_id uuid,
  p_audience_key text,
  p_content_pillar text,
  p_funnel_stage text,
  p_content_kind text,
  p_call_to_action text,
  p_creation_source text,
  p_utm_content text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  content_id uuid;
begin
  select id into content_id
  from public.cardforge_social_campaigns
  where contributor_id = p_contributor_id
    and creation_idempotency_key = p_idempotency_key;

  if found then
    return content_id;
  end if;

  insert into public.cardforge_social_campaigns (
    contributor_id, contributor_email, contributor_name,
    creation_idempotency_key, title, objective, destination_url,
    production_note, variants, requested_publish_at, status,
    marketing_campaign_id, audience_key, content_pillar, funnel_stage,
    content_kind, call_to_action, creation_source, utm_content
  ) values (
    p_contributor_id, p_contributor_email, p_contributor_name,
    p_idempotency_key, p_title, p_objective, p_destination_url,
    p_production_note, p_variants, p_requested_publish_at, 'draft',
    p_marketing_campaign_id, p_audience_key, p_content_pillar, p_funnel_stage,
    p_content_kind, p_call_to_action, p_creation_source, p_utm_content
  )
  returning id into content_id;

  perform public.cardforge_replace_social_campaign_relationships(
    content_id, p_attachments, p_associations, p_contributor_id
  );

  return content_id;
exception when unique_violation then
  select id into content_id
  from public.cardforge_social_campaigns
  where contributor_id = p_contributor_id
    and creation_idempotency_key = p_idempotency_key;
  if not found then raise; end if;
  return content_id;
end;
$$;

create or replace function public.cardforge_update_marketing_content(
  p_content_id uuid,
  p_expected_version integer,
  p_actor_id text,
  p_title text,
  p_objective text,
  p_destination_url text,
  p_production_note text,
  p_variants jsonb,
  p_requested_publish_at timestamptz,
  p_attachments jsonb,
  p_associations jsonb,
  p_marketing_campaign_id uuid,
  p_audience_key text,
  p_content_pillar text,
  p_funnel_stage text,
  p_content_kind text,
  p_call_to_action text,
  p_creation_source text,
  p_utm_content text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_content_id uuid;
begin
  update public.cardforge_social_campaigns
  set title = p_title,
      objective = p_objective,
      destination_url = p_destination_url,
      production_note = p_production_note,
      variants = p_variants,
      requested_publish_at = p_requested_publish_at,
      marketing_campaign_id = p_marketing_campaign_id,
      audience_key = p_audience_key,
      content_pillar = p_content_pillar,
      funnel_stage = p_funnel_stage,
      content_kind = p_content_kind,
      call_to_action = p_call_to_action,
      creation_source = p_creation_source,
      utm_content = p_utm_content,
      status = case when status = 'changes_requested' then 'draft' else status end,
      version = p_expected_version + 1
  where id = p_content_id
    and version = p_expected_version
    and status in ('draft', 'changes_requested')
  returning id into changed_content_id;

  if not found then return false; end if;

  perform public.cardforge_replace_social_campaign_relationships(
    changed_content_id, p_attachments, p_associations, p_actor_id
  );
  return true;
end;
$$;

revoke all on function public.cardforge_create_marketing_content(
  text, text, text, text, text, text, text, text, jsonb, timestamptz, jsonb,
  jsonb, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.cardforge_create_marketing_content(
  text, text, text, text, text, text, text, text, jsonb, timestamptz, jsonb,
  jsonb, uuid, text, text, text, text, text, text, text
) to service_role;
revoke all on function public.cardforge_update_marketing_content(
  uuid, integer, text, text, text, text, text, jsonb, timestamptz, jsonb,
  jsonb, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.cardforge_update_marketing_content(
  uuid, integer, text, text, text, text, text, jsonb, timestamptz, jsonb,
  jsonb, uuid, text, text, text, text, text, text, text
) to service_role;

insert into public.cardforge_marketing_strategy (
  id,
  primary_audience,
  validation_audience,
  positioning,
  offer,
  default_call_to_action,
  enabled_pillars,
  approved_claims,
  prohibited_claims
) values (
  'cardforge',
  'tabletop-designers',
  'deck-creators',
  'CardForge is the fastest way to turn one card design and a content list into a consistent, printable deck.',
  'Enter the Studio and build a complete set in your browser.',
  'Enter the Studio',
  '["product-proof", "creator-education", "build-in-public", "customer-research", "launch-update"]'::jsonb,
  '["Design one card and bulk-generate a consistent set.", "Create, review, and export in the browser.", "Projects stay on the creator''s device unless they intentionally submit shared work."]'::jsonb,
  '["Do not claim automatic printing or fulfillment until a production integration is live.", "Do not claim AI playtesting, game balancing, or legal/compliance approval."]'::jsonb
);

do $$
declare
  initial_campaign_id uuid;
begin
  insert into public.cardforge_marketing_campaigns (
    created_by,
    name,
    objective,
    audience_key,
    offer,
    status,
    success_metric,
    utm_campaign
  ) values (
    coalesce(
      (select contributor_id from public.cardforge_social_campaigns order by created_at limit 1),
      'cardforge-owner'
    ),
    'Founder Beta Introduction',
    'Show independent tabletop creators that CardForge turns one design and structured content into a coherent set.',
    'tabletop-designers',
    'Founder Beta access',
    'active',
    'Qualified Studio visits, completed sets, exports, and direct creator feedback.',
    'founder_beta'
  )
  returning id into initial_campaign_id;

  update public.cardforge_social_campaigns
  set marketing_campaign_id = initial_campaign_id,
      utm_content = trim(both '_' from regexp_replace(lower(title), '[^a-z0-9]+', '_', 'g')),
      content_pillar = case
        when lower(title) like 'where does%' then 'customer-research'
        else 'product-proof'
      end,
      content_kind = case
        when lower(title) like 'where does%' then 'question'
        else 'demonstration'
      end,
      funnel_stage = case
        when lower(title) like 'where does%' then 'feedback'
        else 'consideration'
      end,
      call_to_action = case
        when lower(title) like 'where does%' then 'Share where deck prototyping slows down.'
        else 'Enter the Studio.'
      end
  where marketing_campaign_id is null;
end $$;

create or replace function public.cardforge_assign_default_marketing_campaign()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  default_campaign_id uuid;
begin
  if new.marketing_campaign_id is null then
    select campaign.id into default_campaign_id
    from public.cardforge_marketing_campaigns as campaign
    where campaign.status in ('planning', 'active')
    order by (campaign.status = 'active') desc, campaign.created_at
    limit 1;
    new.marketing_campaign_id := default_campaign_id;
  end if;
  if new.marketing_campaign_id is null then
    raise exception 'An active marketing campaign is required.';
  end if;
  return new;
end;
$$;

revoke all on function public.cardforge_assign_default_marketing_campaign()
  from public, anon, authenticated;
grant execute on function public.cardforge_assign_default_marketing_campaign()
  to service_role;

drop trigger if exists cardforge_social_campaigns_assign_marketing_campaign
  on public.cardforge_social_campaigns;
create trigger cardforge_social_campaigns_assign_marketing_campaign
  before insert on public.cardforge_social_campaigns
  for each row execute function public.cardforge_assign_default_marketing_campaign();

alter table public.cardforge_social_campaigns
  alter column marketing_campaign_id set not null;

create unique index cardforge_social_campaigns_tracking_key_idx
  on public.cardforge_social_campaigns (marketing_campaign_id, utm_content)
  where utm_content <> '';
