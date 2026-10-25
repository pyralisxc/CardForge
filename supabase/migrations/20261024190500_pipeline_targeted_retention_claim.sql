begin;
-- Dedicated exact-target claim. This does not modify the existing global
-- claim RPC or the normal scheduled batch contract.
create function public.cardforge_claim_pipeline_revision_purge_target(p_submission_id uuid)
returns table(submission_id uuid, storage_bucket text, storage_path text)
language plpgsql security invoker set search_path = '' as $claim$
begin
  if p_submission_id is null then raise exception 'pipeline_retention_target_invalid'; end if;
  return query
  with due as (
    select submission.id from public.cardforge_contributor_asset_submissions submission
    where submission.id = p_submission_id
      and submission.trashed_at is not null
      and submission.purge_after <= pg_catalog.now()
      and submission.published_at is null
      and submission.retention_hold = false
      and (submission.purge_state is null or (
        submission.purge_state='pending'
        and submission.purge_claimed_at < pg_catalog.now()-interval '15 minutes'))
      and not exists (
        select 1 from public.cardforge_asset_registry registry
        where registry.contributor_submission_id=submission.id)
    for update of submission skip locked
  ), claimed as (
    update public.cardforge_contributor_asset_submissions submission
    set purge_state='pending',purge_claimed_at=pg_catalog.now(),
        updated_at=pg_catalog.now()
    from due where submission.id=due.id
    returning submission.id,submission.source_storage_bucket,submission.source_storage_path
  )
  select claimed.id,claimed.source_storage_bucket,claimed.source_storage_path from claimed;
end;
$claim$;
revoke all on function public.cardforge_claim_pipeline_revision_purge_target(uuid) from public,anon,authenticated;
grant execute on function public.cardforge_claim_pipeline_revision_purge_target(uuid) to service_role;
commit;
