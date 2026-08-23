begin;

set local lock_timeout = '5s';

alter table public.cardforge_developer_program_settings
  add column if not exists max_submission_file_size_mb integer not null default 25;

alter table public.cardforge_developer_program_settings
  drop constraint if exists cardforge_developer_program_upload_file_size_range;

alter table public.cardforge_developer_program_settings
  add constraint cardforge_developer_program_upload_file_size_range
  check (max_submission_file_size_mb between 1 and 50);

create or replace function public.cardforge_update_developer_program_settings(
  p_settings jsonb,
  p_owner_developer_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_settings is null or pg_catalog.jsonb_typeof(p_settings) <> 'object' then
    raise exception 'invalid_developer_program_settings';
  end if;

  update public.cardforge_developer_program_settings
  set
    max_active_developers = (p_settings ->> 'maxActiveDevelopers')::integer,
    monthly_submission_limit = (p_settings ->> 'monthlySubmissionLimit')::integer,
    max_submission_file_size_mb = coalesce(
      (p_settings ->> 'maxSubmissionFileSizeMb')::integer,
      max_submission_file_size_mb
    ),
    monthly_published_requirement = (p_settings ->> 'monthlyPublishedRequirement')::integer,
    minimum_votes_for_grading = (p_settings ->> 'minimumVotesForGrading')::integer,
    minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    free_asset_minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    paid_asset_minimum_positive_vote_percent = (p_settings ->> 'paidAssetMinimumPositiveVotePercent')::integer,
    minimum_votes_for_tier_assignment = (p_settings ->> 'minimumVotesForGrading')::integer,
    allow_contributor_self_voting = (p_settings ->> 'allowContributorSelfVoting')::boolean,
    owner_vote_weight = (p_settings ->> 'ownerVoteWeight')::integer,
    owner_final_review_required = false,
    publish_caps_by_type = p_settings -> 'publishCapsByType',
    tier_caps_by_type = p_settings -> 'tierCapsByType'
  where id = 'default';

  if not found then
    raise exception 'developer_program_settings_not_found';
  end if;

  return public.cardforge_rebalance_developer_asset_pipeline(p_owner_developer_id);
end;
$$;

update storage.buckets
set file_size_limit = 52428800
where id = 'cardforge-developer-assets';

comment on column public.cardforge_developer_program_settings.max_submission_file_size_mb is
  'Owner-controlled CardForge ceiling for one Forge Review media or font source file. The Storage bucket enforces the 50 MB platform hard ceiling.';

commit;
