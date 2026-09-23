begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Community review is intentionally simple: one person, one unit of signal.
-- Owner authority is expressed through the audited override command, not by
-- silently multiplying the Owner's community vote.
alter table public.cardforge_contributor_program_settings
  add column if not exists review_minimum_age_days integer not null default 7,
  add column if not exists review_inactivity_days integer not null default 90,
  add column if not exists trash_retention_days integer not null default 30;

update public.cardforge_contributor_program_settings
set allow_contributor_self_voting = false,
    owner_vote_weight = 1
where id = 'default';

alter table public.cardforge_contributor_program_settings
  drop constraint if exists cardforge_contributor_review_minimum_age_days_check,
  drop constraint if exists cardforge_contributor_review_inactivity_days_check,
  drop constraint if exists cardforge_contributor_trash_retention_days_check,
  drop constraint if exists cardforge_contributor_peer_review_only_check,
  drop constraint if exists cardforge_contributor_unweighted_review_check;

alter table public.cardforge_contributor_program_settings
  add constraint cardforge_contributor_review_minimum_age_days_check
    check (review_minimum_age_days between 0 and 30),
  add constraint cardforge_contributor_review_inactivity_days_check
    check (review_inactivity_days between 7 and 365),
  add constraint cardforge_contributor_trash_retention_days_check
    check (trash_retention_days between 1 and 90),
  add constraint cardforge_contributor_peer_review_only_check
    check (allow_contributor_self_voting = false),
  add constraint cardforge_contributor_unweighted_review_check
    check (owner_vote_weight = 1);

alter table public.cardforge_contributor_asset_submissions
  add column if not exists trashed_at timestamptz,
  add column if not exists purge_after timestamptz,
  add column if not exists trash_reason text,
  add column if not exists retention_hold boolean not null default false,
  add column if not exists purge_claimed_at timestamptz;

alter table public.cardforge_contributor_asset_submissions
  drop constraint if exists cardforge_contributor_asset_trash_reason_check,
  drop constraint if exists cardforge_contributor_asset_trash_dates_check;

alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_trash_reason_check
    check (trash_reason is null or trash_reason in ('declined', 'withdrawn', 'expired', 'superseded')),
  add constraint cardforge_contributor_asset_trash_dates_check
    check (
      (trashed_at is null and purge_after is null and trash_reason is null)
      or (trashed_at is not null and purge_after is not null and trash_reason is not null)
    );

create index if not exists cardforge_contributor_asset_trash_queue_idx
  on public.cardforge_contributor_asset_submissions (purge_after, id)
  where trashed_at is not null and retention_hold = false;

-- Existing failed, never-published work receives a fresh recovery window at
-- rollout; old timestamps never cause surprise immediate deletion.
update public.cardforge_contributor_asset_submissions as submission
set trashed_at = pg_catalog.now(),
    purge_after = pg_catalog.now() + pg_catalog.make_interval(days => settings.trash_retention_days),
    trash_reason = case when submission.contributor_lifecycle_state = 'withdrawn' then 'withdrawn' else 'declined' end
from public.cardforge_contributor_program_settings as settings
where settings.id = 'default'
  and submission.status in ('archived', 'rejected')
  and submission.published_at is null
  and submission.trashed_at is null;

alter table public.cardforge_contributor_asset_votes
  add column if not exists lineage_id uuid;

update public.cardforge_contributor_asset_votes as vote
set lineage_id = submission.lineage_id,
    vote_weight = 1
from public.cardforge_contributor_asset_submissions as submission
where submission.id = vote.submission_id
  and (vote.lineage_id is distinct from submission.lineage_id or vote.vote_weight <> 1);

alter table public.cardforge_contributor_asset_votes
  alter column lineage_id set not null,
  alter column vote_weight set default 1;

alter table public.cardforge_contributor_asset_votes
  drop constraint if exists cardforge_contributor_asset_votes_lineage_fk,
  drop constraint if exists cardforge_contributor_asset_votes_unweighted_check;

