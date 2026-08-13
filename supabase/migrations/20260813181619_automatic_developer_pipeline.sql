begin;

set local lock_timeout = '5s';

alter table public.cardforge_developer_asset_submissions
  add column if not exists automated_status text not null default 'voting'
    check (automated_status in ('voting', 'publish_candidate', 'published', 'archived')),
  add column if not exists owner_status_override text
    check (owner_status_override in ('voting', 'publish_candidate', 'published', 'archived', 'rejected')),
  add column if not exists automated_access_tier text not null default 'developer'
    check (automated_access_tier in ('hidden', 'free', 'paid', 'developer')),
  add column if not exists purge_state text
    check (purge_state in ('pending'));

comment on column public.cardforge_developer_asset_submissions.automated_status
  is 'Vote-and-cap result before an owner status override is applied.';
comment on column public.cardforge_developer_asset_submissions.owner_status_override
  is 'Persistent owner decision. Null returns the asset to automatic pipeline control.';
comment on column public.cardforge_developer_asset_submissions.automated_access_tier
  is 'Vote-and-cap tier before an owner tier override is applied.';
comment on column public.cardforge_developer_asset_submissions.purge_state
  is 'Recoverable handshake state while an owner permanently deletes an asset lineage and its managed storage objects.';

create table if not exists public.cardforge_pipeline_asset_tombstones (
  asset_id text primary key,
  asset_name text not null,
  deleted_submission_id uuid,
  deleted_at timestamptz not null default pg_catalog.now()
);

comment on table public.cardforge_pipeline_asset_tombstones
  is 'Durable owner deletion intent. Prevents bootstrap imports from silently recreating permanently deleted pipeline assets.';

alter table public.cardforge_pipeline_asset_tombstones enable row level security;
revoke all on table public.cardforge_pipeline_asset_tombstones from public, anon, authenticated;
grant select, insert, update, delete on table public.cardforge_pipeline_asset_tombstones to service_role;

create or replace function public.cardforge_prevent_deleted_pipeline_asset_recreation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.cardforge_pipeline_asset_tombstones as tombstone
    where tombstone.asset_id = new.asset_id
  ) then
    raise exception 'pipeline_asset_deleted_by_owner';
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_prevent_deleted_pipeline_asset_recreation
  on public.cardforge_asset_registry;
create trigger cardforge_prevent_deleted_pipeline_asset_recreation
before insert or update of asset_id on public.cardforge_asset_registry
for each row execute function public.cardforge_prevent_deleted_pipeline_asset_recreation();

create or replace function public.cardforge_prevent_deleted_pipeline_submission_recreation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lineage_asset_id text;
begin
  lineage_asset_id := coalesce(new.target_registry_asset_id, new.registry_asset_id);
  if lineage_asset_id is not null and exists (
    select 1
    from public.cardforge_pipeline_asset_tombstones as tombstone
    where tombstone.asset_id = lineage_asset_id
  ) then
    raise exception 'pipeline_asset_deleted_by_owner';
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_prevent_deleted_pipeline_submission_recreation
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_prevent_deleted_pipeline_submission_recreation
before insert or update of target_registry_asset_id, registry_asset_id
on public.cardforge_developer_asset_submissions
for each row execute function public.cardforge_prevent_deleted_pipeline_submission_recreation();

-- Existing owner-published and owner-closed work predates automatic operation. Pin
-- those decisions so the rollout cannot unexpectedly remove live assets or reopen
-- rejected work. The owner can clear either override from the console afterward.
update public.cardforge_developer_asset_submissions
set
  automated_status = case
    when status = 'published' then 'published'
    when status = 'archived' then 'archived'
    when status = 'publish_candidate' then 'publish_candidate'
    else 'voting'
  end,
  owner_status_override = case
    when status in ('published', 'archived', 'rejected') then status
    else null
  end,
  automated_access_tier = case
    when status = 'published' and calculated_access_tier = 'paid' then 'paid'
    when status = 'published' then 'free'
    when status in ('archived', 'rejected') then 'hidden'
    else 'developer'
  end,
  owner_access_tier_override = case
    when status = 'published' and calculated_access_tier = 'paid' then 'paid'
    when status = 'published' then 'free'
    else owner_access_tier_override
  end,
  calculated_access_tier = case
    when status = 'published' and calculated_access_tier = 'paid' then 'paid'
    when status = 'published' then 'free'
    when status in ('archived', 'rejected') then 'hidden'
    else 'developer'
  end,
  published_at = case
    when status = 'published' then coalesce(published_at, updated_at, submitted_at)
    else published_at
  end;

