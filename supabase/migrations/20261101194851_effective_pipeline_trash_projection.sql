begin;
set local lock_timeout='5s';
-- A service-only read projection, not a new lifecycle store. Submission and
-- lineage remain the independent native owners; no authored status is rewritten.
create view public.cardforge_pipeline_submission_recovery_projection
with (security_invoker=true) as
select s.*,l.catalog_trashed_at,l.catalog_purge_after,l.catalog_retention_hold,
 r.contributor_submission_id as catalog_submission_id,
 coalesce(r.status='published' and r.contributor_submission_id=s.id,false) as catalog_source_published
from public.cardforge_contributor_asset_submissions s
left join public.cardforge_pipeline_asset_lineages l on l.id=s.lineage_id
left join public.cardforge_asset_registry r on r.asset_id=l.registry_asset_id;
revoke all on public.cardforge_pipeline_submission_recovery_projection from public,anon,authenticated;
grant select on public.cardforge_pipeline_submission_recovery_projection to service_role;

-- Effective Trash filtering precedes all counts, ordering and page slicing.
-- Shared output remains a closed metadata projection with observed sharing
-- evidence; a private sibling does not inherit a published sibling's visibility.
create or replace function public.cardforge_list_contributor_asset_submission_ids(
  p_current_user_id text,
  p_scope text default 'all',
  p_query text default '',
  p_asset_type text default null,
  p_status text default null,
  p_tier text default null,
  p_vote_filter text default 'all',
  p_allow_self_voting boolean default false,
  p_page integer default 1,
  p_page_size integer default 12,
  p_trash_state text default 'active'
)
returns table (submission_id uuid, total_count bigint, shared_metadata jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select submission.id, submission.submitted_at,
      case when p_scope='shared' then jsonb_build_object(
        'id',submission.id,'lineageId',submission.lineage_id,'assetType',submission.asset_type,
        'name',submission.name,'description',coalesce(submission.description,''),'status',submission.status,
        'revisionNumber',submission.revision_number,'trashedAt',submission.trashed_at,
        'catalogTrashedAt',submission.catalog_trashed_at,'catalogPurgeAfter',submission.catalog_purge_after,
        'catalogRetentionHold',submission.catalog_retention_hold,'catalogSubmissionId',submission.catalog_submission_id,
        'purgeAfter',submission.purge_after,'trashActorRole',submission.revision_trash_actor_role,
        'trashPreviousStatus',submission.revision_trash_previous_status,
        'publicationRetained',submission.revision_publication_retained or submission.published_at is not null or submission.catalog_source_published,
        'positiveVotes',submission.positive_votes,'negativeVotes',submission.negative_votes,
        'ownedByViewer',submission.contributor_id=p_current_user_id) else null end as shared_metadata
    from public.cardforge_pipeline_submission_recovery_projection as submission
    left join public.cardforge_contributor_asset_votes as current_vote
      on current_vote.submission_id = submission.id
      and current_vote.contributor_id = p_current_user_id
    where coalesce(p_scope, 'all') in ('all', 'own', 'review', 'shared')
      and (
        coalesce(p_scope, 'all') = 'all'
        or (p_scope='shared' and submission.status<>'draft' and (submission.trashed_at is not null or submission.catalog_trashed_at is not null) and coalesce(
          submission.revision_publication_retained or submission.published_at is not null or submission.catalog_source_published
          or (submission.catalog_trashed_at is not null and submission.status in ('submitted','voting','publish_candidate','published')) or submission.revision_trash_actor_role='voting'
          or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published'),false))
        or (p_scope = 'own' and submission.contributor_id = p_current_user_id)
        or (
          p_scope = 'review'
          and (submission.status not in ('draft', 'rejected') or (submission.status<>'draft' and (submission.trashed_at is not null or submission.catalog_trashed_at is not null) and coalesce(((submission.trashed_at is null and submission.catalog_trashed_at is null) or submission.revision_publication_retained or submission.published_at is not null or submission.catalog_source_published or (submission.catalog_trashed_at is not null and submission.status in ('submitted','voting','publish_candidate','published')) or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false)))
          and (coalesce(p_allow_self_voting, false) or submission.contributor_id <> p_current_user_id)
        )
      )
      and coalesce(p_trash_state,'active') in ('all','active','trashed')
      and (coalesce(p_trash_state,'active')='all' or coalesce(p_trash_state,'active')='active' and (submission.trashed_at is null and submission.catalog_trashed_at is null) or coalesce(p_trash_state,'active')='trashed' and (submission.trashed_at is not null or submission.catalog_trashed_at is not null))
      and submission.purge_state is null
      and (p_scope<>'review' or coalesce(((submission.trashed_at is null and submission.catalog_trashed_at is null) or submission.revision_publication_retained or submission.published_at is not null or submission.catalog_source_published or (submission.catalog_trashed_at is not null and submission.status in ('submitted','voting','publish_candidate','published')) or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false))
      and (p_asset_type is null or submission.asset_type = p_asset_type)
      and (p_status is null or submission.status = p_status)
      and (p_tier is null or submission.calculated_access_tier = p_tier)
      and (
        coalesce(nullif(pg_catalog.btrim(p_query), ''), '') = ''
        or pg_catalog.lower(pg_catalog.concat_ws(
          ' ', submission.name, submission.description, case when p_scope='shared' then null else submission.contributor_email end,
          submission.registry_asset_id, submission.target_registry_asset_id
        )) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
      )
      and (
        coalesce(p_vote_filter, 'all') = 'all'
        or (p_vote_filter = 'unvoted' and current_vote.submission_id is null)
        or (p_vote_filter = 'upvoted' and current_vote.vote_value = 'positive')
        or (p_vote_filter = 'downvoted' and current_vote.vote_value = 'negative')
      )
  ), totals as (
    select count(*)::bigint as total_count from filtered
  )
  select slice.id, totals.total_count, slice.shared_metadata
  from totals left join lateral (
    select filtered.id, filtered.submitted_at, filtered.shared_metadata from filtered
    order by filtered.submitted_at desc, filtered.id desc
    offset (greatest(coalesce(p_page, 1), 1)::bigint - 1)
      * least(greatest(coalesce(p_page_size, 12), 1), 50)
    limit least(greatest(coalesce(p_page_size, 12), 1), 50)
  ) slice on true
  order by slice.submitted_at desc, slice.id desc;
$$;

revoke all on function public.cardforge_list_contributor_asset_submission_ids(text,text,text,text,text,text,text,boolean,integer,integer,text) from public,anon,authenticated;
grant execute on function public.cardforge_list_contributor_asset_submission_ids(text,text,text,text,text,text,text,boolean,integer,integer,text) to service_role;
commit;
