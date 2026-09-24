begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Every Contributor, including the author and Owner, casts one unweighted vote.
-- Preserve the historical vote rows and only change policy for future votes.
alter table public.cardforge_contributor_program_settings
  drop constraint if exists cardforge_contributor_peer_review_only_check;

update public.cardforge_contributor_program_settings
set allow_contributor_self_voting = true
where id = 'default';

alter table public.cardforge_contributor_program_settings
  add constraint cardforge_contributor_self_voting_enabled_check
    check (allow_contributor_self_voting = true);

-- Keep lineage and weight checks for direct service-role writes.
create or replace function public.cardforge_validate_contributor_vote_lineage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_lineage uuid;
begin
  select submission.lineage_id
  into expected_lineage
  from public.cardforge_contributor_asset_submissions as submission
  where submission.id = new.submission_id;

  if not found or expected_lineage is distinct from new.lineage_id then
    raise exception 'contributor_vote_lineage_mismatch';
  end if;

  new.vote_weight := 1;
  return new;
end;
$$;

-- Rebalance only active candidates and the current live registry pointer.
-- Feedback on historical/closed revisions changes their totals, not lifecycle.
create or replace function public.cardforge_rebalance_contributor_asset_pipeline(
  p_owner_contributor_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_count integer := 0;
  submission_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline', 0));

  with totals as (
    select submission.id,
      count(*) filter (where vote.vote_value = 'positive')::integer as positive_votes,
      count(*) filter (where vote.vote_value = 'negative')::integer as negative_votes,
      case when count(vote.submission_id) = 0 then 0 else
        pg_catalog.round((count(*) filter (where vote.vote_value = 'positive')::numeric /
          count(vote.submission_id)::numeric) * 100)::integer end as quality_score
    from public.cardforge_contributor_asset_submissions as submission
    left join public.cardforge_contributor_asset_votes as vote on vote.submission_id = submission.id
    group by submission.id
  )
  update public.cardforge_contributor_asset_submissions as submission
  set positive_votes = totals.positive_votes, negative_votes = totals.negative_votes,
      quality_score = totals.quality_score
  from totals
  where totals.id = submission.id and (
    submission.positive_votes <> totals.positive_votes or submission.negative_votes <> totals.negative_votes
    or submission.quality_score <> totals.quality_score
  );

  with settings as (
    select * from public.cardforge_contributor_program_settings where id = 'default'
  ), scored as (
    select submission.id, submission.lineage_id, submission.asset_type, submission.submitted_at,
      submission.positive_votes, submission.negative_votes,
      submission.positive_votes + submission.negative_votes as total_votes,
      case when submission.positive_votes + submission.negative_votes = 0 then 0 else
        pg_catalog.round((submission.positive_votes::numeric /
          (submission.positive_votes + submission.negative_votes)::numeric) * 100)::integer end as quality_score,
      settings.minimum_votes_for_grading as minimum_votes,
      settings.free_asset_minimum_positive_vote_percent as free_threshold,
      settings.paid_asset_minimum_positive_vote_percent as paid_threshold,
      settings.trash_retention_days,
      coalesce((settings.tier_caps_by_type -> submission.asset_type ->> 'free')::integer, 0) as free_cap,
      coalesce((settings.tier_caps_by_type -> submission.asset_type ->> 'paid')::integer, 0) as paid_cap,
      submission.submitted_at <= pg_catalog.now() - pg_catalog.make_interval(days => settings.review_minimum_age_days) as review_age_met,
      registry.asset_id is not null as is_current_publication,
      registry.access_tier as current_access_tier,
      exists (select 1 from public.cardforge_asset_registry as live
        where live.status = 'published' and live.contributor_submission_id is not null
          and live.contributor_submission_id <> submission.id
          and exists (select 1 from public.cardforge_contributor_asset_submissions as current_submission
            where current_submission.id = live.contributor_submission_id
              and current_submission.lineage_id = submission.lineage_id)) as lineage_already_live
    from public.cardforge_contributor_asset_submissions as submission
    cross join settings
    left join public.cardforge_asset_registry as registry
      on registry.status = 'published' and registry.contributor_submission_id = submission.id
    where submission.purge_state is null and submission.trashed_at is null
      and (submission.status in ('submitted', 'voting', 'publish_candidate')
        or registry.asset_id is not null)
  ), occupied as (
    select asset_type,
      count(*) filter (where is_current_publication and current_access_tier = 'free')::integer as free_used,
      count(*) filter (where is_current_publication and current_access_tier = 'paid')::integer as paid_used
    from scored group by asset_type
  ), ranked as (
    select scored.*,
      count(*) filter (where not is_current_publication and not lineage_already_live
        and review_age_met and total_votes >= minimum_votes and quality_score >= paid_threshold)
        over (partition by asset_type order by quality_score desc, total_votes desc, submitted_at asc, id asc) as paid_rank,
      count(*) filter (where not is_current_publication and not lineage_already_live
        and review_age_met and total_votes >= minimum_votes
        and quality_score >= free_threshold and quality_score < paid_threshold)
        over (partition by asset_type order by quality_score desc, total_votes desc, submitted_at asc, id asc) as free_rank
    from scored
  ), decisions as (
    select ranked.id, ranked.quality_score, ranked.trash_retention_days,
      case
        when ranked.is_current_publication then 'published'
        when ranked.total_votes < ranked.minimum_votes then 'voting'
        when not ranked.review_age_met then 'publish_candidate'
        when ranked.quality_score < ranked.free_threshold then 'archived'
        when ranked.lineage_already_live then 'publish_candidate'
        when ranked.quality_score >= ranked.paid_threshold
          and ranked.paid_rank <= greatest(ranked.paid_cap - coalesce(occupied.paid_used, 0), 0) then 'published'
        when ranked.quality_score >= ranked.free_threshold
          and ranked.free_rank <= greatest(ranked.free_cap - coalesce(occupied.free_used, 0), 0) then 'published'
        else 'publish_candidate'
      end as automated_status,
      case
        when ranked.is_current_publication then ranked.current_access_tier
        when ranked.total_votes < ranked.minimum_votes then 'contributor'
        when not ranked.review_age_met then 'contributor'
        when ranked.quality_score < ranked.free_threshold then 'hidden'
        when ranked.lineage_already_live then 'contributor'
        when ranked.quality_score >= ranked.paid_threshold
          and ranked.paid_rank <= greatest(ranked.paid_cap - coalesce(occupied.paid_used, 0), 0) then 'paid'
        when ranked.quality_score >= ranked.free_threshold
          and ranked.free_rank <= greatest(ranked.free_cap - coalesce(occupied.free_used, 0), 0) then 'free'
        else 'contributor'
      end as automated_access_tier,
      case
        when ranked.is_current_publication then 'current_publication_protected'
        when ranked.total_votes < ranked.minimum_votes then 'needs_more_votes'
        when not ranked.review_age_met then 'minimum_review_age'
        when ranked.quality_score < ranked.free_threshold then 'below_free_threshold'
        when ranked.lineage_already_live then 'revision_ready_for_owner'
        when ranked.quality_score >= ranked.paid_threshold
          and ranked.paid_rank <= greatest(ranked.paid_cap - coalesce(occupied.paid_used, 0), 0) then 'paid_candidate'
        when ranked.quality_score >= ranked.free_threshold
          and ranked.free_rank <= greatest(ranked.free_cap - coalesce(occupied.free_used, 0), 0) then 'free_candidate'
        else 'tier_cap_full'
      end as automatic_reason
    from ranked left join occupied using (asset_type)
  ), effective as (
    select submission.id, decisions.quality_score, decisions.trash_retention_days,
      decisions.automated_status, decisions.automated_access_tier, decisions.automatic_reason,
      coalesce(submission.owner_status_override, decisions.automated_status) as effective_status,
      case
        when coalesce(submission.owner_status_override, decisions.automated_status) = 'published' then
          coalesce(submission.owner_access_tier_override,
            case when decisions.automated_access_tier in ('free', 'paid') then decisions.automated_access_tier else null end, 'free')
        when coalesce(submission.owner_status_override, decisions.automated_status) in ('archived', 'rejected') then 'hidden'
        else 'contributor'
      end as effective_access_tier
    from public.cardforge_contributor_asset_submissions as submission
    join decisions on decisions.id = submission.id
  )
  update public.cardforge_contributor_asset_submissions as submission
  set automated_status = effective.automated_status,
      automated_access_tier = effective.automated_access_tier,
      status = effective.effective_status,
      calculated_access_tier = effective.effective_access_tier,
      quality_score = effective.quality_score,
      decision_reason = case when submission.owner_status_override is not null then 'owner_status_override' else effective.automatic_reason end,
      tier_decision_reason = case
        when effective.effective_status <> 'published' and effective.effective_access_tier = 'hidden' then 'hidden_status'
        when submission.owner_access_tier_override is not null then 'owner_forced_' || submission.owner_access_tier_override
        else effective.automatic_reason end,
      published_at = case when effective.effective_status = 'published' and submission.status <> 'published'
        then pg_catalog.now() else submission.published_at end,
      trashed_at = case when effective.effective_status = 'archived' and submission.published_at is null
        then coalesce(submission.trashed_at, pg_catalog.now())
        when effective.effective_status not in ('archived', 'rejected') then null else submission.trashed_at end,
      trash_reason = case when effective.effective_status = 'archived' and submission.published_at is null
        then coalesce(submission.trash_reason, 'declined')
        when effective.effective_status not in ('archived', 'rejected') then null else submission.trash_reason end,
      purge_after = case when effective.effective_status = 'archived' and submission.published_at is null
        then coalesce(submission.purge_after, pg_catalog.now() + pg_catalog.make_interval(days => effective.trash_retention_days))
        when effective.effective_status not in ('archived', 'rejected') then null else submission.purge_after end
  from effective where effective.id = submission.id;

  get diagnostics changed_count = row_count;
  for submission_id in
    select submission.id from public.cardforge_contributor_asset_submissions as submission
    where submission.purge_state is null and submission.trashed_at is null
    order by case when submission.status = 'published' then 0 else 1 end,
      submission.revision_number asc nulls first, submission.submitted_at asc, submission.id asc
  loop
    perform public.cardforge_sync_contributor_asset_registry(submission_id);
  end loop;
  return changed_count;
end;
$$;

create or replace function public.cardforge_cast_contributor_asset_vote(
  p_submission_id uuid,
  p_contributor_id text,
  p_vote_value text,
  p_owner_contributor_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare submission public.cardforge_contributor_asset_submissions%rowtype;
begin
  if nullif(pg_catalog.btrim(p_contributor_id), '') is null
    or p_vote_value not in ('positive', 'negative')
  then raise exception 'invalid_contributor_asset_vote'; end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  perform 1 from public.cardforge_pipeline_asset_lineages
  where id = submission.lineage_id for update;

  if submission.trashed_at is not null then raise exception 'contributor_asset_vote_not_permitted'; end if;
  if submission.status = 'draft' then
    raise exception 'contributor_asset_vote_not_permitted';
  end if;

  if p_vote_value = 'positive' then
    delete from public.cardforge_contributor_asset_votes
    where lineage_id = submission.lineage_id
      and contributor_id = p_contributor_id
      and vote_value = 'positive'
      and submission_id <> submission.id;
  end if;

  insert into public.cardforge_contributor_asset_votes (
    submission_id, lineage_id, contributor_id, vote_value, vote_weight
  ) values (
    submission.id, submission.lineage_id, p_contributor_id, p_vote_value, 1
  )
  on conflict (submission_id, contributor_id) do update
  set lineage_id = excluded.lineage_id,
      vote_value = excluded.vote_value,
      vote_weight = 1,
      updated_at = pg_catalog.now();

  return public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
end;
$$;

create or replace function public.cardforge_update_contributor_program_settings(
  p_settings jsonb,
  p_owner_contributor_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_settings is null or pg_catalog.jsonb_typeof(p_settings) <> 'object' then
    raise exception 'invalid_contributor_program_settings';
  end if;
  update public.cardforge_contributor_program_settings
  set
    max_active_contributors = (p_settings ->> 'maxActiveContributors')::integer,
    monthly_submission_limit = (p_settings ->> 'monthlySubmissionLimit')::integer,
    max_submission_file_size_mb = coalesce((p_settings ->> 'maxSubmissionFileSizeMb')::integer, max_submission_file_size_mb),
    monthly_published_requirement = (p_settings ->> 'monthlyPublishedRequirement')::integer,
    minimum_votes_for_grading = (p_settings ->> 'minimumVotesForGrading')::integer,
    minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    free_asset_minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    paid_asset_minimum_positive_vote_percent = (p_settings ->> 'paidAssetMinimumPositiveVotePercent')::integer,
    minimum_votes_for_tier_assignment = (p_settings ->> 'minimumVotesForGrading')::integer,
    allow_contributor_self_voting = true,
    owner_vote_weight = 1,
    review_minimum_age_days = coalesce((p_settings ->> 'reviewMinimumAgeDays')::integer, review_minimum_age_days),
    review_inactivity_days = coalesce((p_settings ->> 'reviewInactivityDays')::integer, review_inactivity_days),
    trash_retention_days = coalesce((p_settings ->> 'trashRetentionDays')::integer, trash_retention_days),
    owner_final_review_required = false,
    publish_caps_by_type = p_settings -> 'publishCapsByType',
    tier_caps_by_type = p_settings -> 'tierCapsByType'
  where id = 'default';
  if not found then raise exception 'contributor_program_settings_not_found'; end if;
  return public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
end;
$$;

commit;