update public.cardforge_asset_registry
set access_tier = 'free'
where status = 'published'
  and access_tier = 'developer';

-- Remove contributor identifiers accidentally copied into public registry metadata.
update public.cardforge_asset_registry
set metadata = metadata - 'developerEmail' - 'developerId' - 'revisionAuthor'
where metadata ? 'developerEmail'
   or metadata ? 'developerId'
   or metadata ? 'revisionAuthor';

-- Keep the previous bundle truthful during migration-first rollout.
update public.cardforge_developer_program_settings
set owner_final_review_required = false
where id = 'default';

create or replace function public.cardforge_apply_pipeline_owner_edit_override()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.decision_reason = 'pipeline_owner_edit' then
    new.automated_status := 'published';
    new.owner_status_override := 'published';
    new.automated_access_tier := 'free';
    new.owner_access_tier_override := 'free';
    new.calculated_access_tier := 'free';
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_pipeline_owner_edit_override
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_pipeline_owner_edit_override
  before insert or update on public.cardforge_developer_asset_submissions
  for each row
  execute function public.cardforge_apply_pipeline_owner_edit_override();

revoke execute on function public.cardforge_apply_pipeline_owner_edit_override()
  from public, anon, authenticated;
grant execute on function public.cardforge_apply_pipeline_owner_edit_override()
  to service_role;

