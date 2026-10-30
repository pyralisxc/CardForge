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
 reservation jsonb; line uuid; path text; request jsonb; token uuid; receipt uuid; current_id uuid;
 target text:='raster-native-'||gen_random_uuid()::text;
 normalized text:=repeat('b',64); original text:=repeat('a',64);
 payload jsonb; selected jsonb; adopted uuid; bound jsonb; reasons text[]; legacy uuid; changed text; source_before jsonb; metadata_before jsonb; invalid_metadata jsonb;
begin
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'raster_adoption_fixture_requires_empty_catalog'; end if;
 reservation:=public.cardforge_reserve_pipeline_upload('raster-proof',descriptor);
 path:=reservation->>'storagePath'; line:=(reservation->>'lineageId')::uuid;
 request:=jsonb_build_object(
  'contributor_id','raster-proof','contributor_email',null,'asset_type','imageAssets',
  'requested_studio_destination',null,'specialty_tags','[]'::jsonb,'use_case_tags','[]'::jsonb,
  'semantic_role','picture','visual_family',null,'variant_kind','base','variant_label',null,
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

 if public.cardforge_prepare_pipeline_upload_submission('raster-proof',path,descriptor,request-'source_content_sha256',false)->>'state' is distinct from 'owned'
   then raise exception 'read_only_retry_failed'; end if;
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('raster-proof',path,descriptor,
    request||jsonb_build_object('source_content_sha256',repeat('c',64)),false);
  raise exception 'changed_retry_digest_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('raster-proof',path,descriptor,request-'source_content_sha256',true);
  raise exception 'claimed_retry_omitted_digest';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 foreach changed in array array[repeat('c',64),null] loop
  begin
   update public.cardforge_contributor_asset_submissions set source_content_sha256=changed where id=receipt;
   raise exception 'digest_mutation_admitted';
  exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 end loop;
 -- Digestless legacy rows never gain proof, even outside reserved paths.
 insert into public.cardforge_contributor_asset_submissions(contributor_id,asset_type,name,status)
 values('raster-proof','imageAssets','Legacy digestless','submitted') returning id into legacy;
 begin
  update public.cardforge_contributor_asset_submissions set source_content_sha256=original where id=legacy;
  raise exception 'legacy_digest_backfill_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 begin
  insert into public.cardforge_contributor_asset_submissions(contributor_id,asset_type,name,status,source_content_sha256)
  values('raster-proof','imageAssets','Forged digest','submitted',original);
  raise exception 'unowned_digest_insert_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 delete from public.cardforge_contributor_asset_submissions where id=legacy;
 perform public.cardforge_set_contributor_asset_owner_override(receipt,true,'published',true,'free','Disposable raster publication','raster-proof');
 select registry_asset_id into target from public.cardforge_contributor_asset_submissions where id=receipt;
 current_id:=receipt;
 select to_jsonb(s) into source_before from public.cardforge_contributor_asset_submissions s where id=receipt;
 if target is null or source_before->>'revision_number' is not null or source_before->>'target_registry_asset_id' is not null
   or source_before->>'published_at' is null then raise exception 'normal_first_publication_contract_changed'; end if;
 select metadata into metadata_before from public.cardforge_asset_registry where asset_id=target;
 if metadata_before->>'revisionId' is distinct from receipt::text or metadata_before->>'revisionNumber'<>'1'
   then raise exception 'native_publication_metadata_missing'; end if;
 insert into public.cardforge_pipeline_template_assets(asset_id,storage_bucket,storage_path,mime_type,byte_count)
 values(normalized,'cardforge-contributor-assets','template-assets/'||normalized||'.webp','image/webp',100);
 payload:=jsonb_build_object('id','native-adopter','name','Native Adopter','aspectRatio','63:88',
   'freeformCanvas',jsonb_build_object('width',630,'height',880,'elements',jsonb_build_array(
     jsonb_build_object('id','art','name','Art','type','image','x',0,'y',0,'width',200,'height',200,'zIndex',0,
       'imageSource','cardforge-pipeline-asset://'||normalized,'content',''))));
 selected:=jsonb_build_object('assetId',target,'submissionId',current_id,'elementId','art',
   'originalSha256',original,'normalizedSha256',normalized,'requestFingerprint',repeat('e',64));
 foreach invalid_metadata in array array[
   metadata_before||jsonb_build_object('revisionId',gen_random_uuid()),
   metadata_before||jsonb_build_object('revisionNumber',2),
   metadata_before||jsonb_build_object('revisionNumber',0),
   metadata_before||jsonb_build_object('revisionNumber','1'), metadata_before-'revisionId'
 ] loop
   begin
     update public.cardforge_asset_registry set metadata=invalid_metadata where asset_id=target;
     perform public.cardforge_verified_raster_adoption(payload,selected);
     raise exception 'invalid_registry_revision_admitted';
   exception when raise_exception then if sqlerrm<>'raster_adoption_source_changed' then raise; end if; end;
 end loop;
 begin
   update public.cardforge_asset_registry set contributor_submission_id=null where asset_id=target;
   perform public.cardforge_verified_raster_adoption(payload,selected);
   raise exception 'changed_pointer_admitted';
 exception when raise_exception then if sqlerrm<>'raster_adoption_source_changed' then raise; end if; end;
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
 exception when raise_exception then if sqlerrm not in ('raster_adoption_normalized_unavailable','raster_adoption_revision_conflict','template_revision_conflict') then raise; end if; end;

 begin
  update public.cardforge_contributor_asset_submissions set catalog_dependencies=null where id=adopted;
  raise exception 'bound_dependency_cleared';
 exception when raise_exception then if sqlerrm<>'raster_adoption_binding_immutable' then raise; end if; end;
 begin
  update public.cardforge_contributor_asset_submissions set source_payload=jsonb_set(source_payload,'{name}','"Changed"') where id=adopted;
  raise exception 'bound_payload_rewritten';
 exception when raise_exception then if sqlerrm<>'raster_adoption_binding_immutable' then raise; end if; end;
 legacy:=public.cardforge_create_template_pipeline_draft('legacy-unbound-template','Legacy unbound','raster-proof',null,
   '{"id":"legacy-unbound-template","name":"Legacy unbound"}', 'legacy-unbound-key');
 begin
  update public.cardforge_contributor_asset_submissions set catalog_dependencies=jsonb_build_object('managedRaster',bound) where id=legacy;
  raise exception 'legacy_dependency_backfill_admitted';
 exception when raise_exception then if sqlerrm<>'raster_adoption_binding_immutable' then raise; end if; end;
 if has_function_privilege('anon','public.cardforge_create_template_pipeline_draft(text,text,text,text,jsonb,text,jsonb)','EXECUTE')
   or has_function_privilege('authenticated','public.cardforge_submit_template_revision(text,text,text,text,text,jsonb,integer,text,jsonb)','EXECUTE') then
   raise exception 'adoption_privilege_expanded'; end if;
 if (select to_jsonb(s) from public.cardforge_contributor_asset_submissions s where id=receipt) is distinct from source_before
   then raise exception 'adoption_rewrote_source_history'; end if;
 raise notice 'PASS normal first-publication NULL ordinal/target, exact metadata, unchanged source';
 -- No public image-revision creation command exists yet. Seed only a distinct
 -- later candidate here, then use the actual publication owner. This is separate
 -- from the untouched first-publication journey proven above, not an authoring API.
 insert into public.cardforge_contributor_asset_submissions(
   lineage_id,contributor_id,asset_type,name,status,variant_kind,semantic_role,
   registry_asset_id,target_registry_asset_id,revision_number,base_revision_number,
   source_url,preview_url,source_storage_bucket,source_storage_path,source_mime_type,source_file_size_bytes)
 select lineage_id,contributor_id,asset_type,name,'submitted','base','picture',
   target,target,2,1,source_url,preview_url,source_storage_bucket,source_storage_path,source_mime_type,source_file_size_bytes
 from public.cardforge_contributor_asset_submissions where id=receipt returning id into current_id;
 perform public.cardforge_set_contributor_asset_owner_override(current_id,true,'published',true,'free','Later native raster proof','raster-proof');
 if (select upload_submission_id from public.cardforge_pipeline_asset_lineages where id=line) is distinct from receipt
   or (select source_content_sha256 from public.cardforge_contributor_asset_submissions where id=current_id) is not null
   or (select source_content_sha256 from public.cardforge_contributor_asset_submissions where id=receipt) is distinct from original
   then raise exception 'original_upload_receipt_changed'; end if;
 begin
   perform public.cardforge_verified_raster_adoption(payload,selected);
   raise exception 'historical_pointer_admitted';
 exception when raise_exception then if sqlerrm<>'raster_adoption_source_changed' then raise; end if; end;
 selected:=selected||jsonb_build_object('submissionId',current_id);
 bound:=public.cardforge_verified_raster_adoption(payload,selected);
 if bound->>'originalUploadId' is distinct from receipt::text
   or bound->>'submissionId' is distinct from current_id::text or bound->>'revisionNumber'<>'2'
   then raise exception 'later_publication_original_receipt_not_resolved'; end if;
 adopted:=public.cardforge_author_template_managed_raster('draft','native-later-adopter','Later Adopter','',
   'raster-proof',null,payload||jsonb_build_object('id','native-later-adopter'),0,'native-later-adoption',selected);
 if not public.cardforge_raster_binding_valid(to_jsonb((select s from public.cardforge_contributor_asset_submissions s where id=adopted)))
   then raise exception 'later_publication_binding_invalid'; end if;
 raise notice 'PASS distinct later publication uses original upload receipt; historical pointer rejected';
 raise notice 'PASS managed raster native digest/revision/ref fence';
end $$;
rollback;
