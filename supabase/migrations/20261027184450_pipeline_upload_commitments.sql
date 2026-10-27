-- Prospective migration; generated with pinned native CLI in disposable CI.
begin;
set local lock_timeout='5s';
-- The existing lineage owns a fresh exact source BEFORE signed upload authority
-- is issued. No legacy row is certified and no destructive history is cleared.
alter table public.cardforge_pipeline_asset_lineages
 add column upload_source_path text unique,
 add column upload_contributor_id text,
 add column upload_descriptor jsonb,
 add column upload_state text check(upload_state in ('pending','submitting','owned','cleanup_committed','cleanup_completed')),
 add column upload_operation_token uuid,
 add column upload_request jsonb,
 add column upload_submission_id uuid,
 add column upload_committed_size bigint;
alter table public.cardforge_contributor_asset_submissions add column source_upload_token uuid;
alter table public.cardforge_pipeline_asset_lineages add constraint pipeline_upload_identity_complete check (
 (upload_source_path is null and upload_contributor_id is null and upload_descriptor is null and upload_state is null
   and upload_operation_token is null and upload_request is null and upload_submission_id is null and upload_committed_size is null)
 or (upload_source_path is not null and upload_contributor_id is not null and upload_descriptor is not null and upload_state is not null
   and upload_source_path='pipeline-owned-v1/'||id::text||'/source.'||(upload_descriptor->>'transportExtension')
   and (upload_state='pending' or upload_operation_token is not null)
   and (upload_state not in ('submitting','owned') or upload_request is not null)
   and (upload_state<>'owned' or (upload_submission_id is not null and upload_committed_size>0))));

create function public.cardforge_guard_pipeline_upload_history() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
   if old.upload_source_path is not null then raise exception 'pipeline_upload_history_retained'; end if;
   return old;
 end if;
 if tg_op='INSERT' then
   if new.upload_source_path is not null and (new.upload_state<>'pending' or new.upload_operation_token is not null
      or new.upload_request is not null or new.upload_submission_id is not null
      or exists(select 1 from storage.objects where bucket_id='cardforge-contributor-assets' and name=new.upload_source_path)
      or exists(select 1 from public.cardforge_contributor_asset_submissions where source_storage_path=new.upload_source_path)) then
     raise exception 'pipeline_upload_identity_conflict'; end if;
 elsif old.upload_source_path is not null then
   if new.upload_source_path is distinct from old.upload_source_path or new.upload_contributor_id is distinct from old.upload_contributor_id
      or new.upload_descriptor is distinct from old.upload_descriptor
      or (old.upload_operation_token is not null and new.upload_operation_token is distinct from old.upload_operation_token)
      or (old.upload_request is not null and new.upload_request is distinct from old.upload_request)
      or (old.upload_submission_id is not null and new.upload_submission_id is distinct from old.upload_submission_id)
      or (old.upload_committed_size is not null and new.upload_committed_size is distinct from old.upload_committed_size)
      or not (new.upload_state=old.upload_state or (old.upload_state='pending' and new.upload_state in ('submitting','cleanup_committed'))
        or (old.upload_state='submitting' and new.upload_state='owned') or (old.upload_state='cleanup_committed' and new.upload_state='cleanup_completed')) then
      raise exception 'pipeline_upload_history_retained'; end if;
 elsif new.upload_source_path is not null then raise exception 'pipeline_upload_legacy_uncertainty';
 end if;
 return new;
end $$;
create trigger pipeline_upload_history_guard before insert or update or delete on public.cardforge_pipeline_asset_lineages
 for each row execute function public.cardforge_guard_pipeline_upload_history();

