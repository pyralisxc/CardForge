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
commit;
