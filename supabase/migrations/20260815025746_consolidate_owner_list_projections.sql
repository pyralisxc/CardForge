begin;

create or replace function public.cardforge_get_developer_submission_counts(
  p_developer_ids text[]
)
returns table (
  developer_id text,
  total_count bigint,
  published_count bigint,
  in_review_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested_ids as (
    select distinct value as developer_id
    from unnest(coalesce(p_developer_ids, array[]::text[])) as value
    where value is not null and btrim(value) <> ''
  )
  select
    requested_ids.developer_id,
    count(submissions.id)::bigint as total_count,
    count(submissions.id) filter (where submissions.status = 'published')::bigint as published_count,
    count(submissions.id) filter (
      where submissions.status <> 'published'
        and submissions.status <> 'rejected'
    )::bigint as in_review_count
  from requested_ids
  left join public.cardforge_developer_asset_submissions as submissions
    on submissions.developer_id = requested_ids.developer_id
  group by requested_ids.developer_id;
$$;

revoke all on function public.cardforge_get_developer_submission_counts(text[]) from public;
revoke all on function public.cardforge_get_developer_submission_counts(text[]) from anon;
revoke all on function public.cardforge_get_developer_submission_counts(text[]) from authenticated;
grant execute on function public.cardforge_get_developer_submission_counts(text[]) to service_role;

create or replace function public.cardforge_get_campaign_media_summary(
  p_contributor_id text,
  p_is_owner boolean
)
returns table (
  media_count bigint,
  protected_bytes bigint,
  derivative_bytes bigint,
  unused_media_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_media as (
    select media.id, media.original_byte_count, media.normalized_byte_count, media.archived_at
    from public.cardforge_campaign_media as media
    where coalesce(p_is_owner, false)
      or media.ingesting_contributor_id = p_contributor_id
      or media.review_state in ('approved', 'public')
  ), derivative_totals as (
    select coalesce(sum(derivative.byte_count), 0)::bigint as bytes
    from public.cardforge_campaign_media_derivatives as derivative
    join visible_media on visible_media.id = derivative.parent_media_id
  )
  select
    count(visible_media.id)::bigint,
    coalesce(sum(visible_media.original_byte_count + visible_media.normalized_byte_count), 0)::bigint,
    (select bytes from derivative_totals),
    count(visible_media.id) filter (
      where visible_media.archived_at is null
        and not exists (
          select 1
          from public.cardforge_social_campaign_media_attachments as attachment
          where attachment.media_id = visible_media.id
        )
    )::bigint
  from visible_media;
$$;

revoke all on function public.cardforge_get_campaign_media_summary(text, boolean) from public;
revoke all on function public.cardforge_get_campaign_media_summary(text, boolean) from anon;
revoke all on function public.cardforge_get_campaign_media_summary(text, boolean) from authenticated;
grant execute on function public.cardforge_get_campaign_media_summary(text, boolean) to service_role;

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
          'starter', count(*) filter (
            where submission.status = 'published' and submission.calculated_access_tier = 'free'
          )::bigint,
          'creatorPass', count(*) filter (
            where submission.status = 'published' and submission.calculated_access_tier = 'paid'
          )::bigint,
          'candidate', count(*) filter (
            where submission.status in ('voting', 'publish_candidate')
          )::bigint,
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
      where submission.status <> 'rejected'
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
            where submission.submitted_at >= month_window.starts_at
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
      where submission.status <> 'rejected'
        and (coalesce(p_allow_self_voting, false) or submission.developer_id <> p_current_user_id)
    )::bigint,
    count(submission.id) filter (
      where submission.source_storage_bucket is not null
        and submission.source_storage_path is not null
    )::bigint,
    coalesce(sum(submission.source_file_size_bytes) filter (
      where submission.source_storage_bucket is not null
        and submission.source_storage_path is not null
    ), 0)::bigint,
    (select value from status_summary),
    (select value from review_status_summary),
    (select value from type_summary),
    (select value from monthly_summary)
  from public.cardforge_developer_asset_submissions as submission;
$$;

revoke all on function public.cardforge_get_developer_asset_program_summary(text, boolean) from public;
revoke all on function public.cardforge_get_developer_asset_program_summary(text, boolean) from anon;
revoke all on function public.cardforge_get_developer_asset_program_summary(text, boolean) from authenticated;
grant execute on function public.cardforge_get_developer_asset_program_summary(text, boolean) to service_role;

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
returns table (
  submission_id uuid,
  total_count bigint
)
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
          and submission.status <> 'rejected'
          and (coalesce(p_allow_self_voting, false) or submission.developer_id <> p_current_user_id)
        )
      )
      and (p_asset_type is null or submission.asset_type = p_asset_type)
      and (p_status is null or submission.status = p_status)
      and (p_tier is null or submission.calculated_access_tier = p_tier)
      and (
        coalesce(nullif(btrim(p_query), ''), '') = ''
        or lower(concat_ws(
          ' ',
          submission.name,
          submission.description,
          submission.developer_email,
          submission.registry_asset_id,
          submission.target_registry_asset_id
        )) like '%' || lower(btrim(p_query)) || '%'
      )
      and (
        coalesce(p_vote_filter, 'all') = 'all'
        or (p_vote_filter = 'unvoted' and current_vote.submission_id is null)
        or (p_vote_filter = 'upvoted' and current_vote.vote_value = 'positive')
        or (p_vote_filter = 'downvoted' and current_vote.vote_value = 'negative')
      )
  ), numbered as (
    select
      filtered.id,
      filtered.submitted_at,
      count(*) over ()::bigint as total_count
    from filtered
  )
  select numbered.id, numbered.total_count
  from numbered
  order by numbered.submitted_at desc, numbered.id desc
  offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 12), 1), 50)
  limit least(greatest(coalesce(p_page_size, 12), 1), 50);
$$;

revoke all on function public.cardforge_list_developer_asset_submission_ids(text, text, text, text, text, text, text, boolean, integer, integer) from public;
revoke all on function public.cardforge_list_developer_asset_submission_ids(text, text, text, text, text, text, text, boolean, integer, integer) from anon;
revoke all on function public.cardforge_list_developer_asset_submission_ids(text, text, text, text, text, text, text, boolean, integer, integer) from authenticated;
grant execute on function public.cardforge_list_developer_asset_submission_ids(text, text, text, text, text, text, text, boolean, integer, integer) to service_role;

commit;