create or replace function public.cardforge_sync_developer_asset_registry(
  p_submission_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  next_registry_asset_id text;
  registry_asset_type text;
  registry_library_source text;
  next_registry_metadata jsonb;
  current_revision integer := 0;
  current_revision_id text;
  current_active_submission_id uuid;
begin
  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  next_registry_asset_id := coalesce(
    submission.target_registry_asset_id,
    submission.registry_asset_id,
    'developer-' || submission.asset_type || '-' || submission.id::text
  );
  registry_asset_type := case submission.asset_type
    when 'templates' then 'template'
    when 'elementPresets' then 'elementPreset'
    when 'textures' then 'texture'
    when 'dividers' then 'divider'
    when 'icons' then 'icon'
    when 'imageAssets' then 'image'
    when 'fonts' then 'font'
    else 'part'
  end;

  select
    registry.developer_submission_id,
    case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
      then (registry.metadata ->> 'revisionNumber')::integer else 0 end,
    registry.metadata ->> 'revisionId'
  into current_active_submission_id, current_revision, current_revision_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = next_registry_asset_id;

  current_revision := coalesce(current_revision, 0);
  if current_active_submission_id is not null
    and current_active_submission_id <> submission.id
    and (
      submission.source_payload is null
      or submission.revision_number is null
      or submission.revision_number <= current_revision
    )
  then
    update public.cardforge_developer_asset_submissions
    set
      status = 'archived',
      calculated_access_tier = 'hidden',
      decision_reason = 'superseded_revision',
      tier_decision_reason = 'superseded_revision'
    where id = submission.id;
    return next_registry_asset_id;
  end if;

  if current_active_submission_id is not null
    and current_active_submission_id <> submission.id
    and submission.source_payload is not null
    and submission.revision_number is not null
    and submission.revision_number > current_revision
    and submission.status <> 'published'
  then
    return next_registry_asset_id;
  end if;

  if submission.status = 'published' and nullif(submission.source_url, '') is null then
    raise exception 'developer_asset_source_required';
  end if;

  if submission.status = 'published' then
    next_registry_metadata := case submission.asset_type
      when 'textures' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'repeat', 'seamless', true,
        'allowedTargets', pg_catalog.jsonb_build_array('text', 'shape', 'template'),
        'defaultBlendMode', 'multiply', 'defaultOpacity', 42, 'defaultScale', 160
      )
      when 'dividers' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'stretch', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('divider'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100
      )
      when 'icons' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('icon'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'defaultWidth', 64, 'defaultHeight', 64
      )
      when 'imageAssets' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('image', 'imageFrame', 'template'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'defaultWidth', 300, 'defaultHeight', 180
      )
      when 'parts' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('imageFrame', 'shape', 'template'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'partRole', 'ornament', 'defaultWidth', 220, 'defaultHeight', 120
      )
      when 'fonts' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'category', 'Utility', 'fallback', 'serif', 'fontDisplay', 'swap'
      )
      else pg_catalog.jsonb_build_object('sourceMimeType', submission.source_mime_type)
    end;

    registry_library_source := case when submission.source_payload is not null then 'official' else 'developer' end;
    if submission.source_payload is not null then
      if submission.asset_type <> 'templates'
        or submission.base_revision_number is null
        or submission.revision_number is null
      then
        raise exception 'invalid_template_revision';
      end if;

      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(next_registry_asset_id, 0));
      select
        case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
          then (registry.metadata ->> 'revisionNumber')::integer else 0 end,
        registry.metadata ->> 'revisionId'
      into current_revision, current_revision_id
      from public.cardforge_asset_registry as registry
      where registry.asset_id = next_registry_asset_id;

      current_revision := coalesce(current_revision, 0);
      if not (
        current_revision = submission.base_revision_number
        or (
          current_revision = submission.revision_number
          and current_revision_id = submission.id::text
        )
      ) then
        raise exception 'template_revision_conflict';
      end if;

      next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_build_object(
        'template', submission.source_payload,
        'revisionNumber', submission.revision_number,
        'revisionId', submission.id,
        'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now())
      );
    end if;

    insert into public.cardforge_asset_registry (
      asset_id, name, asset_type, url, preview_url, status, access_tier,
      library_source, developer_submission_id, storage_bucket, storage_path,
      file_size_bytes, metadata
    )
    values (
      next_registry_asset_id, submission.name, registry_asset_type,
      submission.source_url, coalesce(nullif(submission.preview_url, ''), submission.source_url),
      'published', submission.calculated_access_tier, registry_library_source,
      submission.id, submission.source_storage_bucket, submission.source_storage_path,
      submission.source_file_size_bytes, next_registry_metadata
    )
    on conflict (asset_id) do update
    set
      name = excluded.name,
      asset_type = excluded.asset_type,
      url = excluded.url,
      preview_url = excluded.preview_url,
      status = excluded.status,
      access_tier = excluded.access_tier,
      library_source = excluded.library_source,
      developer_submission_id = excluded.developer_submission_id,
      storage_bucket = excluded.storage_bucket,
      storage_path = excluded.storage_path,
      file_size_bytes = excluded.file_size_bytes,
      metadata = (public.cardforge_asset_registry.metadata - 'developerEmail' - 'developerId' - 'revisionAuthor') || excluded.metadata;

    update public.cardforge_developer_asset_submissions
    set registry_asset_id = next_registry_asset_id
    where id = submission.id;
  elsif submission.registry_asset_id is not null then
    update public.cardforge_asset_registry
    set
      status = submission.status,
      access_tier = case
        when submission.status in ('archived', 'rejected') then 'hidden'
        else 'developer'
      end,
      metadata = metadata - 'developerEmail' - 'developerId' - 'revisionAuthor'
    where asset_id = submission.registry_asset_id;
  end if;

  return next_registry_asset_id;
end;
$$;

