begin;

set local lock_timeout = '5s';

alter table public.cardforge_developer_asset_submissions
  add column if not exists specialty_tags text[] not null default '{}'::text[],
  add column if not exists use_case_tags text[] not null default '{}'::text[],
  add column if not exists source_notes text not null default '';

alter table public.cardforge_asset_registry
  add column if not exists specialty_tags text[] not null default '{}'::text[],
  add column if not exists use_case_tags text[] not null default '{}'::text[];

create or replace function public.cardforge_content_tags_are_valid(p_tags text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    pg_catalog.cardinality(coalesce(p_tags, '{}'::text[])) <= 12
    and not exists (
      select 1
      from pg_catalog.unnest(coalesce(p_tags, '{}'::text[])) as tag(value)
      where tag.value !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        or pg_catalog.length(tag.value) > 40
    )
    and pg_catalog.cardinality(coalesce(p_tags, '{}'::text[])) = (
      select count(distinct tag.value)::integer
      from pg_catalog.unnest(coalesce(p_tags, '{}'::text[])) as tag(value)
    );
$$;

alter table public.cardforge_developer_asset_submissions
  drop constraint if exists cardforge_developer_asset_specialty_tags_check,
  drop constraint if exists cardforge_developer_asset_use_case_tags_check;

alter table public.cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_specialty_tags_check
    check (public.cardforge_content_tags_are_valid(specialty_tags)),
  add constraint cardforge_developer_asset_use_case_tags_check
    check (public.cardforge_content_tags_are_valid(use_case_tags));

alter table public.cardforge_asset_registry
  drop constraint if exists cardforge_asset_registry_specialty_tags_check,
  drop constraint if exists cardforge_asset_registry_use_case_tags_check;

alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_specialty_tags_check
    check (public.cardforge_content_tags_are_valid(specialty_tags)),
  add constraint cardforge_asset_registry_use_case_tags_check
    check (public.cardforge_content_tags_are_valid(use_case_tags));

create index if not exists cardforge_developer_asset_specialty_tags_idx
  on public.cardforge_developer_asset_submissions using gin (specialty_tags);
create index if not exists cardforge_developer_asset_use_case_tags_idx
  on public.cardforge_developer_asset_submissions using gin (use_case_tags);
create index if not exists cardforge_asset_registry_specialty_tags_idx
  on public.cardforge_asset_registry using gin (specialty_tags);
create index if not exists cardforge_asset_registry_use_case_tags_idx
  on public.cardforge_asset_registry using gin (use_case_tags);

create or replace function public.cardforge_apply_submission_studio_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.asset_type = 'parts' then
    if new.name ilike '%corner%' or new.name ilike '%gem%' or new.name ilike '%ornament%' then
      new.asset_type := 'icons';
      new.requested_studio_destination := 'element.icon';
    else
      new.asset_type := 'dividers';
      new.requested_studio_destination := 'element.divider';
    end if;
  end if;

  -- A Pipeline draft may remain unclassified. Only carry an exact authored
  -- Template usage from Studio; never guess a placement for a new draft.
  if new.requested_studio_destination is null and new.status = 'draft' then
    if new.asset_type = 'templates' and new.source_payload ->> 'templateUsage' = 'back-preset' then
      new.requested_studio_destination := 'template.back';
    end if;
    return new;
  end if;

  if new.requested_studio_destination is null then
    new.requested_studio_destination := case new.asset_type
      when 'templates' then case
        when new.source_payload ->> 'templateUsage' = 'back-preset' then 'template.back'
        else 'template.front'
      end
      when 'elementPresets' then 'style.material'
      when 'textures' then 'appearance.texture'
      when 'dividers' then 'element.divider'
      when 'icons' then 'element.icon'
      when 'imageAssets' then 'image.picture'
      when 'fonts' then 'typography.font'
      else null
    end;
  end if;
  return new;
end;
$$;

create or replace function public.cardforge_create_template_pipeline_draft(
  p_asset_id text,
  p_name text,
  p_developer_id text,
  p_developer_email text,
  p_template_payload jsonb,
  p_submission_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_submission public.cardforge_developer_asset_submissions%rowtype;
  next_submission_id uuid;
  authored_destination text;
begin
  if nullif(pg_catalog.btrim(p_asset_id), '') is null
    or nullif(pg_catalog.btrim(p_name), '') is null
    or nullif(pg_catalog.btrim(p_developer_id), '') is null
    or nullif(pg_catalog.btrim(p_submission_key), '') is null
    or pg_catalog.length(p_submission_key) > 160
    or p_template_payload is null
    or pg_catalog.jsonb_typeof(p_template_payload) <> 'object'
  then
    raise exception 'invalid_template_pipeline_draft';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select submission.*
  into existing_submission
  from public.cardforge_developer_asset_submissions as submission
  where submission.developer_id = p_developer_id
    and submission.target_registry_asset_id = p_asset_id
    and submission.submission_key = p_submission_key
  limit 1;

  if found then
    return existing_submission.id;
  end if;

  if exists (
    select 1 from public.cardforge_asset_registry as registry where registry.asset_id = p_asset_id
  ) then
    raise exception 'template_asset_exists';
  end if;

  authored_destination := case
    when p_template_payload ->> 'templateUsage' = 'back-preset' then 'template.back'
    else null
  end;

  select submission.*
  into existing_submission
  from public.cardforge_developer_asset_submissions as submission
  where submission.developer_id = p_developer_id
    and submission.target_registry_asset_id = p_asset_id
    and submission.status = 'draft'
  order by submission.updated_at desc
  limit 1
  for update;

  if found then
    update public.cardforge_developer_asset_submissions
    set
      developer_email = nullif(pg_catalog.btrim(p_developer_email), ''),
      name = p_name,
      preview_url = '/api/templates#' || p_asset_id,
      source_url = '/api/templates#' || p_asset_id,
      source_file_size_bytes = pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text, 'UTF8')),
      source_payload = p_template_payload,
      submission_key = p_submission_key,
      requested_studio_destination = coalesce(requested_studio_destination, authored_destination),
      decision_reason = 'template_pipeline_draft'
    where id = existing_submission.id;
    return existing_submission.id;
  end if;

  insert into public.cardforge_developer_asset_submissions (
    developer_id,
    developer_email,
    asset_type,
    name,
    description,
    preview_url,
    source_url,
    source_file_size_bytes,
    source_mime_type,
    status,
    automated_status,
    calculated_access_tier,
    automated_access_tier,
    decision_reason,
    source_payload,
    target_registry_asset_id,
    base_revision_number,
    revision_number,
    submission_key,
    requested_studio_destination,
    specialty_tags,
    use_case_tags,
    source_notes
  ) values (
    p_developer_id,
    nullif(pg_catalog.btrim(p_developer_email), ''),
    'templates',
    p_name,
    '',
    '/api/templates#' || p_asset_id,
    '/api/templates#' || p_asset_id,
    pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text, 'UTF8')),
    'application/json',
    'draft',
    'voting',
    'developer',
    'developer',
    'template_pipeline_draft',
    p_template_payload,
    p_asset_id,
    0,
    1,
    p_submission_key,
    authored_destination,
    '{}'::text[],
    '{}'::text[],
    ''
  )
  returning id into next_submission_id;

  return next_submission_id;
