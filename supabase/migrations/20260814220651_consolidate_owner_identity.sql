-- Consolidate retired Cameron development proxies into the canonical Pyralis owner identity.
begin;

create table if not exists public.cardforge_identity_aliases (
  source_user_id text primary key,
  canonical_user_id text not null,
  canonical_email text not null,
  canonical_name text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (char_length(source_user_id) between 1 and 200),
  check (char_length(canonical_user_id) between 1 and 200),
  check (char_length(canonical_email) between 3 and 320),
  check (char_length(canonical_name) between 1 and 160),
  check (char_length(reason) between 1 and 500)
);

alter table public.cardforge_identity_aliases enable row level security;
revoke all privileges on table public.cardforge_identity_aliases from public, anon, authenticated;
grant select on table public.cardforge_identity_aliases to service_role;

comment on table public.cardforge_identity_aliases is
  'Read-only presentation aliases for retired identities. Raw audit actors and targets remain immutable.';

create temporary table cardforge_owner_identity_legacy (
  clerk_user_id text primary key,
  expected_email text not null
) on commit drop;

insert into cardforge_owner_identity_legacy (clerk_user_id, expected_email) values
  ('user_3E69kq9em966mJXGbRoO1ddCJLA', 'cameron.r.locke96@gmail.com'),
  ('user_3GYJ8zFiIICrgVVEaZJChy1qddQ', 'cameron.r.locke96@gmail.com'),
  ('user_3E8rtGOCbTEGV4nPFSNLjgcqTQh', 'cardforge.qa.20260523212049.owner@example.com'),
  ('user_3E8tWL7j6mQ7NuBBKrCmcr0DiSg', 'cardforge.qa.20260523213413.freshdev@example.com'),
  ('user_3GZBd3P1KUEHca9FdRSgmJEJfEX', 'cardforge+fresh-owner@example.com'),
  ('user_3GK8enICNgyiOhU8lxPWoiIBlj0', 'cardforge+fresh-owner@example.com'),
  ('user_3GK8egt6AhKlIX4xiliyplCg7df', 'cardforge+freshdev@example.com'),
  ('user_3GZBcvf0ZG4XLpx7T7goCe7CzQY', 'cardforge+freshdev@example.com'),
  ('user_3ECWvFMvDRdzD1ymIUpnelzud6S', 'cardforge+clerk_test_1779683259249@example.com'),
  ('user_3ECXY3iWBeWEIFpL6Q4hXaNAunv', 'cardforge+clerk_test_1779683567810@example.com'),
  ('user_3EE1etLwZGj68rXfGhvRRy2Lm14', 'cardforge+clerk_test_1779729010311@example.com'),
  ('user_3EE2EzJWMNRPnSNTntAHMeYUyOE', 'cardforge+clerk_test_1779729298865@example.com'),
  ('user_3EE2g6wft7EVmMCZRskfKgZA0kA', 'cardforge+clerk_test_1779729514509@example.com'),
  ('user_3EE2wK9jNSXwBeVIGWdnb6YCxEo', 'cardforge+clerk_test_1779729643031@example.com'),
  ('user_3EE3MDEzpzWXjP0wVIdDyOJGTG8', 'cardforge+clerk_test_1779729849791@example.com');

insert into public.cardforge_identity_aliases (
  source_user_id,
  canonical_user_id,
  canonical_email,
  canonical_name,
  reason
)
select
  legacy.clerk_user_id,
  'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
  'pyraliscameron@gmail.com',
  'Pyralis Cameron',
  'Cameron-owned prelaunch development and QA proxy consolidated into the canonical owner publisher.'
