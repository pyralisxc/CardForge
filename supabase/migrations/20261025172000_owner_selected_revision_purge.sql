begin;
alter table public.cardforge_contributor_asset_submissions
 add column owner_purge_requested_at timestamptz;
create function public.cardforge_claim_pipeline_revision_purge_owner(
 p_submission_id uuid,p_expected_name text,p_expected_storage_path text
) returns table(submission_id uuid,storage_bucket text,storage_path text)
language plpgsql security invoker set search_path='' as $$
begin
 if p_submission_id is null or nullif(btrim(p_expected_name),'') is null or
    nullif(btrim(p_expected_storage_path),'') is null
 then raise exception 'pipeline_owner_delete_confirmation_invalid'; end if;
 return query with due as (
  select s.id from public.cardforge_contributor_asset_submissions s
  where s.id=p_submission_id and s.name=p_expected_name
   and s.source_storage_path=p_expected_storage_path
   and s.source_storage_bucket is not null
   and s.status='archived' and s.trashed_at is not null
   and s.published_at is null and s.retention_hold=false
   and s.purge_state is null
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id)
  for update of s skip locked
 ),claimed as(
  update public.cardforge_contributor_asset_submissions s
  set purge_state='pending',purge_claimed_at=now(),owner_purge_requested_at=now(),updated_at=now()
  from due where s.id=due.id
  returning s.id,s.source_storage_bucket,s.source_storage_path
 )
 select c.id,c.source_storage_bucket,c.source_storage_path from claimed c;
end $$;
revoke all on function public.cardforge_claim_pipeline_revision_purge_owner(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cardforge_claim_pipeline_revision_purge_owner(uuid,text,text) to service_role;
create or replace function public.cardforge_finalize_pipeline_revision_purge(p_submission_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 delete from public.cardforge_contributor_asset_submissions s
 where s.id=p_submission_id and s.purge_state='pending'
   and s.trashed_at is not null
   and (s.purge_after<=now() or s.owner_purge_requested_at is not null)
   and s.published_at is null and s.retention_hold=false
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id);
 return found;
end $$;
commit;
