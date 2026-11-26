-- Enforce a single exact-revision reaction per contributor and lineage.
-- Existing duplicates require a separately reviewed resolution; never delete or
-- pick a winner in this migration. Lock before checking so the decision and
-- uniqueness enforcement cannot race a concurrent vote.
begin;
set local lock_timeout='5s';
lock table public.cardforge_contributor_asset_votes in share row exclusive mode;
do $$ begin
  if exists (select 1 from public.cardforge_contributor_asset_votes
    group by lineage_id, contributor_id having count(*) > 1) then
    raise exception 'pipeline_duplicate_lineage_votes_require_resolution';
  end if;
end $$;
create unique index cardforge_contributor_one_vote_per_lineage
  on public.cardforge_contributor_asset_votes (lineage_id, contributor_id);
drop index if exists public.cardforge_contributor_one_positive_preference_per_lineage;

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
declare submission public.cardforge_contributor_asset_submissions%rowtype; target_lineage uuid;
begin
  if nullif(pg_catalog.btrim(p_contributor_id), '') is null
    or p_vote_value not in ('positive', 'negative')
  then raise exception 'invalid_contributor_asset_vote'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline',0));
  select lineage_id into target_lineage from public.cardforge_contributor_asset_submissions where id=p_submission_id;
  perform 1 from public.cardforge_pipeline_asset_lineages where id=target_lineage for update;
  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and lineage_id=target_lineage and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  if exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=target_lineage and (l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null)) then raise exception 'contributor_asset_vote_not_permitted'; end if;

  if submission.purge_claim_token is not null or submission.purge_claimed_at is not null or submission.owner_purge_requested_at is not null then raise exception 'contributor_asset_vote_not_permitted'; end if;
  if submission.trashed_at is not null and (not coalesce((submission.revision_publication_retained or submission.published_at is not null or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false) or submission.purge_claim_token is not null or submission.purge_claimed_at is not null or submission.owner_purge_requested_at is not null) then raise exception 'contributor_asset_vote_not_permitted'; end if;
  if submission.status = 'draft' then
    raise exception 'contributor_asset_vote_not_permitted';
  end if;

  insert into public.cardforge_contributor_asset_votes (
    submission_id, lineage_id, contributor_id, vote_value, vote_weight
  ) values (
    submission.id, submission.lineage_id, p_contributor_id, p_vote_value, 1
  )
  on conflict (lineage_id, contributor_id) do update
  set submission_id = excluded.submission_id,
      vote_value = excluded.vote_value,
      vote_weight = 1,
      updated_at = pg_catalog.now();

  return public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
end;
$$;

commit;
