begin;
alter table public.cardforge_contributor_asset_submissions
 add column owner_purge_requested_at timestamptz,
 add column purge_claim_token uuid;

-- Both batch and exact-target timer claims issue a fresh attempt identity.
-- Replace the old 3-column result signature; PostgreSQL cannot CREATE OR REPLACE
-- a function while changing its return row type.
drop function public.cardforge_claim_pipeline_revision_purges(integer);
create function public.cardforge_claim_pipeline_revision_purges(p_limit integer default 50)
returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
begin
 if p_limit is null or p_limit<1 or p_limit>250 then raise exception 'pipeline_retention_limit_invalid'; end if;
 return query with due as(
  select s.id from public.cardforge_contributor_asset_submissions s
  where s.trashed_at is not null and s.purge_after<=now()
   and s.published_at is null and s.retention_hold=false
   and (s.purge_state is null or (s.purge_state='pending' and s.purge_claimed_at<now()-interval '15 minutes'))
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id)
  order by s.purge_after,s.id limit p_limit for update of s skip locked
 ), claimed as(
  update public.cardforge_contributor_asset_submissions s
  set purge_state='pending',purge_claimed_at=now(),purge_claim_token=gen_random_uuid(),updated_at=now()
  from due where s.id=due.id
  returning s.id,s.source_storage_bucket,s.source_storage_path,s.purge_claim_token
 )
 select c.id,c.source_storage_bucket,c.source_storage_path,c.purge_claim_token from claimed c;
end $$;

drop function public.cardforge_claim_pipeline_revision_purge_target(uuid);
create function public.cardforge_claim_pipeline_revision_purge_target(p_submission_id uuid)
returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
begin
 if p_submission_id is null then raise exception 'pipeline_retention_target_invalid'; end if;
 return query with due as(
  select s.id from public.cardforge_contributor_asset_submissions s
  where s.id=p_submission_id and s.trashed_at is not null and s.purge_after<=now()
   and s.published_at is null and s.retention_hold=false
   and (s.purge_state is null or (s.purge_state='pending' and s.purge_claimed_at<now()-interval '15 minutes'))
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id)
  for update of s skip locked
 ),claimed as(
  update public.cardforge_contributor_asset_submissions s
  set purge_state='pending',purge_claimed_at=now(),purge_claim_token=gen_random_uuid(),updated_at=now()
  from due where s.id=due.id
  returning s.id,s.source_storage_bucket,s.source_storage_path,s.purge_claim_token
 )
 select c.id,c.source_storage_bucket,c.source_storage_path,c.purge_claim_token from claimed c;
end $$;

-- Confirmed Owner intent persists through interruption; only an expired
-- attempt may be reclaimed, never an active one.
create function public.cardforge_claim_pipeline_revision_purge_owner(
 p_submission_id uuid,p_expected_name text,p_expected_storage_path text
) returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
begin
 if p_submission_id is null or nullif(btrim(p_expected_name),'') is null then
  raise exception 'pipeline_owner_delete_confirmation_invalid'; end if;
 return query with due as(
  select s.id from public.cardforge_contributor_asset_submissions s
  where s.id=p_submission_id and s.name=p_expected_name
   and s.source_storage_path is not distinct from p_expected_storage_path
   and ((s.source_storage_bucket is null and s.source_storage_path is null)
     or (s.source_storage_bucket is not null and s.source_storage_path is not null))
   and s.status='archived' and s.trashed_at is not null
   and s.published_at is null and s.retention_hold=false
   and (s.purge_state is null or
     (s.owner_purge_requested_at is not null and s.purge_state='pending'
       and s.purge_claimed_at<now()-interval '15 minutes'))
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id)
  for update of s skip locked
 ),claimed as(
  update public.cardforge_contributor_asset_submissions s
  set purge_state='pending',purge_claimed_at=now(),purge_claim_token=gen_random_uuid(),
      owner_purge_requested_at=coalesce(s.owner_purge_requested_at,now()),updated_at=now()
  from due where s.id=due.id
  returning s.id,s.source_storage_bucket,s.source_storage_path,s.purge_claim_token
 )
 select c.id,c.source_storage_bucket,c.source_storage_path,c.purge_claim_token from claimed c;
end $$;

-- The old ID-only functions must not remain callable by workers; claims are
-- now fenced by the exact attempt token.
revoke execute on function public.cardforge_finalize_pipeline_revision_purge(uuid) from public,anon,authenticated,service_role;
revoke execute on function public.cardforge_release_pipeline_revision_purge(uuid) from public,anon,authenticated,service_role;
create function public.cardforge_finalize_pipeline_revision_purge(p_submission_id uuid,p_claim_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 delete from public.cardforge_contributor_asset_submissions s
 where s.id=p_submission_id and s.purge_claim_token=p_claim_token and p_claim_token is not null
   and s.purge_state='pending' and s.trashed_at is not null
   and (s.purge_after<=now() or s.owner_purge_requested_at is not null)
   and s.published_at is null and s.retention_hold=false
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id);
 return found;
end $$;
create function public.cardforge_release_pipeline_revision_purge(p_submission_id uuid,p_claim_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.cardforge_contributor_asset_submissions s
 set purge_state=null,purge_claimed_at=null,purge_claim_token=null,updated_at=now()
 where s.id=p_submission_id and s.purge_state='pending' and s.purge_claim_token=p_claim_token
  and p_claim_token is not null;
 return found;
end $$;
revoke all on function public.cardforge_claim_pipeline_revision_purge_owner(uuid,text,text) from public,anon,authenticated;
revoke all on function public.cardforge_claim_pipeline_revision_purge_target(uuid) from public,anon,authenticated;
revoke all on function public.cardforge_claim_pipeline_revision_purges(integer) from public,anon,authenticated;
revoke all on function public.cardforge_finalize_pipeline_revision_purge(uuid,uuid) from public,anon,authenticated;
revoke all on function public.cardforge_release_pipeline_revision_purge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cardforge_claim_pipeline_revision_purge_owner(uuid,text,text) to service_role;
grant execute on function public.cardforge_claim_pipeline_revision_purge_target(uuid) to service_role;
grant execute on function public.cardforge_claim_pipeline_revision_purges(integer) to service_role;
grant execute on function public.cardforge_finalize_pipeline_revision_purge(uuid,uuid) to service_role;
grant execute on function public.cardforge_release_pipeline_revision_purge(uuid,uuid) to service_role;
commit;