end;
$$;

create or replace function public.cardforge_submit_template_pipeline_draft(
  p_submission_id uuid,
  p_developer_id text,
  p_name text,
  p_description text,
  p_preview_url text,
  p_source_notes text,
  p_specialty_tags text[],
  p_use_case_tags text[],
  p_requested_studio_destination text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
begin
  select * into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
  for update;

  if not found then raise exception 'developer_asset_not_found'; end if;
  if submission.developer_id <> p_developer_id then raise exception 'template_draft_owner_required'; end if;
  if submission.status <> 'draft' or submission.asset_type <> 'templates' or submission.source_payload is null then
    raise exception 'template_draft_not_editable';
  end if;
  if nullif(pg_catalog.btrim(p_name), '') is null
    or nullif(pg_catalog.btrim(p_description), '') is null
    or nullif(pg_catalog.btrim(p_source_notes), '') is null
    or pg_catalog.cardinality(coalesce(p_specialty_tags, '{}'::text[])) = 0
    or pg_catalog.cardinality(coalesce(p_use_case_tags, '{}'::text[])) = 0
    or not public.cardforge_content_tags_are_valid(p_specialty_tags)
    or not public.cardforge_content_tags_are_valid(p_use_case_tags)
    or p_requested_studio_destination not in ('template.front', 'template.back')
  then
    raise exception 'template_draft_details_required';
  end if;
  if exists (
    select 1 from public.cardforge_asset_registry as registry
    where registry.asset_id = submission.target_registry_asset_id
  ) then
    raise exception 'template_asset_exists';
  end if;

  update public.cardforge_developer_asset_submissions
  set
    name = pg_catalog.btrim(p_name),
    description = pg_catalog.btrim(p_description),
    preview_url = coalesce(nullif(pg_catalog.btrim(p_preview_url), ''), preview_url),
    source_notes = pg_catalog.btrim(p_source_notes),
    specialty_tags = p_specialty_tags,
    use_case_tags = p_use_case_tags,
    requested_studio_destination = p_requested_studio_destination,
    status = 'submitted',
    automated_status = 'voting',
    decision_reason = 'template_submitted_for_owner_review',
    submitted_at = pg_catalog.now()
  where id = p_submission_id;

  return p_submission_id;
end;
$$;

create or replace function public.cardforge_sync_asset_registry_taxonomy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.developer_submission_id is not null then
    select submission.specialty_tags, submission.use_case_tags
    into new.specialty_tags, new.use_case_tags
    from public.cardforge_developer_asset_submissions as submission
    where submission.id = new.developer_submission_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_asset_registry_taxonomy
  on public.cardforge_asset_registry;
create trigger cardforge_asset_registry_taxonomy
  before insert or update of developer_submission_id
  on public.cardforge_asset_registry
  for each row execute function public.cardforge_sync_asset_registry_taxonomy();

create or replace function public.cardforge_sync_submission_taxonomy_to_registry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.cardforge_asset_registry
  set specialty_tags = new.specialty_tags, use_case_tags = new.use_case_tags
  where developer_submission_id = new.id;
  return new;
end;
$$;

drop trigger if exists cardforge_submission_taxonomy_to_registry
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_submission_taxonomy_to_registry
  after update of specialty_tags, use_case_tags
  on public.cardforge_developer_asset_submissions
  for each row execute function public.cardforge_sync_submission_taxonomy_to_registry();

create or replace function public.cardforge_list_developer_asset_submission_ids(
  p_current_user_id text,
  p_scope text default 'all',
  p_query text default '',
  p_asset_type text default null,
  p_status text default null,
  p_tier text default null,
  p_vote_filter text default 'all',
  p_allow_self_voting boolean default false,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (submission_id uuid, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select submission.id, submission.submitted_at
    from public.cardforge_developer_asset_submissions as submission
    left join public.cardforge_developer_asset_votes as current_vote
      on current_vote.submission_id = submission.id
      and current_vote.developer_id = p_current_user_id
    where coalesce(p_scope, 'all') in ('all', 'own', 'review')
      and (
        coalesce(p_scope, 'all') = 'all'
        or (p_scope = 'own' and submission.developer_id = p_current_user_id)
        or (
          p_scope = 'review'
          and submission.status not in ('draft', 'rejected')
          and (coalesce(p_allow_self_voting, false) or submission.developer_id <> p_current_user_id)
        )
      )
      and (p_asset_type is null or submission.asset_type = p_asset_type)
      and (p_status is null or submission.status = p_status)
      and (p_tier is null or submission.calculated_access_tier = p_tier)
      and (
        coalesce(nullif(pg_catalog.btrim(p_query), ''), '') = ''
        or pg_catalog.lower(pg_catalog.concat_ws(
          ' ', submission.name, submission.description, submission.developer_email,
          submission.registry_asset_id, submission.target_registry_asset_id
        )) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
      )
      and (
        coalesce(p_vote_filter, 'all') = 'all'
        or (p_vote_filter = 'unvoted' and current_vote.submission_id is null)
        or (p_vote_filter = 'upvoted' and current_vote.vote_value = 'positive')
        or (p_vote_filter = 'downvoted' and current_vote.vote_value = 'negative')
      )
  ), numbered as (
    select filtered.id, filtered.submitted_at, count(*) over ()::bigint as total_count
    from filtered
  )
  select numbered.id, numbered.total_count
  from numbered
  order by numbered.submitted_at desc, numbered.id desc
  offset (greatest(coalesce(p_page, 1), 1) - 1)
    * least(greatest(coalesce(p_page_size, 12), 1), 50)
  limit least(greatest(coalesce(p_page_size, 12), 1), 50);
$$;

create or replace function public.cardforge_get_developer_asset_program_summary(
  p_current_user_id text,
  p_allow_self_voting boolean
)
returns table (
  total_submission_count bigint,
  total_voteable_count bigint,
  managed_file_count bigint,
  managed_storage_bytes bigint,
  status_counts jsonb,
  review_status_counts jsonb,
  asset_type_counts jsonb,
  monthly_counts_by_developer jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with month_window as (
    select
      (pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') at time zone 'UTC') as starts_at,
      ((pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') + interval '1 month') at time zone 'UTC') as ends_at
  ), status_summary as (
    select coalesce(pg_catalog.jsonb_object_agg(grouped.status, grouped.row_count), '{}'::jsonb) as value
    from (
      select submission.status, count(*)::bigint as row_count
      from public.cardforge_developer_asset_submissions as submission
      group by submission.status
    ) as grouped
  ), type_summary as (
    select coalesce(pg_catalog.jsonb_object_agg(grouped.asset_type, grouped.metrics), '{}'::jsonb) as value
    from (
      select
        submission.asset_type,
        pg_catalog.jsonb_build_object(
          'total', count(*)::bigint,
          'published', count(*) filter (where submission.status = 'published')::bigint,
          'starter', count(*) filter (where submission.status = 'published' and submission.calculated_access_tier = 'free')::bigint,
          'creatorPass', count(*) filter (where submission.status = 'published' and submission.calculated_access_tier = 'paid')::bigint,
          'candidate', count(*) filter (where submission.status in ('voting', 'publish_candidate'))::bigint,
          'archived', count(*) filter (where submission.status = 'archived')::bigint
        ) as metrics
      from public.cardforge_developer_asset_submissions as submission
      group by submission.asset_type
    ) as grouped
  ), review_status_summary as (
    select coalesce(pg_catalog.jsonb_object_agg(grouped.status, grouped.row_count), '{}'::jsonb) as value
    from (
      select submission.status, count(*)::bigint as row_count
      from public.cardforge_developer_asset_submissions as submission
      where submission.status not in ('draft', 'rejected')
        and (coalesce(p_allow_self_voting, false) or submission.developer_id <> p_current_user_id)
      group by submission.status
    ) as grouped
  ), monthly_summary as (
    select coalesce(pg_catalog.jsonb_object_agg(grouped.developer_id, grouped.metrics), '{}'::jsonb) as value
    from (
      select
        submission.developer_id,
        pg_catalog.jsonb_build_object(
          'submitted', count(*) filter (
            where submission.status <> 'draft'
              and submission.submitted_at >= month_window.starts_at
              and submission.submitted_at < month_window.ends_at
          )::bigint,
          'published', count(*) filter (
            where submission.published_at >= month_window.starts_at
              and submission.published_at < month_window.ends_at
          )::bigint,
          'archived', count(*) filter (
            where submission.status = 'archived'
              and submission.submitted_at >= month_window.starts_at
              and submission.submitted_at < month_window.ends_at
          )::bigint,
          'rejected', count(*) filter (
            where submission.status = 'rejected'
              and submission.submitted_at >= month_window.starts_at
              and submission.submitted_at < month_window.ends_at
          )::bigint,
          'total', count(*)::bigint
        ) as metrics
      from public.cardforge_developer_asset_submissions as submission
      cross join month_window
      group by submission.developer_id
    ) as grouped
  )
  select
    count(submission.id)::bigint,
    count(submission.id) filter (
      where submission.status not in ('draft', 'rejected')
        and (coalesce(p_allow_self_voting, false) or submission.developer_id <> p_current_user_id)
    )::bigint,
    count(submission.id) filter (
      where submission.source_storage_bucket is not null and submission.source_storage_path is not null
    )::bigint,
    coalesce(sum(submission.source_file_size_bytes) filter (
      where submission.source_storage_bucket is not null and submission.source_storage_path is not null
    ), 0)::bigint,
    (select value from status_summary),
    (select value from review_status_summary),
    (select value from type_summary),
    (select value from monthly_summary)
  from public.cardforge_developer_asset_submissions as submission;
$$;

revoke all on function public.cardforge_content_tags_are_valid(text[]) from public, anon, authenticated;
revoke all on function public.cardforge_create_template_pipeline_draft(text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.cardforge_submit_template_pipeline_draft(uuid, text, text, text, text, text, text[], text[], text) from public, anon, authenticated;
revoke all on function public.cardforge_sync_asset_registry_taxonomy() from public, anon, authenticated;
revoke all on function public.cardforge_sync_submission_taxonomy_to_registry() from public, anon, authenticated;
revoke all on function public.cardforge_list_developer_asset_submission_ids(text, text, text, text, text, text, text, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.cardforge_get_developer_asset_program_summary(text, boolean) from public, anon, authenticated;

grant execute on function public.cardforge_content_tags_are_valid(text[]) to service_role;
grant execute on function public.cardforge_create_template_pipeline_draft(text, text, text, text, jsonb, text) to service_role;
grant execute on function public.cardforge_submit_template_pipeline_draft(uuid, text, text, text, text, text, text[], text[], text) to service_role;
grant execute on function public.cardforge_sync_asset_registry_taxonomy() to service_role;
grant execute on function public.cardforge_sync_submission_taxonomy_to_registry() to service_role;
grant execute on function public.cardforge_list_developer_asset_submission_ids(text, text, text, text, text, text, text, boolean, integer, integer) to service_role;
grant execute on function public.cardforge_get_developer_asset_program_summary(text, boolean) to service_role;

commit;
