-- Known-ineligible rows must not consume the revision expiry batch bound.
-- Selection is advisory: the existing helper still acquires the lineage first
-- and rechecks every condition before issuing an irreversible claim.
begin;
set local lock_timeout='5s';

create or replace function public.cardforge_claim_pipeline_revision_purges(p_limit integer default 50)
returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
declare candidate uuid;
begin
  if p_limit is null or p_limit<1 or p_limit>250 then raise exception 'pipeline_retention_limit_invalid'; end if;
  for candidate in select s.id from public.cardforge_contributor_asset_submissions s
    join public.cardforge_pipeline_asset_lineages l on l.id=s.lineage_id
    where l.catalog_trashed_at is null and l.purge_state is null
      and s.trashed_at is not null and isfinite(s.trashed_at)
      and s.purge_after is not null and isfinite(s.purge_after) and s.purge_after<=now()
      and s.purge_state is null and s.purge_claim_token is null and s.purge_claimed_at is null
      and s.owner_purge_requested_at is null
      and s.published_at is null and not s.retention_hold
      and (s.source_storage_bucket is null)=(s.source_storage_path is null)
      and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
      and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id)
    order by s.lineage_id,s.id limit p_limit
  loop
    return query select * from public.cardforge_claim_pipeline_revision_purge_locked(candidate);
  end loop;
end $$;
commit;