alter table public.cardforge_contributor_asset_votes
  add constraint cardforge_contributor_asset_votes_lineage_fk
    foreign key (lineage_id) references public.cardforge_pipeline_asset_lineages(id) on delete cascade,
  add constraint cardforge_contributor_asset_votes_unweighted_check
    check (vote_weight = 1);

-- Historical data allowed one positive on every revision. Keep the strongest,
-- newest preference when a Contributor already selected more than one revision
-- in the same lineage, then enforce the new product invariant at the database.
with ranked_preferences as (
  select
    vote.submission_id,
    vote.contributor_id,
    row_number() over (
      partition by vote.lineage_id, vote.contributor_id
      order by
        case submission.status
          when 'publish_candidate' then 0 when 'voting' then 1 when 'submitted' then 2
          when 'published' then 3 else 4 end,
        submission.revision_number desc nulls last,
        vote.updated_at desc,
        vote.submission_id desc
    ) as preference_rank
  from public.cardforge_contributor_asset_votes as vote
  join public.cardforge_contributor_asset_submissions as submission on submission.id = vote.submission_id
  where vote.vote_value = 'positive'
)
delete from public.cardforge_contributor_asset_votes as vote
using ranked_preferences as ranked
where vote.submission_id = ranked.submission_id
  and vote.contributor_id = ranked.contributor_id
  and ranked.preference_rank > 1;

create unique index if not exists cardforge_contributor_one_positive_preference_per_lineage
  on public.cardforge_contributor_asset_votes (lineage_id, contributor_id)
  where vote_value = 'positive';

create or replace function public.cardforge_validate_contributor_vote_lineage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare expected_lineage uuid;
begin
  select submission.lineage_id into expected_lineage
  from public.cardforge_contributor_asset_submissions as submission
  where submission.id = new.submission_id;
  if not found or expected_lineage is distinct from new.lineage_id then
    raise exception 'contributor_vote_lineage_mismatch';
  end if;
  new.vote_weight := 1;
  return new;
end;
$$;

drop trigger if exists cardforge_contributor_vote_lineage_guard
  on public.cardforge_contributor_asset_votes;
create trigger cardforge_contributor_vote_lineage_guard
  before insert or update of submission_id, lineage_id, vote_weight
  on public.cardforge_contributor_asset_votes
  for each row execute function public.cardforge_validate_contributor_vote_lineage();

create table if not exists public.cardforge_pipeline_publication_events (
  id uuid primary key default gen_random_uuid(),
  lineage_id uuid not null references public.cardforge_pipeline_asset_lineages(id) on delete restrict,
  registry_asset_id text not null,
  previous_submission_id uuid,
  published_submission_id uuid,
  published_revision_number integer,
  positive_preferences integer not null default 0,
  negative_objections integer not null default 0,
  reviewer_count integer not null default 0,
  approval_percent integer not null default 0 check (approval_percent between 0 and 100),
  decision_source text not null check (decision_source in ('automatic', 'owner', 'owner_direct', 'bootstrap')),
  decision_reason text,
  published_at timestamptz not null default now(),
  unique (registry_asset_id, published_submission_id)
);

alter table public.cardforge_pipeline_publication_events enable row level security;
revoke all on table public.cardforge_pipeline_publication_events from public, anon, authenticated;
grant select, insert on table public.cardforge_pipeline_publication_events to service_role;

create or replace function public.cardforge_record_pipeline_publication_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare submission public.cardforge_contributor_asset_submissions%rowtype;
declare reviewer_total integer := 0;
declare approval integer := 0;
declare source_kind text := 'automatic';
begin
  if new.status <> 'published' or new.contributor_submission_id is null
    or (tg_op = 'UPDATE' and old.contributor_submission_id is not distinct from new.contributor_submission_id)
  then
    return new;
  end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = new.contributor_submission_id;
  if not found then return new; end if;

  reviewer_total := submission.positive_votes + submission.negative_votes;
  approval := case when reviewer_total = 0 then 0
    else pg_catalog.round((submission.positive_votes::numeric / reviewer_total::numeric) * 100)::integer end;
  source_kind := case
    when submission.decision_reason = 'pipeline_owner_edit' then 'owner_direct'
    when submission.owner_status_override is not null then 'owner'
    when submission.decision_reason is null then 'bootstrap'
    else 'automatic'
  end;

  insert into public.cardforge_pipeline_publication_events (
    lineage_id, registry_asset_id, previous_submission_id, published_submission_id,
    published_revision_number, positive_preferences, negative_objections,
    reviewer_count, approval_percent, decision_source, decision_reason, published_at
  ) values (
    submission.lineage_id, new.asset_id,
    case when tg_op = 'UPDATE' then old.contributor_submission_id else null end,
    submission.id, submission.revision_number, submission.positive_votes,
    submission.negative_votes, reviewer_total, approval, source_kind,
    submission.decision_reason, coalesce(submission.published_at, pg_catalog.now())
  ) on conflict (registry_asset_id, published_submission_id) do nothing;
  return new;