from pg_temp.cardforge_owner_identity_legacy as legacy
on conflict (source_user_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from public.cardforge_developer_profiles
    where clerk_user_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
      and lower(email) = 'pyraliscameron@gmail.com'
      and status = 'active'
  ) then
    raise exception 'canonical_owner_profile_missing';
  end if;

  if exists (
    select 1
    from public.cardforge_developer_profiles as profile
    join pg_temp.cardforge_owner_identity_legacy as legacy
      on legacy.clerk_user_id = profile.clerk_user_id
    where lower(coalesce(profile.email, '')) <> legacy.expected_email
  ) then
    raise exception 'legacy_owner_identity_mismatch';
  end if;

  if exists (
    select 1
    from public.cardforge_identity_aliases as alias
    join pg_temp.cardforge_owner_identity_legacy as legacy
      on legacy.clerk_user_id = alias.source_user_id
    where alias.canonical_user_id <> 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
      or lower(alias.canonical_email) <> 'pyraliscameron@gmail.com'
      or alias.canonical_name <> 'Pyralis Cameron'
  ) then
    raise exception 'development_proxy_alias_mismatch';
  end if;

  if exists (
    select 1
    from public.cardforge_developer_profiles as profile
    where profile.clerk_user_id <> 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
      and (
        lower(coalesce(profile.email, '')) = 'cameron.r.locke96@gmail.com'
        or lower(coalesce(profile.email, '')) like 'cardforge.qa.%@example.com'
        or lower(coalesce(profile.email, '')) like 'cardforge+fresh%@example.com'
        or lower(coalesce(profile.email, '')) like 'cardforge+clerk_test_%@example.com'
      )
      and not exists (
        select 1
        from pg_temp.cardforge_owner_identity_legacy as legacy
        where legacy.clerk_user_id = profile.clerk_user_id
      )
  ) then
    raise exception 'unreviewed_development_proxy_identity';
  end if;

  if exists (
    select clerk_user_id from public.cardforge_billing_entitlement_locks
    where clerk_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select clerk_user_id from public.cardforge_billing_events
    where clerk_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select clerk_user_id from public.cardforge_billing_subscriptions
    where clerk_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
  ) then
    raise exception 'development_proxy_has_financial_or_entitlement_history';
  end if;

  if not exists (
    select 1
    from storage.objects as destination
    where destination.bucket_id = 'cardforge-developer-assets'
      and destination.name = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
  ) then
    raise exception 'canonical_owner_storage_copy_missing';
  end if;

  if not exists (
    select 1
    from public.cardforge_owner_activity
    where action = 'identity.development_proxies.consolidated'
      and target_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
  ) and not exists (
    select 1
    from storage.objects as source
    join storage.objects as destination
      on destination.bucket_id = source.bucket_id
     and destination.name = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
     and destination.metadata ->> 'size' = source.metadata ->> 'size'
     and destination.metadata ->> 'eTag' = source.metadata ->> 'eTag'
    where source.bucket_id = 'cardforge-developer-assets'
      and source.name = 'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
  ) then
    raise exception 'canonical_owner_storage_copy_mismatch';
  end if;
end $$;

create temporary table cardforge_owner_identity_submissions on commit drop as
select id
from public.cardforge_developer_asset_submissions
where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