create function public.cardforge_reserve_pipeline_upload(p_actor text,p_descriptor jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare identity uuid:=gen_random_uuid(); path text;
begin
 if nullif(btrim(p_actor),'') is null or jsonb_typeof(p_descriptor) is distinct from 'object'
   or coalesce(p_descriptor->>'assetType','') not in ('textures','dividers','icons','imageAssets','fonts','sets')
   or coalesce(p_descriptor->>'transportExtension','') not in ('png','jpg','webp','cfsvg','woff2','woff','ttf','otf','cardforge')
   or jsonb_typeof(p_descriptor->'fileSizeBytes') is distinct from 'number'
   or (p_descriptor->>'fileSizeBytes')::numeric not between 1 and 52428800
   or nullif(p_descriptor->>'fileName','') is null or nullif(p_descriptor->>'mimeType','') is null then
   raise exception 'pipeline_upload_invalid'; end if;
 path:='pipeline-owned-v1/'||identity::text||'/source.'||(p_descriptor->>'transportExtension');
 insert into public.cardforge_pipeline_asset_lineages(id,upload_source_path,upload_contributor_id,upload_descriptor,upload_state)
 values(identity,path,p_actor,p_descriptor,'pending');
 return jsonb_build_object('storagePath',path,'lineageId',identity);
end $$;

create function public.cardforge_prepare_pipeline_upload_submission(p_actor text,p_path text,p_descriptor jsonb,p_request jsonb,p_claim boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=p_path for update nowait;
 if not found then raise exception 'pipeline_upload_legacy_uncertainty'; end if;
 if l.upload_contributor_id is distinct from p_actor then raise exception 'pipeline_upload_not_permitted'; end if;
 if l.upload_descriptor is distinct from p_descriptor then raise exception 'pipeline_upload_identity_conflict'; end if;
 if l.purge_state is not null or l.catalog_destructive_uncertainty is not null or l.catalog_trashed_at is not null then raise exception 'pipeline_upload_prior_commitment'; end if;
 if l.upload_state='owned' then
   if l.upload_request is distinct from p_request or not exists(select 1 from public.cardforge_contributor_asset_submissions where id=l.upload_submission_id) then
     raise exception 'pipeline_upload_identity_conflict'; end if;
   return jsonb_build_object('state','owned','submissionId',l.upload_submission_id);
 end if;
 if l.upload_state='submitting' then raise exception 'pipeline_upload_submission_uncertain'; end if;
 if l.upload_state<>'pending' then raise exception 'pipeline_upload_cleanup_committed'; end if;
 if p_request->>'contributor_id' is distinct from p_actor or p_request->>'asset_type' is distinct from p_descriptor->>'assetType'
   or p_request->>'source_storage_bucket' is distinct from 'cardforge-contributor-assets'
   or p_request->>'source_storage_path' is distinct from p_path then raise exception 'pipeline_upload_identity_conflict'; end if;
 if not p_claim then return jsonb_build_object('state','pending'); end if;
 update public.cardforge_pipeline_asset_lineages set upload_state='submitting',upload_operation_token=gen_random_uuid(),upload_request=p_request where id=l.id returning * into l;
 return jsonb_build_object('state','submitting','token',l.upload_operation_token,'lineageId',l.id);
end $$;

create function public.cardforge_guard_pipeline_upload_source() returns trigger
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 if tg_op='UPDATE' and old.source_storage_path like 'pipeline-owned-v1/%' and
   (new.source_storage_path is distinct from old.source_storage_path or new.source_storage_bucket is distinct from old.source_storage_bucket
    or new.lineage_id is distinct from old.lineage_id or new.contributor_id is distinct from old.contributor_id
    or new.source_upload_token is distinct from old.source_upload_token or new.asset_type is distinct from old.asset_type
    or new.source_url is distinct from old.source_url or new.source_file_size_bytes is distinct from old.source_file_size_bytes
    or new.source_mime_type is distinct from old.source_mime_type) then raise exception 'pipeline_upload_identity_conflict'; end if;
 -- Existing source identities are immutable; ordinary governance/claim updates
 -- retain their existing owners and must not be blocked by their own commitment.
 if tg_op='UPDATE' and old.source_storage_path like 'pipeline-owned-v1/%' then return new; end if;
 if new.source_storage_path like 'pipeline-owned-v1/%' or new.source_url like '%/pipeline-owned-v1/%' then
   select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=new.source_storage_path for update nowait;
   if not found or new.source_storage_bucket is distinct from 'cardforge-contributor-assets'
      or new.contributor_id is distinct from l.upload_contributor_id or new.lineage_id is distinct from l.id
      or new.asset_type is distinct from l.upload_descriptor->>'assetType'
      or right(coalesce(new.source_url,''),length('/storage/v1/object/public/cardforge-contributor-assets/'||new.source_storage_path))
        <> '/storage/v1/object/public/cardforge-contributor-assets/'||new.source_storage_path then raise exception 'pipeline_upload_identity_conflict'; end if;
   if l.purge_state is not null or l.catalog_destructive_uncertainty is not null or l.catalog_trashed_at is not null then
     raise exception 'pipeline_upload_prior_commitment'; end if;
   if l.upload_state='submitting' then
     if new.source_upload_token is distinct from l.upload_operation_token then raise exception 'pipeline_upload_identity_conflict'; end if;
   elsif l.upload_state<>'owned' then raise exception 'pipeline_upload_cleanup_committed'; end if;
 end if;
 return new;
end $$;
-- Runs after existing lineage assignment, before the existing member fence.
create trigger zy_pipeline_upload_source_guard before insert or update on public.cardforge_contributor_asset_submissions
 for each row execute function public.cardforge_guard_pipeline_upload_source();

create function public.cardforge_commit_pipeline_upload_submission(p_path text,p_token uuid,p_fields jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; result uuid;
begin
 select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=p_path for update nowait;
 if not found or p_token is null or l.upload_operation_token is distinct from p_token or l.upload_state not in ('submitting','owned') then
   raise exception 'pipeline_upload_identity_conflict'; end if;
 if l.purge_state is not null or l.catalog_destructive_uncertainty is not null or l.catalog_trashed_at is not null then raise exception 'pipeline_upload_prior_commitment'; end if;
 if (p_fields-'source_file_size_bytes') is distinct from (l.upload_request-'source_file_size_bytes')
    or jsonb_typeof(p_fields->'source_file_size_bytes') is distinct from 'number'
    or (p_fields->>'source_file_size_bytes')::bigint<=0
    or (l.upload_descriptor->>'transportExtension'<>'cfsvg' and p_fields->'source_file_size_bytes' is distinct from l.upload_request->'source_file_size_bytes') then
   raise exception 'pipeline_upload_identity_conflict'; end if;
 if l.upload_state='owned' then
   if l.upload_committed_size is distinct from (p_fields->>'source_file_size_bytes')::bigint then raise exception 'pipeline_upload_identity_conflict'; end if;
   return l.upload_submission_id;
 end if;
 insert into public.cardforge_contributor_asset_submissions
 (lineage_id,contributor_id,contributor_email,asset_type,requested_studio_destination,specialty_tags,use_case_tags,
 semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,name,description,source_notes,preview_url,source_url,
 source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,source_upload_token,
 status,automated_status,calculated_access_tier,automated_access_tier,quality_score,tier_decision_reason,positive_votes,negative_votes)
 select l.id,x.contributor_id,x.contributor_email,x.asset_type,x.requested_studio_destination,x.specialty_tags,x.use_case_tags,
 x.semantic_role,x.visual_family,x.variant_kind,x.variant_label,x.compatibility_tags,x.name,x.description,x.source_notes,x.preview_url,x.source_url,
 x.source_file_size_bytes,x.source_mime_type,x.source_storage_bucket,x.source_storage_path,p_token,
 'voting','voting','contributor','contributor',0,'needs_more_votes',0,0
 from jsonb_populate_record(null::public.cardforge_contributor_asset_submissions,p_fields) x returning id into result;
 update public.cardforge_pipeline_asset_lineages set upload_state='owned',upload_submission_id=result,
   upload_committed_size=(p_fields->>'source_file_size_bytes')::bigint where id=l.id;
 return result;
end $$;

create function public.cardforge_claim_pipeline_upload_cleanup(p_actor text,p_path text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; token uuid;
begin
 select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=p_path for update nowait;
 if not found then raise exception 'pipeline_upload_legacy_uncertainty'; end if;
 if l.upload_contributor_id is distinct from p_actor then raise exception 'pipeline_upload_not_permitted'; end if;
 if l.upload_state<>'pending' or l.purge_state is not null or l.catalog_destructive_uncertainty is not null
   or exists(select 1 from public.cardforge_contributor_asset_submissions where source_storage_bucket='cardforge-contributor-assets' and source_storage_path=p_path) then
   raise exception 'pipeline_upload_cleanup_blocked'; end if;
 token:=gen_random_uuid();
 update public.cardforge_pipeline_asset_lineages set upload_state='cleanup_committed',upload_operation_token=token where id=l.id;
 return token;
end $$;
create function public.cardforge_finalize_pipeline_upload_cleanup(p_path text,p_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=p_path for update nowait;
 if not found or p_token is null or l.upload_operation_token is distinct from p_token or l.upload_state not in ('cleanup_committed','cleanup_completed') then
   raise exception 'pipeline_upload_identity_conflict'; end if;
 update public.cardforge_pipeline_asset_lineages set upload_state='cleanup_completed' where id=l.id;
 return true;
end $$;

create or replace function public.cardforge_claim_pipeline_revision_purge_locked(
  p_submission_id uuid,p_owner boolean default false,p_expected_name text default null,p_expected_storage_path text default null
) returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; s public.cardforge_contributor_asset_submissions%rowtype;
begin
  select lineage.* into l from public.cardforge_pipeline_asset_lineages lineage
    where lineage.id=(select r.lineage_id from public.cardforge_contributor_asset_submissions r where r.id=p_submission_id)
    for update skip locked;
  if not found or l.catalog_trashed_at is not null or l.purge_state is not null then return; end if;
  select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id for update;
  if not found or s.lineage_id<>l.id or s.trashed_at is null or not isfinite(s.trashed_at) or s.published_at is not null or s.retention_hold
    or s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null
    or s.owner_purge_requested_at is not null
    or ((s.source_storage_bucket is null)<>(s.source_storage_path is null))
    or exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
    or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id) then return; end if;
  -- All retained siblings sharing a reserved source are exact-object owners.
  -- Reuse takes this same lineage lock and refuses a prior commitment, so neither
  -- side can establish authority after the other has won.
  if s.source_storage_path like 'pipeline-owned-v1/%' and (
    l.upload_state is distinct from 'owned' or l.upload_source_path is distinct from s.source_storage_path
    or exists(select 1 from public.cardforge_contributor_asset_submissions sibling where sibling.id<>s.id
      and sibling.source_storage_bucket=s.source_storage_bucket and sibling.source_storage_path=s.source_storage_path)) then return; end if;
  if p_owner then
    if s.status<>'archived' or s.name is distinct from p_expected_name
      or s.source_storage_path is distinct from p_expected_storage_path then return; end if;
  elsif s.purge_after is null or not isfinite(s.purge_after) or s.purge_after>now() then return;
  end if;
  return query update public.cardforge_contributor_asset_submissions r
    set purge_state='pending',purge_claimed_at=now(),purge_claim_token=gen_random_uuid(),
      owner_purge_requested_at=case when p_owner then now() else null end,updated_at=now()
    where r.id=s.id returning r.id,r.source_storage_bucket,r.source_storage_path,r.purge_claim_token;
end $$;


create or replace function public.cardforge_catalog_trash_entry_reasons(p_lineage_id uuid)
returns text[] language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
  reasons text[] := '{}'; consumer record; payload jsonb; key text;
  ids text[]; sources text[]; opaque boolean:=false; referenced boolean:=false;
begin
  select * into l from public.cardforge_pipeline_asset_lineages where id=p_lineage_id;
  select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
  if l.catalog_destructive_uncertainty is not null then reasons:=array_append(reasons,l.catalog_destructive_uncertainty); end if;
  if l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
      and (s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null or s.owner_purge_requested_at is not null))
    then reasons:=array_append(reasons,'destructive_attempt_requires_reconciliation'); end if;
  if r.asset_id is null or r.contributor_submission_id is null then
    reasons:=array_append(reasons,'catalog_registry_identity_unavailable');
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions newer
    join public.cardforge_contributor_asset_submissions published_base on published_base.id=r.contributor_submission_id
    where newer.lineage_id=l.id and newer.revision_number>published_base.revision_number) then
    reasons:=array_append(reasons,'newer_revision_requires_review');
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions source where source.lineage_id=l.id
    and (source.source_storage_bucket is not null or source.source_storage_path is not null)
    and not coalesce((source.source_storage_bucket='cardforge-contributor-assets'
      and source.source_storage_path=l.upload_source_path and l.upload_state='owned'
      and l.upload_operation_token is not null and l.upload_request is not null
      and exists(select 1 from public.cardforge_contributor_asset_submissions receipt
        where receipt.id=l.upload_submission_id and receipt.lineage_id=l.id
          and receipt.source_upload_token=l.upload_operation_token
          and receipt.source_storage_bucket=source.source_storage_bucket
          and receipt.source_storage_path=source.source_storage_path)),false)) then
    reasons:=array_append(reasons,'upload_cleanup_commitment_unverified');
  end if;
  -- Templates, fonts and presets also supply the runtime bootstrap. Do not
  -- hide them before installed-resolution compatibility has been established.
  if r.asset_type is null or r.asset_type not in ('image','texture','divider','icon') then
    reasons:=array_append(reasons,'installed_runtime_resolution_unverified');
  end if;
  ids:=array_remove(array[r.asset_id,l.id::text],null);
  select coalesce(array_agg(distinct u) filter(where nullif(u,'') is not null),'{}') into sources
    from (select r.url u union all select r.preview_url
      union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
      union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id) x;
  -- Exact stored source/preview aliases only: never derive equivalence from a
  -- display name, filename, URL rewrite, failed fetch or caller-provided scan.

  -- Respect readRegistryContentAsset precedence, but do not skip an invalid
  -- non-NULL candidate: native and JS validation may differ at their edges.
  -- Such a candidate stays opaque rather than clearing a later fallback.
  -- Only Styles have metadata fallback. NULL source is never backfilled.
  -- Sets have no persisted decoded package in the native authority: their URL
  -- and summary metadata cannot establish complete dependency inventory.
  for consumer in select a.*,s.source_payload from public.cardforge_asset_registry a
    left join public.cardforge_contributor_asset_submissions s on s.id=a.contributor_submission_id
    where a.asset_type in ('elementPreset','template','set') loop
    payload:=consumer.source_payload;
    if consumer.asset_type='elementPreset' then
      if payload is null or payload='null'::jsonb then
        payload:=null;
        foreach key in array array['style','elementPreset','payload'] loop
          if consumer.metadata->key is not null and consumer.metadata->key<>'null'::jsonb then
            payload:=consumer.metadata->key; exit;
          end if;
        end loop;
      end if;
    end if;
    if public.cardforge_catalog_consumer_mentions(payload,ids,sources) then referenced:=true; end if;
    if consumer.asset_type='set' or not public.cardforge_catalog_consumer_inspectable(payload,
      case when consumer.asset_type='elementPreset' then 'style' else 'template' end) then opaque:=true; end if;
  end loop;

  -- Unpublished and historical native payloads remain consumers. A linked
  -- legacy NULL Style was inspected through its authoritative registry above;
  -- never substitute that current metadata for an unlinked historical revision.
  for consumer in select s.* from public.cardforge_contributor_asset_submissions s
    where s.lineage_id is distinct from l.id
      and not exists(select 1 from public.cardforge_asset_registry a where a.contributor_submission_id=s.id
        and a.asset_type in ('elementPreset','template','set')) loop
    if public.cardforge_catalog_consumer_mentions(consumer.source_payload,ids,sources) then referenced:=true; end if;
    if consumer.asset_type in ('elementPresets','templates','sets') then
      if consumer.asset_type='sets' or not public.cardforge_catalog_consumer_inspectable(consumer.source_payload,
        case when consumer.asset_type='elementPresets' then 'style' else 'template' end) then opaque:=true; end if;
    elsif consumer.source_payload is not null then
      -- No negative proof for an unsupported payload kind.
      opaque:=true;
    end if;
  end loop;
  if referenced then reasons:=array_append(reasons,'pipeline_identity_consumer_requires_resolution'); end if;

  -- Studio document packages have their own ownership/resolution semantics.
  -- Recognize actual references, but do not manufacture completeness for an
  -- arbitrary document wrapper or independent installed package.
  for consumer in select document_payload from public.cardforge_studio_documents loop
    if public.cardforge_catalog_consumer_mentions(consumer.document_payload,ids,sources) then
      if not ('studio_identity_consumer_requires_resolution'=any(reasons)) then
        reasons:=array_append(reasons,'studio_identity_consumer_requires_resolution');
      end if;
    else opaque:=true;
    end if;
  end loop;
  if opaque then reasons:=array_append(reasons,'json_consumer_inventory_unverified'); end if;
  return reasons;
end $$;



-- Normal finalization removes submissions/registry but retains reserved source
-- commitment history. Do not turn successful Storage-before-row finalization
-- into a rollback by letting automatic empty-lineage cleanup erase it.
create or replace function public.cardforge_cleanup_pipeline_asset_lineage_after_submission_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.id = old.lineage_id
    and lineage.upload_source_path is null
    and not exists (
      select 1 from public.cardforge_contributor_asset_submissions as submission where submission.lineage_id = lineage.id
    )
    and (
      lineage.registry_asset_id is null
      or not exists (
        select 1 from public.cardforge_asset_registry as registry where registry.asset_id = lineage.registry_asset_id
      )
    );
  return old;
end;
$$;
create or replace function public.cardforge_cleanup_pipeline_asset_lineage_after_registry_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.registry_asset_id = old.asset_id
    and lineage.upload_source_path is null
    and not exists (
      select 1 from public.cardforge_contributor_asset_submissions as submission where submission.lineage_id = lineage.id
    );
  return old;
end;
$$;

revoke all on function public.cardforge_guard_pipeline_upload_history() from public,anon,authenticated;
grant execute on function public.cardforge_guard_pipeline_upload_history() to service_role;

revoke all on function public.cardforge_reserve_pipeline_upload(text,jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_reserve_pipeline_upload(text,jsonb) to service_role;

revoke all on function public.cardforge_prepare_pipeline_upload_submission(text,text,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.cardforge_prepare_pipeline_upload_submission(text,text,jsonb,jsonb,boolean) to service_role;

revoke all on function public.cardforge_guard_pipeline_upload_source() from public,anon,authenticated;
grant execute on function public.cardforge_guard_pipeline_upload_source() to service_role;

revoke all on function public.cardforge_commit_pipeline_upload_submission(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_commit_pipeline_upload_submission(text,uuid,jsonb) to service_role;

revoke all on function public.cardforge_claim_pipeline_upload_cleanup(text,text) from public,anon,authenticated;
grant execute on function public.cardforge_claim_pipeline_upload_cleanup(text,text) to service_role;

revoke all on function public.cardforge_finalize_pipeline_upload_cleanup(text,uuid) from public,anon,authenticated;
grant execute on function public.cardforge_finalize_pipeline_upload_cleanup(text,uuid) to service_role;

commit;