end;
$$;

drop trigger if exists cardforge_pipeline_publication_event
  on public.cardforge_asset_registry;
create trigger cardforge_pipeline_publication_event
  after insert or update of contributor_submission_id, status
  on public.cardforge_asset_registry
  for each row execute function public.cardforge_record_pipeline_publication_event();

insert into public.cardforge_pipeline_publication_events (
  lineage_id, registry_asset_id, previous_submission_id, published_submission_id,
  published_revision_number, positive_preferences, negative_objections,
  reviewer_count, approval_percent, decision_source, decision_reason, published_at
)
select
  submission.lineage_id, registry.asset_id, null, submission.id,
  submission.revision_number, submission.positive_votes, submission.negative_votes,
  submission.positive_votes + submission.negative_votes,
  case when submission.positive_votes + submission.negative_votes = 0 then 0
    else pg_catalog.round((submission.positive_votes::numeric /
      (submission.positive_votes + submission.negative_votes)::numeric) * 100)::integer end,
  'bootstrap', submission.decision_reason, coalesce(submission.published_at, registry.updated_at, pg_catalog.now())
from public.cardforge_asset_registry as registry
join public.cardforge_contributor_asset_submissions as submission
  on submission.id = registry.contributor_submission_id
where registry.status = 'published'
on conflict (registry_asset_id, published_submission_id) do nothing;

