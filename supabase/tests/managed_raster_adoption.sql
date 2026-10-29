-- Rollback-only source-owned proof on the existing isolated GitHub runner.
-- Synthetic Storage receipts test SQL commitment/fences; the real decoder
-- and content digest are separately exercised by Pipeline product tests.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
declare
 descriptor jsonb:='{"assetType":"imageAssets","fileName":"adopt.png","fileSizeBytes":100,"mimeType":"image/png","transportExtension":"png"}';
 reservation jsonb; line uuid; path text; request jsonb; token uuid; receipt uuid;
 target text:='raster-native-'||gen_random_uuid()::text;
 normalized text:=repeat('b',64); original text:=repeat('a',64);
 payload jsonb; selected jsonb; adopted uuid; bound jsonb; reasons text[];
begin
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'raster_adoption_fixture_requires_empty_catalog'; end if;
 reservation:=public.cardforge_reserve_pipeline_upload('raster-proof',descriptor);
 path:=reservation->>'storagePath'; line:=(reservation->>'lineageId')::uuid;
 request:=jsonb_build_object(
  'contributor_id','raster-proof','contributor_email',null,'asset_type','imageAssets',
  'requested_studio_destination',null,'specialty_tags','[]'::jsonb,'use_case_tags','[]'::jsonb,
  'semantic_role','artwork','visual_family',null,'variant_kind',null,'variant_label',null,
  'compatibility_tags','[]'::jsonb,'name','Native raster proof','description','','source_notes','',
  'preview_url','https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/'||path,
  'source_url','https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/'||path,
  'source_file_size_bytes',100,'source_mime_type','image/png',
  'source_storage_bucket','cardforge-contributor-assets','source_storage_path',path,
  'source_content_sha256',original);
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('raster-proof',path,descriptor,request-'source_content_sha256',true);
  raise exception 'raster_missing_digest_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_source_digest_missing' then raise; end if; end;
 token:=(public.cardforge_prepare_pipeline_upload_submission('raster-proof',path,descriptor,request,true)->>'token')::uuid;
 begin
  perform public.cardforge_commit_pipeline_upload_submission(path,token,request||jsonb_build_object('source_content_sha256',repeat('c',64)));
  raise exception 'raster_mutated_committed_digest';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 receipt:=public.cardforge_commit_pipeline_upload_submission(path,token,request);
 if (select source_content_sha256 from public.cardforge_contributor_asset_submissions where id=receipt) is distinct from original
   then raise exception 'raster_original_digest_not_committed'; end if;
 if public.cardforge_commit_pipeline_upload_submission(path,token,request) is distinct from receipt
   then raise exception 'raster_submission_retry_changed'; end if;
 update public.cardforge_pipeline_asset_lineages set registry_asset_id=target,revision_high_water=1 where id=line;
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,contributor_submission_id)
 values(target,'Native raster proof','image',request->>'source_url','published','free','contributor',receipt);
 update public.cardforge_contributor_asset_submissions
 set status='published',editorial_review_status='approved',published_at=now(),revision_number=1,
  registry_asset_id=target,target_registry_asset_id=target where id=receipt;
 insert into public.cardforge_pipeline_template_assets(asset_id,storage_bucket,storage_path,mime_type,byte_count)
 values(normalized,'cardforge-developer-assets','template-assets/'||normalized||'.webp','image/webp',100);
 payload:=jsonb_build_object('id','native-adopter','name','Native Adopter','aspectRatio','63:88',
   'freeformCanvas',jsonb_build_object('width',630,'height',880,'elements',jsonb_build_array(
     jsonb_build_object('id','art','name','Art','type','image','x',0,'y',0,'width',200,'height',200,'zIndex',0,
       'imageSource','cardforge-pipeline-asset://'||normalized,'content',''))));
 selected:=jsonb_build_object('assetId',target,'submissionId',receipt,'elementId','art',
   'originalSha256',original,'normalizedSha256',normalized);
 begin
  perform public.cardforge_verified_raster_adoption(payload,selected||jsonb_build_object('originalSha256',repeat('c',64)));
  raise exception 'spoofed_original_digest_accepted';
 exception when raise_exception then if sqlerrm<>'raster_adoption_source_changed' then raise; end if; end;
 begin
  perform public.cardforge_verified_raster_adoption(payload||jsonb_build_object('fieldContracts',
    '[{"key":"art","type":"image","elementId":"art"}]'::jsonb),selected);
  raise exception 'dynamic_field_admitted';
 exception when raise_exception then if sqlerrm<>'raster_adoption_slot_unsupported' then raise; end if; end;
 adopted:=public.cardforge_author_template_managed_raster('draft','native-adopter','Native Adopter','',
   'raster-proof',null,payload,0,'native-raster-adoption',selected);
 select catalog_dependencies->'managedRaster' into bound from public.cardforge_contributor_asset_submissions where id=adopted;
 if bound->>'sourceBinding' is null or bound->>'originalSha256' is distinct from original
   or bound->>'normalizedSha256' is distinct from normalized then raise exception 'raster_binding_not_atomic'; end if;
 if not public.cardforge_raster_binding_valid(to_jsonb((select s from public.cardforge_contributor_asset_submissions s where id=adopted)))
   then raise exception 'raster_binding_native_invalid'; end if;
 if public.cardforge_author_template_managed_raster('draft','native-adopter','Native Adopter','',
    'raster-proof',null,payload,0,'native-raster-adoption',selected) is distinct from adopted
   then raise exception 'raster_author_retry_changed'; end if;
 reasons:=public.cardforge_catalog_trash_entry_reasons(line);
 if not ('pipeline_identity_consumer_requires_resolution'=any(reasons))
   then raise exception 'raster_reference_fence_missing: %',reasons; end if;
 begin
  perform public.cardforge_author_template_managed_raster('draft','native-adopter','Native Adopter','',
    'raster-proof',null,payload,0,'native-raster-adoption',
    selected||jsonb_build_object('normalizedSha256',repeat('d',64)));
  raise exception 'raster_retry_changed_adoption_admitted';
 exception when raise_exception then if sqlerrm not in ('raster_adoption_normalized_unavailable','raster_adoption_revision_conflict') then raise; end if; end;
 raise notice 'PASS managed raster native digest/revision/ref fence';
end $$;
rollback;