create temporary table cardforge_owner_identity_stats on commit drop as
select
  (select count(*) from public.cardforge_developer_profiles where clerk_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as retired_profiles,
  (select count(*) from public.cardforge_developer_asset_submissions where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as submissions,
  (select count(*) from public.cardforge_developer_asset_votes where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as asset_votes,
  (select count(*) from public.cardforge_roadmap_votes where user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as roadmap_votes,
  (select count(*) from public.cardforge_social_campaigns where contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as campaigns,
  (select count(*) from public.cardforge_campaign_media where ingesting_contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as campaign_media,
  (select count(*) from public.cardforge_campaign_media_derivatives where approved_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as derivative_approvals,
  (select count(*) from public.cardforge_site_content_proposals where contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)) as site_proposals;

insert into public.cardforge_developer_asset_votes as current_vote (
  submission_id,
  developer_id,
  vote_value,
  voted_at,
  updated_at,
  vote_weight
)
select distinct on (vote.submission_id)
  vote.submission_id,
  'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
  vote.vote_value,
  vote.voted_at,
  vote.updated_at,
  vote.vote_weight
from public.cardforge_developer_asset_votes as vote
where vote.developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
order by vote.submission_id, vote.updated_at desc, vote.voted_at desc, vote.developer_id
on conflict (submission_id, developer_id) do update
set
  vote_value = excluded.vote_value,
  voted_at = excluded.voted_at,
  updated_at = excluded.updated_at,
  vote_weight = excluded.vote_weight
where excluded.updated_at >= current_vote.updated_at;

delete from public.cardforge_developer_asset_votes
where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

insert into public.cardforge_roadmap_votes as current_vote (
  item_id,
  user_id,
  vote,
  created_at,
  updated_at
)
select distinct on (roadmap_vote.item_id)
  roadmap_vote.item_id,
  'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
  roadmap_vote.vote,
  roadmap_vote.created_at,
  roadmap_vote.updated_at
from public.cardforge_roadmap_votes as roadmap_vote
where roadmap_vote.user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
order by roadmap_vote.item_id, roadmap_vote.updated_at desc, roadmap_vote.created_at desc, roadmap_vote.user_id
on conflict (item_id, user_id) do update
set
  vote = excluded.vote,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at
where excluded.updated_at >= current_vote.updated_at;

delete from public.cardforge_roadmap_votes
where user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_developer_asset_submissions
set
  developer_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
  developer_email = 'pyraliscameron@gmail.com',
  source_storage_path = case
    when source_storage_path = 'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
      then 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
    else source_storage_path
  end,
  source_url = case
    when source_storage_path = 'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
      then replace(
        source_url,
        'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json',
        'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
      )
    else source_url
  end
where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_social_campaigns
set contributor_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
    contributor_email = 'pyraliscameron@gmail.com',
    contributor_name = 'Pyralis Cameron'
where contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_campaign_media
set ingesting_contributor_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
    contributor_email = 'pyraliscameron@gmail.com',
    contributor_name = 'Pyralis Cameron'
where ingesting_contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_site_content_proposals
set contributor_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
    contributor_email = 'pyraliscameron@gmail.com',
    contributor_name = 'Pyralis Cameron'
where contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_social_campaign_associations
set created_by = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
where created_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_social_campaigns
set reviewed_by = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
where reviewed_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_campaign_media
set reviewed_by = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
where reviewed_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_campaign_media_derivatives
set approved_by = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
where approved_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_site_content_proposals
set reviewed_by = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
where reviewed_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

update public.cardforge_roadmap_items
set created_by_user_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
    created_by_email = 'pyraliscameron@gmail.com'
where created_by_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

do $$
begin
  if exists (select 1 from pg_temp.cardforge_owner_identity_submissions)
    or exists (select 1 from pg_temp.cardforge_owner_identity_stats where asset_votes > 0)
  then
    perform public.cardforge_rebalance_developer_asset_pipeline(
      'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
    );
  end if;
end $$;

update public.cardforge_asset_registry
set
  storage_path = case
    when storage_path = 'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
      then 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
    else storage_path
  end,
  url = case
    when storage_path = 'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
      then replace(
        url,
        'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json',
        'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
      )
    else url
  end,
  updated_at = now()
where developer_submission_id in (
  select id from pg_temp.cardforge_owner_identity_submissions
);

update public.cardforge_asset_registry
set metadata = jsonb_set(metadata, '{style,contributorName}', to_jsonb('Pyralis Cameron'::text), true),
    updated_at = now()
where developer_submission_id in (
  select id from pg_temp.cardforge_owner_identity_submissions
)
  and jsonb_typeof(metadata -> 'style') = 'object'
  and metadata #>> '{style,contributorName}' is distinct from 'Pyralis Cameron';

update public.cardforge_asset_registry
set metadata = jsonb_set(metadata, '{template,templateContributorName}', to_jsonb('Pyralis Cameron'::text), true),
    updated_at = now()
where developer_submission_id in (
  select id from pg_temp.cardforge_owner_identity_submissions
)
  and jsonb_typeof(metadata -> 'template') = 'object'
  and metadata #>> '{template,templateContributorName}' is distinct from 'Pyralis Cameron';

insert into public.cardforge_owner_activity (
  actor_user_id,
  actor_email,
  action,
  target_type,
  target_id,
  summary,
  outcome,
  metadata
)
select
  'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
  'pyraliscameron@gmail.com',
  'identity.development_proxies.consolidated',
  'identity_consolidation',
  'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG',
  'Consolidated Cameron-owned prelaunch development and QA identities into the canonical Pyralis Cameron publisher.',
  'succeeded',
  jsonb_build_object(
    'canonicalEmail', 'pyraliscameron@gmail.com',
    'canonicalName', 'Pyralis Cameron',
    'retiredIdentityIds', (
      select jsonb_agg(clerk_user_id order by clerk_user_id)
      from pg_temp.cardforge_owner_identity_legacy
    ),
    'records', jsonb_build_object(
      'retiredProfiles', stats.retired_profiles,
      'submissions', stats.submissions,
      'assetVotes', stats.asset_votes,
      'roadmapVotes', stats.roadmap_votes,
      'campaigns', stats.campaigns,
      'campaignMedia', stats.campaign_media,
      'derivativeApprovals', stats.derivative_approvals,
      'siteProposals', stats.site_proposals
    )
  )
from pg_temp.cardforge_owner_identity_stats as stats
where not exists (
  select 1
  from public.cardforge_owner_activity
  where action = 'identity.development_proxies.consolidated'
    and target_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
);

delete from public.cardforge_developer_profiles
where clerk_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy);

create or replace function public.cardforge_prevent_retired_identity_recreation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.cardforge_identity_aliases
    where source_user_id = new.clerk_user_id
  ) then
    raise exception 'retired_identity';
  end if;
  return new;
end;
$$;

revoke execute on function public.cardforge_prevent_retired_identity_recreation()
  from public, anon, authenticated;
grant execute on function public.cardforge_prevent_retired_identity_recreation()
  to service_role;

drop trigger if exists cardforge_prevent_retired_identity_recreation
  on public.cardforge_developer_profiles;
create trigger cardforge_prevent_retired_identity_recreation
  before insert or update of clerk_user_id
  on public.cardforge_developer_profiles
  for each row
  execute function public.cardforge_prevent_retired_identity_recreation();

comment on function public.cardforge_prevent_retired_identity_recreation() is
  'Prevents a retired development-proxy Clerk identity from recreating a developer profile.';

do $$
begin
  if exists (
    select 1 from public.cardforge_developer_profiles where clerk_user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_developer_asset_submissions where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_developer_asset_votes where developer_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_roadmap_votes where user_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_social_campaigns where contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_campaign_media where ingesting_contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_site_content_proposals where contributor_id in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_social_campaign_associations where created_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
    union all
    select 1 from public.cardforge_campaign_media_derivatives where approved_by in (select clerk_user_id from pg_temp.cardforge_owner_identity_legacy)
  ) then
    raise exception 'development_proxy_attribution_remains';
  end if;

  if exists (
    select 1
    from public.cardforge_asset_registry
    where metadata::text ilike any (array[
      '%cameron.r.locke96%',
      '%cardforge.qa.%',
      '%cardforge+fresh%',
      '%cardforge+clerk_test%'
    ])
      or storage_path = 'user_3GYJ8zFiIICrgVVEaZJChy1qddQ/templates/1786597290358-arcane-playing-card-template-9NSUBdFm.json'
  ) then
    raise exception 'development_proxy_registry_provenance_remains';
  end if;

  if exists (
    select 1
    from pg_temp.cardforge_owner_identity_legacy as legacy
    left join public.cardforge_identity_aliases as alias
      on alias.source_user_id = legacy.clerk_user_id
     and alias.canonical_user_id = 'user_3Gj7V9nhLhDE7AlqVIsEPit3tmG'
     and lower(alias.canonical_email) = 'pyraliscameron@gmail.com'
     and alias.canonical_name = 'Pyralis Cameron'
    where alias.source_user_id is null
  ) then
    raise exception 'development_proxy_alias_missing';
  end if;
end $$;

commit;