-- Rebalancing counts distinct people, protects the exact live pointer from
-- later feedback, and holds a replacement revision as a candidate until the
-- Owner explicitly promotes it. This prevents community feedback on history
-- from silently changing what general users receive.
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
      count(*) filter (where vote.vote_value = 'negative')::integer as negative_votes
    from public.cardforge_contributor_asset_submissions as submission
    left join public.cardforge_contributor_asset_votes as vote on vote.submission_id = submission.id
    group by submission.id
  )
  update public.cardforge_contributor_asset_submissions as submission
  set positive_votes = totals.positive_votes, negative_votes = totals.negative_votes
  from totals
  where totals.id = submission.id and (
    submission.positive_votes <> totals.positive_votes or submission.negative_votes <> totals.negative_votes
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

revoke execute on function public.cardforge_rebalance_contributor_asset_pipeline(text)
  from public, anon, authenticated;
grant execute on function public.cardforge_rebalance_contributor_asset_pipeline(text) to service_role;

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
  if submission.status in ('draft', 'rejected') and p_owner_contributor_id is null then
    raise exception 'contributor_asset_vote_not_permitted';
  end if;
  if submission.contributor_id = p_contributor_id then
    raise exception 'contributor_asset_self_vote_not_permitted';
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

revoke execute on function public.cardforge_cast_contributor_asset_vote(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_cast_contributor_asset_vote(uuid, text, text, text)
  to service_role;

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
    allow_contributor_self_voting = false,
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

revoke execute on function public.cardforge_update_contributor_program_settings(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_update_contributor_program_settings(jsonb, text)
  to service_role;

create or replace function public.cardforge_set_contributor_asset_lifecycle(
  p_submission_id uuid,
  p_contributor_id text,
  p_action text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  lifecycle_state text;
  retention_days integer;
begin
  if p_action not in ('withdraw', 'retire') then raise exception 'invalid_contributor_lifecycle_action'; end if;
  select * into submission from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and purge_state is null for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;
  if submission.contributor_id <> p_contributor_id then raise exception 'contributor_asset_owner_required'; end if;

  if p_action = 'withdraw' then
    if submission.status not in ('draft', 'submitted', 'voting', 'publish_candidate') then
      raise exception 'contributor_asset_not_withdrawable';
    end if;
    lifecycle_state := 'withdrawn';
    select trash_retention_days into retention_days
    from public.cardforge_contributor_program_settings where id = 'default';
  else
    if submission.status <> 'published' then raise exception 'contributor_asset_not_retirable'; end if;
    lifecycle_state := 'retired';
  end if;

  update public.cardforge_contributor_asset_submissions
  set status = 'archived', automated_status = 'archived', calculated_access_tier = 'hidden',
      automated_access_tier = 'hidden', contributor_lifecycle_state = lifecycle_state,
      decision_reason = case when lifecycle_state = 'withdrawn' then 'contributor_withdrawal' else 'contributor_retirement' end,
      trashed_at = case when lifecycle_state = 'withdrawn' then pg_catalog.now() else null end,
      trash_reason = case when lifecycle_state = 'withdrawn' then 'withdrawn' else null end,
      purge_after = case when lifecycle_state = 'withdrawn'
        then pg_catalog.now() + pg_catalog.make_interval(days => retention_days) else null end,
      updated_at = pg_catalog.now()
  where id = submission.id;

  update public.cardforge_asset_registry
  set status = 'archived', access_tier = 'hidden', updated_at = pg_catalog.now()
  where contributor_submission_id = submission.id;

  return pg_catalog.jsonb_build_object(
    'submissionId', submission.id, 'lineageId', submission.lineage_id,
    'lifecycleState', lifecycle_state, 'existingInstalledCopiesRemainUsable', true,
    'recoverableUntil', case when lifecycle_state = 'withdrawn'
      then pg_catalog.now() + pg_catalog.make_interval(days => retention_days) else null end
  );
end;
$$;

revoke execute on function public.cardforge_set_contributor_asset_lifecycle(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_lifecycle(uuid, text, text)
  to service_role;

-- An unresolved, never-published review eventually becomes recoverable Trash.
-- Published history is deliberately excluded: it may later be compacted, but
-- it is never mistaken for disposable failed content.
create or replace function public.cardforge_expire_inactive_pipeline_reviews(p_limit integer default 100)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare changed_count integer := 0;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'pipeline_retention_limit_invalid'; end if;
  with settings as (
    select review_inactivity_days, trash_retention_days
    from public.cardforge_contributor_program_settings where id = 'default'
  ), due as (
    select submission.id
    from public.cardforge_contributor_asset_submissions as submission cross join settings
    where submission.status in ('draft', 'submitted', 'voting', 'publish_candidate')
      and submission.published_at is null
      and submission.trashed_at is null
      and submission.retention_hold = false
      and coalesce(submission.updated_at, submission.submitted_at)
        <= pg_catalog.now() - pg_catalog.make_interval(days => settings.review_inactivity_days)
    order by coalesce(submission.updated_at, submission.submitted_at), submission.id
    limit p_limit for update of submission skip locked
  )
  update public.cardforge_contributor_asset_submissions as submission
  set status = 'archived', automated_status = 'archived', calculated_access_tier = 'hidden',
      automated_access_tier = 'hidden', decision_reason = 'review_expired',
      trashed_at = pg_catalog.now(), trash_reason = 'expired',
      purge_after = pg_catalog.now() + pg_catalog.make_interval(days => settings.trash_retention_days),
      updated_at = pg_catalog.now()
  from due, settings where submission.id = due.id;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.cardforge_claim_pipeline_revision_purges(p_limit integer default 50)
returns table(submission_id uuid, storage_bucket text, storage_path text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 250 then raise exception 'pipeline_retention_limit_invalid'; end if;
  return query
  with due as (
    select submission.id
    from public.cardforge_contributor_asset_submissions as submission
    where submission.trashed_at is not null and submission.purge_after <= pg_catalog.now()
      and submission.published_at is null and submission.retention_hold = false
      and (submission.purge_state is null or (
        submission.purge_state = 'pending'
        and submission.purge_claimed_at < pg_catalog.now() - interval '15 minutes'
      ))
      and not exists (select 1 from public.cardforge_asset_registry as registry
        where registry.contributor_submission_id = submission.id)
    order by submission.purge_after, submission.id
    limit p_limit for update skip locked
  ), claimed as (
    update public.cardforge_contributor_asset_submissions as submission
    set purge_state = 'pending', purge_claimed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    from due where submission.id = due.id
    returning submission.id, submission.source_storage_bucket, submission.source_storage_path
  )
  select claimed.id, claimed.source_storage_bucket, claimed.source_storage_path from claimed;
end;
$$;

create or replace function public.cardforge_finalize_pipeline_revision_purge(p_submission_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_contributor_asset_submissions as submission
  where submission.id = p_submission_id and submission.purge_state = 'pending'
    and submission.trashed_at is not null and submission.purge_after <= pg_catalog.now()
    and submission.published_at is null and submission.retention_hold = false
    and not exists (select 1 from public.cardforge_asset_registry as registry
      where registry.contributor_submission_id = submission.id);
  return found;
end;
$$;

create or replace function public.cardforge_release_pipeline_revision_purge(p_submission_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.cardforge_contributor_asset_submissions
  set purge_state = null, purge_claimed_at = null, updated_at = pg_catalog.now()
  where id = p_submission_id and purge_state = 'pending';
  return found;
end;
$$;

revoke execute on function public.cardforge_expire_inactive_pipeline_reviews(integer) from public, anon, authenticated;
revoke execute on function public.cardforge_claim_pipeline_revision_purges(integer) from public, anon, authenticated;
revoke execute on function public.cardforge_finalize_pipeline_revision_purge(uuid) from public, anon, authenticated;
revoke execute on function public.cardforge_release_pipeline_revision_purge(uuid) from public, anon, authenticated;
grant execute on function public.cardforge_expire_inactive_pipeline_reviews(integer) to service_role;
grant execute on function public.cardforge_claim_pipeline_revision_purges(integer) to service_role;
grant execute on function public.cardforge_finalize_pipeline_revision_purge(uuid) to service_role;
grant execute on function public.cardforge_release_pipeline_revision_purge(uuid) to service_role;

create or replace function public.cardforge_authorize_pipeline_revision_retention(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce((select extensions.digest(pg_catalog.convert_to(secret.decrypted_secret, 'UTF8'), 'sha256')
      = extensions.digest(pg_catalog.convert_to(p_secret, 'UTF8'), 'sha256')
    from vault.decrypted_secrets as secret
    where secret.name = 'pipeline_revision_retention_cron_secret' limit 1), false);
$$;

revoke execute on function public.cardforge_authorize_pipeline_revision_retention(text)
  from public, anon, authenticated;
grant execute on function public.cardforge_authorize_pipeline_revision_retention(text) to service_role;

do $retention_secret$
begin
  if not exists (select 1 from vault.decrypted_secrets
    where name = 'pipeline_revision_retention_cron_secret') then
    perform vault.create_secret(
      pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
      'pipeline_revision_retention_cron_secret',
      'Dedicated secret for the Pipeline revision retention worker.'
    );
  end if;
  raise notice 'Pipeline cleanup scheduling remains disabled until its Edge Function passes a controlled Staging purge.';
end
$retention_secret$;

comment on table public.cardforge_pipeline_publication_events is
  'Append-only receipt for the exact revision and review snapshot that became live in the shared registry.';
comment on column public.cardforge_contributor_asset_submissions.trashed_at is
  'Recoverable Trash classification for never-published declined, withdrawn, expired, or superseded work.';
comment on column public.cardforge_contributor_asset_submissions.purge_after is
  'Earliest permanent-cleanup time. The Storage object must be removed before database finalization.';
comment on function public.cardforge_cast_contributor_asset_vote(uuid, text, text, text) is
  'Atomically transfers one positive preference within a lineage or records one revision-specific objection.';

commit;