revoke execute on function public.cardforge_sync_developer_asset_registry(uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_sync_developer_asset_registry(uuid)
  to service_role;

create or replace function public.cardforge_rebalance_developer_asset_pipeline(
  p_owner_developer_id text default null
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-developer-pipeline', 0));

  if nullif(pg_catalog.btrim(p_owner_developer_id), '') is not null then
    update public.cardforge_developer_asset_votes as vote
    set vote_weight = settings.owner_vote_weight
    from public.cardforge_developer_program_settings as settings
    where settings.id = 'default'
      and vote.developer_id = p_owner_developer_id;
  end if;

  with totals as (
    select
      submission.id,
      coalesce(sum(vote.vote_weight) filter (where vote.vote_value = 'positive'), 0)::integer as positive_votes,
      coalesce(sum(vote.vote_weight) filter (where vote.vote_value = 'negative'), 0)::integer as negative_votes
    from public.cardforge_developer_asset_submissions as submission
    left join public.cardforge_developer_asset_votes as vote on vote.submission_id = submission.id
    group by submission.id
  )
  update public.cardforge_developer_asset_submissions as submission
  set
    positive_votes = totals.positive_votes,
    negative_votes = totals.negative_votes
  from totals
  where totals.id = submission.id
    and (
      submission.positive_votes <> totals.positive_votes
      or submission.negative_votes <> totals.negative_votes
    );

  with settings as (
    select *
    from public.cardforge_developer_program_settings
    where id = 'default'
  ), scored as (
    select
      submission.id,
      submission.asset_type,
      submission.submitted_at,
      submission.positive_votes,
      submission.negative_votes,
      submission.positive_votes + submission.negative_votes as total_votes,
      case when submission.positive_votes + submission.negative_votes = 0 then 0
        else pg_catalog.round(
          (submission.positive_votes::numeric / (submission.positive_votes + submission.negative_votes)::numeric) * 100
        )::integer end as quality_score,
      settings.minimum_votes_for_grading as minimum_votes,
      settings.free_asset_minimum_positive_vote_percent as free_threshold,
      settings.paid_asset_minimum_positive_vote_percent as paid_threshold,
      coalesce((settings.tier_caps_by_type -> submission.asset_type ->> 'free')::integer, 0) as free_cap,
      coalesce((settings.tier_caps_by_type -> submission.asset_type ->> 'paid')::integer, 0) as paid_cap
    from public.cardforge_developer_asset_submissions as submission
    cross join settings
    where submission.purge_state is null
      and not exists (
        select 1
        from public.cardforge_asset_registry as registry
        where registry.asset_id = coalesce(
          submission.target_registry_asset_id,
          submission.registry_asset_id
        )
          and registry.developer_submission_id is distinct from submission.id
          and (
            submission.source_payload is null
            or submission.revision_number is null
            or submission.revision_number <= case
              when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
                then (registry.metadata ->> 'revisionNumber')::integer
              else 0
            end
          )
      )
  ), paid_ranked as (
    select
      scored.*,
      sum(case when total_votes >= minimum_votes and quality_score >= paid_threshold then 1 else 0 end)
        over (partition by asset_type order by quality_score desc, total_votes desc, submitted_at asc, id asc) as paid_rank
    from scored
  ), paid_assigned as (
    select
      paid_ranked.*,
      (total_votes >= minimum_votes and quality_score >= paid_threshold and paid_rank <= paid_cap) as is_paid
    from paid_ranked
  ), free_ranked as (
    select
      paid_assigned.*,
      sum(case
        when total_votes >= minimum_votes and quality_score >= free_threshold and not is_paid then 1
        else 0
      end) over (partition by asset_type order by quality_score desc, total_votes desc, submitted_at asc, id asc) as free_rank
    from paid_assigned
  ), decisions as (
    select
      id,
      quality_score,
      case
        when total_votes < minimum_votes then 'voting'
        when quality_score < free_threshold then 'archived'
        when is_paid or free_rank <= free_cap then 'published'
        else 'publish_candidate'
      end as automated_status,
      case
        when total_votes < minimum_votes then 'developer'
        when quality_score < free_threshold then 'hidden'
        when is_paid then 'paid'
        when free_rank <= free_cap then 'free'
        else 'developer'
      end as automated_access_tier,
      case
        when total_votes < minimum_votes then 'needs_more_votes'
        when quality_score < free_threshold then 'below_free_threshold'
        when is_paid then 'paid_candidate'
        when free_rank <= free_cap then 'free_candidate'
        else 'tier_cap_full'
      end as automatic_reason
    from free_ranked
  ), effective as (
    select
      submission.id,
      decisions.quality_score,
      decisions.automated_status,
      decisions.automated_access_tier,
      decisions.automatic_reason,
      coalesce(submission.owner_status_override, decisions.automated_status) as effective_status,
      case
        when coalesce(submission.owner_status_override, decisions.automated_status) = 'published' then
          coalesce(
            submission.owner_access_tier_override,
            case when decisions.automated_access_tier in ('free', 'paid') then decisions.automated_access_tier else null end,
            'free'
          )
        when coalesce(submission.owner_status_override, decisions.automated_status) in ('archived', 'rejected') then 'hidden'
        else 'developer'
      end as effective_access_tier
    from public.cardforge_developer_asset_submissions as submission
    join decisions on decisions.id = submission.id
  )
  update public.cardforge_developer_asset_submissions as submission
  set
    automated_status = effective.automated_status,
    automated_access_tier = effective.automated_access_tier,
    status = effective.effective_status,
    calculated_access_tier = effective.effective_access_tier,
    quality_score = effective.quality_score,
    decision_reason = case
      when submission.owner_status_override is not null then 'owner_status_override'
      else effective.automatic_reason
    end,
    tier_decision_reason = case
      when effective.effective_status <> 'published' and effective.effective_access_tier = 'hidden' then 'hidden_status'
      when submission.owner_access_tier_override is not null then 'owner_forced_' || submission.owner_access_tier_override
      else effective.automatic_reason
    end,
    published_at = case
      when effective.effective_status = 'published' and submission.status <> 'published' then pg_catalog.now()
      else submission.published_at
    end
  from effective
  where effective.id = submission.id
    and (
      submission.automated_status is distinct from effective.automated_status
      or submission.automated_access_tier is distinct from effective.automated_access_tier
      or submission.status is distinct from effective.effective_status
      or submission.calculated_access_tier is distinct from effective.effective_access_tier
      or submission.quality_score is distinct from effective.quality_score
      or submission.decision_reason is distinct from case
        when submission.owner_status_override is not null then 'owner_status_override'
        else effective.automatic_reason
      end
      or submission.tier_decision_reason is distinct from case
        when effective.effective_status <> 'published' and effective.effective_access_tier = 'hidden' then 'hidden_status'
        when submission.owner_access_tier_override is not null then 'owner_forced_' || submission.owner_access_tier_override
        else effective.automatic_reason
      end
    );

  get diagnostics changed_count = row_count;

  for submission_id in
    select submission.id
    from public.cardforge_developer_asset_submissions as submission
    where submission.purge_state is null
    order by
      case when submission.status = 'published' then 0 else 1 end,
      submission.revision_number desc nulls last,
      submission.quality_score desc nulls last,
      submission.positive_votes desc,
      submission.submitted_at asc,
      submission.id asc
  loop
    perform public.cardforge_sync_developer_asset_registry(submission_id);
  end loop;

  return changed_count;
end;
$$;

revoke execute on function public.cardforge_rebalance_developer_asset_pipeline(text)
  from public, anon, authenticated;
grant execute on function public.cardforge_rebalance_developer_asset_pipeline(text)
  to service_role;

create or replace function public.cardforge_cast_developer_asset_vote(
  p_submission_id uuid,
  p_developer_id text,
  p_vote_value text,
  p_owner_developer_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  vote_weight integer := 1;
begin
  if nullif(pg_catalog.btrim(p_developer_id), '') is null
    or p_vote_value not in ('positive', 'negative')
  then
    raise exception 'invalid_developer_asset_vote';
  end if;

  if not exists (
    select 1
    from public.cardforge_developer_asset_submissions
    where id = p_submission_id
      and purge_state is null
  ) then
    raise exception 'developer_asset_not_found';
  end if;

  if nullif(pg_catalog.btrim(p_owner_developer_id), '') is not null
    and p_developer_id = p_owner_developer_id
  then
    select owner_vote_weight into vote_weight
    from public.cardforge_developer_program_settings
    where id = 'default';
    vote_weight := coalesce(vote_weight, 1);
  end if;

  insert into public.cardforge_developer_asset_votes (
    submission_id, developer_id, vote_value, vote_weight
  ) values (
    p_submission_id, p_developer_id, p_vote_value, vote_weight
  )
  on conflict (submission_id, developer_id) do update
  set vote_value = excluded.vote_value,
      vote_weight = excluded.vote_weight;

  return public.cardforge_rebalance_developer_asset_pipeline(p_owner_developer_id);
end;
$$;

revoke execute on function public.cardforge_cast_developer_asset_vote(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_cast_developer_asset_vote(uuid, text, text, text)
  to service_role;

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
    monthly_published_requirement = (p_settings ->> 'monthlyPublishedRequirement')::integer,
    minimum_votes_for_grading = (p_settings ->> 'minimumVotesForGrading')::integer,
    minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    free_asset_minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    paid_asset_minimum_positive_vote_percent = (p_settings ->> 'paidAssetMinimumPositiveVotePercent')::integer,
    minimum_votes_for_tier_assignment = (p_settings ->> 'minimumVotesForGrading')::integer,
    allow_contributor_self_voting = (p_settings ->> 'allowContributorSelfVoting')::boolean,
    owner_vote_weight = (p_settings ->> 'ownerVoteWeight')::integer,
    profit_share_pool_percent = (p_settings ->> 'profitSharePoolPercent')::integer,
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

revoke execute on function public.cardforge_update_developer_program_settings(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_update_developer_program_settings(jsonb, text)
  to service_role;

create or replace function public.cardforge_set_developer_asset_owner_override(
  p_submission_id uuid,
  p_update_status_override boolean,
  p_status_override text,
  p_update_tier_override boolean,
  p_tier_override text,
  p_owner_note text,
  p_owner_developer_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_update_status_override
    and p_status_override is not null
    and p_status_override not in ('voting', 'publish_candidate', 'published', 'archived', 'rejected')
  then
    raise exception 'invalid_owner_status_override';
  end if;
  if p_update_tier_override
    and p_tier_override is not null
    and p_tier_override not in ('hidden', 'free', 'paid')
  then
    raise exception 'invalid_owner_tier_override';
  end if;

  update public.cardforge_developer_asset_submissions
  set
    owner_status_override = case when p_update_status_override then p_status_override else owner_status_override end,
    owner_access_tier_override = case when p_update_tier_override then p_tier_override else owner_access_tier_override end,
    owner_note = coalesce(p_owner_note, '')
  where id = p_submission_id
    and purge_state is null;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  return public.cardforge_rebalance_developer_asset_pipeline(p_owner_developer_id);
end;
$$;

revoke execute on function public.cardforge_set_developer_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_developer_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  to service_role;

create or replace function public.cardforge_migrate_pipeline_registry_storage(
  p_asset_id text,
  p_expected_url text,
  p_url text,
  p_storage_bucket text,
  p_storage_path text,
  p_file_size_bytes bigint,
  p_source_mime_type text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_submission_id uuid;
begin
  if nullif(pg_catalog.btrim(p_asset_id), '') is null
    or p_expected_url !~ '^/card-assets/'
    or p_url !~ '^https?://'
    or nullif(pg_catalog.btrim(p_storage_bucket), '') is null
    or nullif(pg_catalog.btrim(p_storage_path), '') is null
    or p_file_size_bytes is null
    or p_file_size_bytes < 0
  then
    raise exception 'invalid_pipeline_storage_migration';
  end if;

  select registry.developer_submission_id
  into linked_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
    and registry.url = p_expected_url
  for update;

  if not found then
    raise exception 'pipeline_asset_not_found';
  end if;

  update public.cardforge_asset_registry
  set
    url = p_url,
    preview_url = p_url,
    storage_bucket = p_storage_bucket,
    storage_path = p_storage_path,
    file_size_bytes = p_file_size_bytes
  where asset_id = p_asset_id;

  if linked_submission_id is not null then
    update public.cardforge_developer_asset_submissions
    set
      source_url = p_url,
      preview_url = p_url,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type
    where id = linked_submission_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.cardforge_migrate_pipeline_registry_storage(text, text, text, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_migrate_pipeline_registry_storage(text, text, text, text, text, bigint, text)
  to service_role;

create or replace function public.cardforge_migrate_pipeline_registry_metadata_urls(
  p_asset_id text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(pg_catalog.btrim(p_asset_id), '') is null
    or p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
  then
    raise exception 'invalid_pipeline_metadata_migration';
  end if;

  update public.cardforge_asset_registry
  set metadata = p_metadata
  where asset_id = p_asset_id;

  if not found then
    raise exception 'pipeline_asset_not_found';
  end if;

  return true;
end;
$$;

revoke execute on function public.cardforge_migrate_pipeline_registry_metadata_urls(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.cardforge_migrate_pipeline_registry_metadata_urls(text, jsonb)
  to service_role;

create or replace function public.cardforge_prepare_developer_asset_purge(
  p_submission_id uuid,
  p_expected_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  lineage_asset_id text;
  storage_objects jsonb;
begin
  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  if nullif(pg_catalog.btrim(p_expected_name), '') is null
    or pg_catalog.btrim(p_expected_name) <> submission.name then
    raise exception 'developer_asset_purge_confirmation_mismatch';
  end if;

  lineage_asset_id := coalesce(submission.target_registry_asset_id, submission.registry_asset_id);

  if lineage_asset_id is not null then
    insert into public.cardforge_pipeline_asset_tombstones (
      asset_id,
      asset_name,
      deleted_submission_id,
      deleted_at
    ) values (
      lineage_asset_id,
      submission.name,
      submission.id,
      pg_catalog.now()
    )
    on conflict (asset_id) do update
    set
      asset_name = excluded.asset_name,
      deleted_submission_id = excluded.deleted_submission_id,
      deleted_at = excluded.deleted_at;

    update public.cardforge_asset_registry
    set status = 'archived', access_tier = 'hidden'
    where asset_id = lineage_asset_id;
  end if;

  if exists (
    select 1
    from public.cardforge_developer_asset_submissions as lineage
    where (
      lineage.id = submission.id
      or (
        lineage_asset_id is not null
        and (
          lineage.registry_asset_id = lineage_asset_id
          or lineage.target_registry_asset_id = lineage_asset_id
        )
      )
    )
      and ((lineage.source_storage_bucket is null) <> (lineage.source_storage_path is null))
  ) then
    raise exception 'developer_asset_storage_reference_incomplete';
  end if;

  select coalesce(pg_catalog.jsonb_agg(object_reference), '[]'::jsonb)
  into storage_objects
  from (
    select distinct pg_catalog.jsonb_build_object(
      'storageBucket', lineage.source_storage_bucket,
      'storagePath', lineage.source_storage_path
    ) as object_reference
    from public.cardforge_developer_asset_submissions as lineage
    where (
      lineage.id = submission.id
      or (
        lineage_asset_id is not null
        and (
          lineage.registry_asset_id = lineage_asset_id
          or lineage.target_registry_asset_id = lineage_asset_id
        )
      )
    )
      and lineage.source_storage_bucket is not null
      and lineage.source_storage_path is not null
  ) as objects;

  update public.cardforge_developer_asset_submissions
  set purge_state = 'pending'
  where id = submission.id
    or (
      lineage_asset_id is not null
      and (
        registry_asset_id = lineage_asset_id
        or target_registry_asset_id = lineage_asset_id
      )
    );

  return pg_catalog.jsonb_build_object(
    'registryAssetId', lineage_asset_id,
    'storageObjects', storage_objects
  );
end;
$$;

revoke execute on function public.cardforge_prepare_developer_asset_purge(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_prepare_developer_asset_purge(uuid, text)
  to service_role;

create or replace function public.cardforge_finalize_developer_asset_purge(
  p_submission_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  lineage_asset_id text;
begin
  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
    and purge_state = 'pending'
  for update;

  if not found then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  lineage_asset_id := coalesce(submission.target_registry_asset_id, submission.registry_asset_id);

  delete from public.cardforge_developer_asset_submissions
  where purge_state = 'pending'
    and (
      id = p_submission_id
      or (
        lineage_asset_id is not null
        and (
          registry_asset_id = lineage_asset_id
          or target_registry_asset_id = lineage_asset_id
        )
      )
    );

  if not found then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  if lineage_asset_id is not null then
    delete from public.cardforge_asset_registry
    where asset_id = lineage_asset_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.cardforge_finalize_developer_asset_purge(uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_finalize_developer_asset_purge(uuid)
  to service_role;

create or replace function public.cardforge_archive_pipeline_registry_asset(p_asset_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_submission_id uuid;
begin
  select registry.developer_submission_id
  into linked_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if not found or linked_submission_id is null then
    raise exception 'pipeline_asset_not_found';
  end if;

  perform public.cardforge_set_developer_asset_owner_override(
    linked_submission_id,
    true,
    'archived',
    false,
    null,
    'Retired from the shared library by an owner.',
    null
  );

  return true;
end;
$$;

revoke execute on function public.cardforge_archive_pipeline_registry_asset(text)
  from public, anon, authenticated;
grant execute on function public.cardforge_archive_pipeline_registry_asset(text)
  to service_role;

comment on function public.cardforge_rebalance_developer_asset_pipeline(text)
  is 'Atomically recalculates vote totals, automatic status/tier, persistent owner overrides, and registry visibility.';
comment on function public.cardforge_cast_developer_asset_vote(uuid, text, text, text)
  is 'Atomically casts one vote and applies the complete automatic developer asset pipeline.';
comment on function public.cardforge_update_developer_program_settings(jsonb, text)
  is 'Atomically saves normalized automatic-pipeline rules and rebalances all assets.';
comment on function public.cardforge_set_developer_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  is 'Pins or clears owner status/tier overrides, then reapplies automatic state underneath.';

commit;
