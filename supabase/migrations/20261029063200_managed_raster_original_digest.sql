-- Fresh accepted managed raster original source digest; legacy stays unproven.
begin;
set local lock_timeout='5s';
alter table public.cardforge_contributor_asset_submissions add column source_content_sha256 text;
alter table public.cardforge_contributor_asset_submissions add constraint cardforge_source_original_digest_check check
 (source_content_sha256 is null or source_content_sha256 ~ '^[a-f0-9]{64}$');
create or replace function public.cardforge_prepare_pipeline_upload_submission(p_actor text,p_path text,p_descriptor jsonb,p_request jsonb,p_claim boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=p_path for update nowait;
 if not found then raise exception 'pipeline_upload_legacy_uncertainty'; end if;
 if l.upload_contributor_id is distinct from p_actor then raise exception 'pipeline_upload_not_permitted'; end if;
 if l.upload_descriptor is distinct from p_descriptor then raise exception 'pipeline_upload_identity_conflict'; end if;
 if l.purge_state is not null or l.catalog_destructive_uncertainty is not null or l.catalog_trashed_at is not null then raise exception 'pipeline_upload_prior_commitment'; end if;
 if l.upload_state='owned' then
   if (l.upload_request-'source_content_sha256') is distinct from (p_request-'source_content_sha256') or not exists(select 1 from public.cardforge_contributor_asset_submissions where id=l.upload_submission_id) then
     raise exception 'pipeline_upload_identity_conflict'; end if;
   return jsonb_build_object('state','owned','submissionId',l.upload_submission_id);
 end if;
 if l.upload_state='submitting' then raise exception 'pipeline_upload_submission_uncertain'; end if;
 if l.upload_state<>'pending' then raise exception 'pipeline_upload_cleanup_committed'; end if;
 if p_request->>'contributor_id' is distinct from p_actor or p_request->>'asset_type' is distinct from p_descriptor->>'assetType'
   or p_request->>'source_storage_bucket' is distinct from 'cardforge-contributor-assets'
   or p_request->>'source_storage_path' is distinct from p_path then raise exception 'pipeline_upload_identity_conflict'; end if;
 if not p_claim then return jsonb_build_object('state','pending'); end if;
 if p_descriptor->>'assetType'='imageAssets' and p_descriptor->>'transportExtension' in ('png','jpg','webp')
   and coalesce(p_request->>'source_content_sha256','') !~ '^[a-f0-9]{64}
 update public.cardforge_pipeline_asset_lineages set upload_state='submitting',upload_operation_token=gen_random_uuid(),upload_request=p_request where id=l.id returning * into l;
 return jsonb_build_object('state','submitting','token',l.upload_operation_token,'lineageId',l.id);
end $$; then raise exception 'pipeline_upload_source_digest_missing'; end if;
 update public.cardforge_pipeline_asset_lineages set upload_state='submitting',upload_operation_token=gen_random_uuid(),upload_request=p_request where id=l.id returning * into l;
 return jsonb_build_object('state','submitting','token',l.upload_operation_token,'lineageId',l.id);
end $$;
create or replace function public.cardforge_guard_pipeline_upload_source() returns trigger
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 if tg_op='UPDATE' and new.source_content_sha256 is distinct from old.source_content_sha256
   then raise exception 'pipeline_upload_identity_conflict'; end if;
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
create or replace function public.cardforge_commit_pipeline_upload_submission(p_path text,p_token uuid,p_fields jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; result uuid;
begin
 select * into l from public.cardforge_pipeline_asset_lineages where upload_source_path=p_path for update nowait;
 if not found or p_token is null or l.upload_operation_token is distinct from p_token or l.upload_state not in ('submitting','owned') then
   raise exception 'pipeline_upload_identity_conflict'; end if;
 if l.purge_state is not null or l.catalog_destructive_uncertainty is not null or l.catalog_trashed_at is not null then raise exception 'pipeline_upload_prior_commitment'; end if;
 if (p_fields-'source_file_size_bytes') is distinct from (l.upload_request-'source_file_size_bytes')
    or jsonb_typeof(p_fields->'source_file_size_bytes') is distinct from 'number'
    or (l.upload_descriptor->>'assetType'='imageAssets' and l.upload_descriptor->>'transportExtension' in ('png','jpg','webp')
      and (coalesce(p_fields->>'source_content_sha256','') !~ '^[a-f0-9]{64}
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
 source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,source_upload_token,source_content_sha256,
 status,automated_status,calculated_access_tier,automated_access_tier,quality_score,tier_decision_reason,positive_votes,negative_votes)
 select l.id,x.contributor_id,x.contributor_email,x.asset_type,x.requested_studio_destination,x.specialty_tags,x.use_case_tags,
 x.semantic_role,x.visual_family,x.variant_kind,x.variant_label,x.compatibility_tags,x.name,x.description,x.source_notes,x.preview_url,x.source_url,
 x.source_file_size_bytes,x.source_mime_type,x.source_storage_bucket,x.source_storage_path,p_token,x.source_content_sha256,
 'voting','voting','contributor','contributor',0,'needs_more_votes',0,0
 from jsonb_populate_record(null::public.cardforge_contributor_asset_submissions,p_fields) x returning id into result;
 update public.cardforge_pipeline_asset_lineages set upload_state='owned',upload_submission_id=result,
   upload_committed_size=(p_fields->>'source_file_size_bytes')::bigint where id=l.id;
 return result;
end $$;
        or p_fields->>'source_content_sha256' is distinct from l.upload_request->>'source_content_sha256'))
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

-- This function validates the submitted exact owner source under the same
-- PostgreSQL transaction that creates the ordinary Template revision.
create function public.cardforge_verified_raster_adoption(p_payload jsonb,p_requested jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
  published public.cardforge_contributor_asset_submissions%rowtype;
  original public.cardforge_contributor_asset_submissions%rowtype;
  element jsonb; found_count integer; matched boolean; original_hash text; webp_hash text;
begin
 if p_requested is null or jsonb_typeof(p_requested)<>'object'
    or nullif(p_requested->>'assetId','') is null
    or (p_requested->>'submissionId') !~ '^[a-f0-9-]{36}$'
    or nullif(p_requested->>'elementId','') is null
    or (p_requested->>'normalizedSha256') !~ '^[a-f0-9]{64}$'
    or (p_requested->>'originalSha256') !~ '^[a-f0-9]{64}$'
    then raise exception 'raster_adoption_identity_invalid'; end if;
 select * into published from public.cardforge_contributor_asset_submissions
   where id=(p_requested->>'submissionId')::uuid for share;
 if not found or published.lineage_id is null or published.asset_type<>'imageAssets'
   or published.status<>'published' or published.published_at is null
   or published.target_registry_asset_id is distinct from p_requested->>'assetId'
   then raise exception 'raster_adoption_source_changed'; end if;
 select * into l from public.cardforge_pipeline_asset_lineages where id=published.lineage_id for update nowait;
 select * into r from public.cardforge_asset_registry where asset_id=p_requested->>'assetId' for share;
 if l.id is null or r.asset_id is null or r.asset_type<>'image' or r.status<>'published' or r.access_tier<>'free'
   or r.contributor_submission_id is distinct from published.id
   or l.registry_asset_id is distinct from r.asset_id
   or l.upload_state<>'owned' or l.upload_submission_id is null
   or l.upload_operation_token is null or l.upload_request is null
   or l.upload_source_path is distinct from published.source_storage_path
   or l.catalog_trashed_at is not null or l.purge_state is not null
   or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
   or l.catalog_destructive_uncertainty is not null
   then raise exception 'raster_adoption_source_changed'; end if;
 select * into original from public.cardforge_contributor_asset_submissions
   where id=l.upload_submission_id for share;
 if original.id is null or original.lineage_id is distinct from l.id
   or original.source_upload_token is distinct from l.upload_operation_token
   or original.source_storage_bucket is distinct from published.source_storage_bucket
   or original.source_storage_path is distinct from published.source_storage_path
   or original.source_storage_bucket<>'cardforge-contributor-assets'
   or original.source_storage_path not like 'pipeline-owned-v1/%'
   or original.source_content_sha256 is null
   or original.source_content_sha256 is distinct from p_requested->>'originalSha256'
   or published.source_mime_type not in ('image/png','image/jpeg','image/webp')
   then raise exception 'raster_adoption_source_changed'; end if;
 webp_hash:=p_requested->>'normalizedSha256';
 if not exists(select 1 from public.cardforge_pipeline_template_assets a where a.asset_id=webp_hash
   and a.storage_path='template-assets/'||webp_hash||'.webp' and a.mime_type='image/webp')
   then raise exception 'raster_adoption_normalized_unavailable'; end if;
 if jsonb_typeof(p_payload->'freeformCanvas'->'elements') is distinct from 'array'
   then raise exception 'raster_adoption_slot_unsupported'; end if;
 select count(*),coalesce(bool_and(value->>'type'='image'
     and value->>'imageSource'='cardforge-pipeline-asset://'||webp_hash
     and coalesce(value->>'content','') !~ '\{\{'),false)
 into found_count,matched from jsonb_array_elements(p_payload->'freeformCanvas'->'elements') value
 where value->>'id'=p_requested->>'elementId';
 if found_count<>1 or not matched or exists(
   select 1 from jsonb_array_elements(coalesce(p_payload->'fieldContracts','[]'::jsonb)) c
   where c->>'type'='image' and c->>'elementId'=p_requested->>'elementId')
   then raise exception 'raster_adoption_slot_unsupported'; end if;
 if p_payload->'templatePreviewData' is not null and p_payload->'templatePreviewData'<>'{}'::jsonb
   then raise exception 'raster_adoption_slot_unsupported'; end if;
 return jsonb_build_object('contractVersion',1,'assetId',r.asset_id,'lineageId',l.id,
  'submissionId',published.id,'revisionNumber',published.revision_number,
  'originalUploadId',original.id,'originalSha256',original.source_content_sha256,
  'normalizedSha256',webp_hash,'elementId',p_requested->>'elementId');
end $$;

-- The persisted interpretation is tied to the exact new submission/payload.
-- It is not a caller-supplied digest and is not a second asset registry.
create function public.cardforge_raster_binding_valid(p_source jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare b jsonb:=p_source->'catalog_dependencies'->'managedRaster';
  payload jsonb:=p_source->'source_payload'; id text; replacements jsonb; cleaned jsonb;
begin
 if jsonb_typeof(b)<>'object' or b->>'contractVersion'<>'1'
   or b->>'consumerSubmissionId' is distinct from p_source->>'id'
   or b->>'sourceBinding' !~ '^[a-f0-9]{64}$'
   or b->>'normalizedSha256' !~ '^[a-f0-9]{64}$'
   or b->>'originalSha256' !~ '^[a-f0-9]{64}$'
   or b->>'assetId' is null or b->>'lineageId' is null or b->>'submissionId' is null
   or b->>'elementId' is null
   or b->>'sourceBinding' is distinct from encode(extensions.digest(
     pg_catalog.jsonb_build_object('submissionId',p_source->>'id','payload',payload,
     'adoption',b-'sourceBinding')::text,'sha256'),'hex')
   then return false; end if;
 if jsonb_typeof(payload->'freeformCanvas'->'elements')<>'array' then return false; end if;
 id:=b->>'elementId';
 select jsonb_agg(case when value->>'id'=id then
      jsonb_set(value,'{imageSource}','""'::jsonb,true) else value end)
 into replacements from jsonb_array_elements(payload->'freeformCanvas'->'elements') value;
 if (select count(*) from jsonb_array_elements(payload->'freeformCanvas'->'elements') value
      where value->>'id'=id and value->>'type'='image'
      and value->>'imageSource'='cardforge-pipeline-asset://'||(b->>'normalizedSha256'))<>1
   then return false; end if;
 cleaned:=jsonb_set(payload,'{freeformCanvas,elements}',replacements,false);
 return public.cardforge_catalog_consumer_inspectable(cleaned,'template');
end $$;

create function public.cardforge_author_template_managed_raster(
 p_kind text,p_asset_id text,p_name text,p_description text,
 p_contributor_id text,p_contributor_email text,p_template_payload jsonb,
 p_expected_revision integer,p_submission_key text,p_adoption jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare verified jsonb; result uuid; bound jsonb; existing jsonb;
begin
 if p_kind not in ('draft','submit','owner') then raise exception 'raster_adoption_action_invalid'; end if;
 -- Same canonical ordering as catalog recovery and Pipeline writers. Protect
 -- the exact selected lineage while the standard Template operation commits.
 perform pg_advisory_xact_lock(hashtextextended('cardforge-contributor-pipeline',0));
 verified:=public.cardforge_verified_raster_adoption(p_template_payload,p_adoption);
 if p_kind='draft' then
   result:=public.cardforge_create_template_pipeline_draft(p_asset_id,p_name,p_contributor_id,
     p_contributor_email,p_template_payload,p_submission_key);
 elsif p_kind='owner' then
   result:=public.cardforge_publish_owner_template_revision(p_asset_id,p_name,p_description,
     p_contributor_id,p_contributor_email,p_template_payload,p_expected_revision,p_submission_key);
 else
   result:=public.cardforge_submit_template_revision(p_asset_id,p_name,p_description,
     p_contributor_id,p_contributor_email,p_template_payload,p_expected_revision,p_submission_key);
 end if;
 bound:=verified||jsonb_build_object('consumerSubmissionId',result);
 bound:=bound||jsonb_build_object('sourceBinding',encode(extensions.digest(
   pg_catalog.jsonb_build_object('submissionId',result,'payload',p_template_payload,
    'adoption',bound)::text,'sha256'),'hex'));
 select s.catalog_dependencies into existing from public.cardforge_contributor_asset_submissions s where s.id=result for update;
 if existing is not null and existing->'managedRaster' is distinct from bound
   then raise exception 'raster_adoption_revision_conflict'; end if;
 update public.cardforge_contributor_asset_submissions
 set catalog_dependencies=jsonb_build_object('managedRaster',bound)
 where id=result and source_payload=p_template_payload;
 if not found then raise exception 'raster_adoption_revision_conflict'; end if;
 return result;
end $$;

revoke all on function public.cardforge_verified_raster_adoption(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.cardforge_raster_binding_valid(jsonb) from public,anon,authenticated;
revoke all on function public.cardforge_author_template_managed_raster(text,text,text,text,text,text,jsonb,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_verified_raster_adoption(jsonb,jsonb) to service_role;
grant execute on function public.cardforge_raster_binding_valid(jsonb) to service_role;
grant execute on function public.cardforge_author_template_managed_raster(text,text,text,text,text,text,jsonb,integer,text,jsonb) to service_role;


-- Reuse the established native admission guard; bound identity references
-- fence Trash, while legacy/unproven history remains opaque.
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
  ids:=array_remove(array[r.asset_id,l.id::text],null)||array(select id::text from public.cardforge_contributor_asset_submissions where lineage_id=l.id);
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
  -- Sets require a source-owner interpretation bound to the exact immutable
  -- package publication. Legacy URL/hash-only rows remain opaque.
  for consumer in select a.*,s.source_payload,to_jsonb(s) set_source from public.cardforge_asset_registry a
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
    if public.cardforge_catalog_consumer_mentions(payload,ids,sources)
      or (consumer.asset_type='set' and public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',consumer.preview_url),ids,sources)) then referenced:=true; end if;
    if consumer.asset_type='set' then
      if public.cardforge_set_dependency_binding_valid(consumer.set_source)
        and consumer.url=consumer.set_source->>'source_url'
        and consumer.storage_bucket=consumer.set_source->>'source_storage_bucket'
        and consumer.storage_path=consumer.set_source->>'source_storage_path' then
        if public.cardforge_studio_dependencies_mention(consumer.set_source->'catalog_dependencies'->'references',ids,sources)
          or public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',consumer.preview_url),ids,sources) then referenced:=true; end if;
        if consumer.set_source->'catalog_dependencies'->'complete' is distinct from 'true'::jsonb then opaque:=true; end if;
      else opaque:=true; end if;
    elsif consumer.asset_type='template' and public.cardforge_raster_binding_valid(consumer.set_source) then
      if consumer.set_source->'catalog_dependencies'->'managedRaster'->>'assetId'=any(ids)
        or consumer.set_source->'catalog_dependencies'->'managedRaster'->>'lineageId'=any(ids)
        or consumer.set_source->'catalog_dependencies'->'managedRaster'->>'submissionId'=any(ids)
      then referenced:=true; end if;
    elsif not public.cardforge_catalog_consumer_inspectable(payload,
      case when consumer.asset_type='elementPreset' then 'style' else 'template' end) then opaque:=true; end if;
  end loop;

  -- Unpublished and historical native payloads remain consumers. A linked
  -- legacy NULL Style was inspected through its authoritative registry above;
  -- never substitute that current metadata for an unlinked historical revision.
  for consumer in select s.* from public.cardforge_contributor_asset_submissions s
    where s.lineage_id is distinct from l.id
      and not exists(select 1 from public.cardforge_asset_registry a where a.contributor_submission_id=s.id
        and a.asset_type in ('elementPreset','template','set')) loop
    if public.cardforge_catalog_consumer_mentions(consumer.source_payload,ids,sources)
      or (consumer.asset_type='sets' and public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',consumer.preview_url),ids,sources)) then referenced:=true; end if;
    if consumer.asset_type in ('elementPresets','templates','sets') then
      if consumer.asset_type='sets' then
        if public.cardforge_set_dependency_binding_valid(to_jsonb(consumer)) then
          if public.cardforge_studio_dependencies_mention(consumer.catalog_dependencies->'references',ids,sources) then referenced:=true; end if;
          if consumer.catalog_dependencies->'complete' is distinct from 'true'::jsonb then opaque:=true; end if;
        else opaque:=true; end if;
      elsif consumer.asset_type='templates' and public.cardforge_raster_binding_valid(to_jsonb(consumer)) then
        if consumer.catalog_dependencies->'managedRaster'->>'assetId'=any(ids)
          or consumer.catalog_dependencies->'managedRaster'->>'lineageId'=any(ids)
          or consumer.catalog_dependencies->'managedRaster'->>'submissionId'=any(ids)
        then referenced:=true; end if;
      elsif not public.cardforge_catalog_consumer_inspectable(consumer.source_payload,
        case when consumer.asset_type='elementPresets' then 'style' else 'template' end) then opaque:=true; end if;
    elsif consumer.source_payload is not null then
      -- No negative proof for an unsupported payload kind.
      opaque:=true;
    end if;
  end loop;
  if referenced then reasons:=array_append(reasons,'pipeline_identity_consumer_requires_resolution'); end if;

  -- Inspect the proven source-contained Studio subset in the existing SHARE-
  -- locked mutation transaction; never consume an earlier service-side scan.
  for consumer in select document_payload,revision,catalog_dependencies from public.cardforge_studio_documents loop
    if public.cardforge_catalog_consumer_mentions(consumer.document_payload,ids,sources)
      or (public.cardforge_studio_dependency_binding_valid(consumer.document_payload,consumer.revision,consumer.catalog_dependencies)
        and public.cardforge_studio_dependencies_mention(consumer.catalog_dependencies->'references',ids,sources)) then
      if not ('studio_identity_consumer_requires_resolution'=any(reasons)) then
        reasons:=array_append(reasons,'studio_identity_consumer_requires_resolution');
      end if;
    elsif not public.cardforge_studio_dependency_binding_valid(consumer.document_payload,consumer.revision,consumer.catalog_dependencies)
      or consumer.catalog_dependencies->'complete' is distinct from 'true'::jsonb then opaque:=true;
    end if;
  end loop;
  if opaque then reasons:=array_append(reasons,'json_consumer_inventory_unverified'); end if;
  return reasons;
end $$;
commit;
