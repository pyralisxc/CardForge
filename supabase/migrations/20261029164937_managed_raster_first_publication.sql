-- Forward-only function replacement; no source history updates or privilege changes.
create or replace function public.cardforge_verified_raster_adoption(p_payload jsonb,p_requested jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
  published public.cardforge_contributor_asset_submissions%rowtype;
  original public.cardforge_contributor_asset_submissions%rowtype;
  published_ordinal integer; element jsonb; found_count integer; matched boolean; original_hash text; webp_hash text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'raster_adoption_isolation_unsupported'; end if;
 if p_requested is null or jsonb_typeof(p_requested) is distinct from 'object'
    or p_requested - array['assetId','submissionId','elementId','normalizedSha256','originalSha256','requestFingerprint'] <> '{}'::jsonb
    or nullif(p_requested->>'assetId','') is null
    or coalesce(p_requested->>'requestFingerprint','') !~ '^[a-f0-9]{64}$'
    or coalesce(p_requested->>'submissionId','') !~ '^[a-f0-9-]{36}$'
    or nullif(p_requested->>'elementId','') is null
    or coalesce(p_requested->>'normalizedSha256','') !~ '^[a-f0-9]{64}$'
    or coalesce(p_requested->>'originalSha256','') !~ '^[a-f0-9]{64}$'
    then raise exception 'raster_adoption_identity_invalid'; end if;
 select * into published from public.cardforge_contributor_asset_submissions
   where id=(p_requested->>'submissionId')::uuid;
 if not found or published.lineage_id is null or published.asset_type<>'imageAssets'
   or published.status<>'published' or published.published_at is null
   or published.registry_asset_id is distinct from p_requested->>'assetId'
   or (published.target_registry_asset_id is not null and published.target_registry_asset_id is distinct from p_requested->>'assetId')
   then raise exception 'raster_adoption_source_changed'; end if;
 select * into l from public.cardforge_pipeline_asset_lineages where id=published.lineage_id for update nowait;
 select * into published from public.cardforge_contributor_asset_submissions where id=published.id for share nowait;
 select * into r from public.cardforge_asset_registry where asset_id=p_requested->>'assetId' for share nowait;
 if jsonb_typeof(r.metadata->'revisionNumber') is distinct from 'number'
   or coalesce(r.metadata->>'revisionNumber','') !~ '^[1-9][0-9]{0,9}$'
   then raise exception 'raster_adoption_source_changed'; end if;
 if (r.metadata->>'revisionNumber')::numeric>2147483647 then raise exception 'raster_adoption_source_changed'; end if;
 published_ordinal := (r.metadata->>'revisionNumber')::integer;
 if l.id is null or r.asset_id is null
   or r.metadata->>'revisionId' is distinct from published.id::text
   or (published.revision_number is null and published_ordinal<>1)
   or (published.revision_number is not null and published.revision_number<>published_ordinal)
   or published.status is distinct from 'published' or published.published_at is null
   or published.lineage_id is distinct from l.id or published.registry_asset_id is distinct from r.asset_id
   or (published.target_registry_asset_id is not null and published.target_registry_asset_id is distinct from r.asset_id) or r.asset_type is distinct from 'image' or r.status is distinct from 'published' or r.access_tier is distinct from 'free'
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
   where id=l.upload_submission_id for share nowait;
 if original.id is null or original.lineage_id is distinct from l.id
   or original.source_upload_token is distinct from l.upload_operation_token
   or original.source_storage_bucket is distinct from published.source_storage_bucket
   or original.source_storage_path is distinct from published.source_storage_path
   or original.source_storage_bucket<>'cardforge-contributor-assets'
   or original.source_storage_path not like 'pipeline-owned-v1/%'
   or original.source_content_sha256 is null
   or original.source_content_sha256 is distinct from l.upload_request->>'source_content_sha256'
   or original.source_content_sha256 is distinct from p_requested->>'originalSha256'
   or coalesce(published.source_mime_type,'') not in ('image/png','image/jpeg','image/webp')
   then raise exception 'raster_adoption_source_changed'; end if;
 webp_hash:=p_requested->>'normalizedSha256';
 if not exists(select 1 from public.cardforge_pipeline_template_assets a where a.asset_id=webp_hash
   and a.storage_bucket='cardforge-contributor-assets' and a.storage_path='template-assets/'||webp_hash||'.webp' and a.mime_type='image/webp')
   then raise exception 'raster_adoption_normalized_unavailable'; end if;
 if jsonb_typeof(p_payload->'freeformCanvas'->'elements') is distinct from 'array'
   then raise exception 'raster_adoption_slot_unsupported'; end if;
 select count(*),coalesce(bool_and(value->>'type'='image'
     and value->>'imageSource'='cardforge-pipeline-asset://'||webp_hash
     and (not (value ? 'content') or value->>'content'='')),false)
 into found_count,matched from jsonb_array_elements(p_payload->'freeformCanvas'->'elements') value
 where value->>'id'=p_requested->>'elementId';
 if found_count<>1 or not matched or exists(
   select 1 from jsonb_array_elements(coalesce(p_payload->'fieldContracts','[]'::jsonb)) c
   where c->>'type'='image')
   then raise exception 'raster_adoption_slot_unsupported'; end if;
 if p_payload->'templatePreviewData' is not null and p_payload->'templatePreviewData'<>'{}'::jsonb
   then raise exception 'raster_adoption_slot_unsupported'; end if;
 return jsonb_build_object('contractVersion',1,'assetId',r.asset_id,'lineageId',l.id,
  'submissionId',published.id,'revisionNumber',published_ordinal,
  'originalUploadId',original.id,'originalSha256',original.source_content_sha256,
  'normalizedSha256',webp_hash,'elementId',p_requested->>'elementId');
end $$;
