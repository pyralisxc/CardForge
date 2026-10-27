-- Only the existing verified disposable native runner; no Storage I/O.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='30s';
create function pg_temp.upload_request(actor text,path text) returns jsonb language sql as $$
 select jsonb_build_object('contributor_id',actor,'contributor_email',null,'asset_type','icons',
 'requested_studio_destination','element.icon','specialty_tags',jsonb_build_array('general'),'use_case_tags','[]'::jsonb,
 'semantic_role','icon','visual_family',null,'variant_kind','base','variant_label',null,'compatibility_tags','[]'::jsonb,
 'name','Native upload proof','description','','source_notes','','preview_url','https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/'||path,
 'source_url','https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/'||path,
 'source_file_size_bytes',100,'source_mime_type','image/svg+xml','source_storage_bucket','cardforge-contributor-assets','source_storage_path',path,
 'status','voting','automated_status','voting','owner_status_override',null,'calculated_access_tier','contributor','automated_access_tier','contributor',
 'owner_access_tier_override',null,'quality_score',0,'tier_decision_reason','needs_more_votes','positive_votes',0,'negative_votes',0);
$$;
do $$
declare
 descriptor jsonb:='{"assetType":"icons","fileName":"proof.svg","fileSizeBytes":100,"mimeType":"image/svg+xml","transportExtension":"cfsvg"}';
 reservation jsonb; path text; line uuid; request jsonb; commitment jsonb; token uuid; receipt uuid; sibling uuid; snapshot jsonb;
 cleanup_path text; cleanup_token uuid; second_path text; second_id uuid; claim uuid; legacy_line uuid:=gen_random_uuid();
begin
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'upload_fixture_requires_isolated_empty_catalog'; end if;
 if has_function_privilege('anon','public.cardforge_claim_pipeline_upload_cleanup(text,text)','EXECUTE')
   or has_function_privilege('authenticated','public.cardforge_reserve_pipeline_upload(text,jsonb)','EXECUTE') then raise exception 'upload_privilege_regression'; end if;
 reservation:=public.cardforge_reserve_pipeline_upload('upload-proof',descriptor); path:=reservation->>'storagePath';line:=(reservation->>'lineageId')::uuid;
 if path<>'pipeline-owned-v1/'||line::text||'/source.cfsvg' then raise exception 'raw_svg_transport_regression'; end if;
 request:=pg_temp.upload_request('upload-proof',path);
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('different',path,descriptor,request,true);
  raise exception 'wrong_actor_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_not_permitted' then raise; end if; end;
 commitment:=public.cardforge_prepare_pipeline_upload_submission('upload-proof',path,descriptor,request,true); token:=(commitment->>'token')::uuid;
 begin
  perform public.cardforge_claim_pipeline_upload_cleanup('upload-proof',path); raise exception 'cleanup_crossed_submission';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_cleanup_blocked' then raise; end if; end;
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('upload-proof',path,descriptor,request,true); raise exception 'second_normalization_authority';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_submission_uncertain' then raise; end if; end;
 receipt:=public.cardforge_commit_pipeline_upload_submission(path,token,request);
 if public.cardforge_commit_pipeline_upload_submission(path,token,request)<>receipt then raise exception 'lost_response_duplicate_receipt'; end if;
 if public.cardforge_prepare_pipeline_upload_submission('upload-proof',path,descriptor,request,false)->>'state'<>'owned' then raise exception 'committed_retry_unconfirmed'; end if;
 if (select count(*) from public.cardforge_contributor_asset_submissions where lineage_id=line)<>1 then raise exception 'duplicate_submission'; end if;
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('upload-proof',path,descriptor,request||'{"name":"changed"}',false); raise exception 'changed_retry_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 begin
  update public.cardforge_contributor_asset_submissions set source_storage_path='other' where id=receipt; raise exception 'source_escaped_ownership';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 begin
  insert into public.cardforge_contributor_asset_submissions(contributor_id,asset_type,name,source_url)
   values('upload-proof','icons','URL-only bypass',request->>'source_url'); raise exception 'url_only_bypass';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_identity_conflict' then raise; end if; end;
 -- A same-lineage presentation revision may retain the source, but its expiry
 -- cannot delete the original revision's exact object.
 insert into public.cardforge_contributor_asset_submissions(lineage_id,contributor_id,asset_type,name,source_url,source_storage_bucket,source_storage_path,
  status,trashed_at,purge_after,trash_reason)
 values(line,'upload-proof','icons','Shared source',request->>'source_url','cardforge-contributor-assets',path,'archived',now()-interval '32 days',now()-interval '1 day','expired') returning id into sibling;
 if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(sibling)) then raise exception 'shared_source_purge_claimed'; end if;

 update public.cardforge_pipeline_asset_lineages set registry_asset_id='native-upload-proof',revision_high_water=1 where id=line;
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,contributor_submission_id)
 values('native-upload-proof','Native upload proof','icon',request->>'source_url','published','free','contributor',receipt);
 update public.cardforge_contributor_asset_submissions set status='published',editorial_review_status='approved',published_at=now(),revision_number=1,
  registry_asset_id='native-upload-proof',target_registry_asset_id='native-upload-proof' where id=receipt;
 snapshot:=public.cardforge_read_catalog_trash(receipt);
 if snapshot->'entryReasons'<>'[]'::jsonb then raise exception 'fresh_owned_source_not_eligible: %',snapshot; end if;
 snapshot:=public.cardforge_change_catalog_trash('upload-owner','trash',snapshot->'state');
 if snapshot->'reasons'='[]'::jsonb then raise exception 'upload_proof_enabled_expiry'; end if;
 perform public.cardforge_change_catalog_trash('upload-owner','restore',snapshot->'state');

 cleanup_path:=public.cardforge_reserve_pipeline_upload('upload-proof',descriptor)->>'storagePath';
 cleanup_token:=public.cardforge_claim_pipeline_upload_cleanup('upload-proof',cleanup_path);
 -- Deliberately omit finalization: response loss, Storage uncertainty and failed
 -- finalization all retain the same committed exclusion, regardless of age.
 update public.cardforge_pipeline_asset_lineages set created_at=now()-interval '1 year' where upload_source_path=cleanup_path;
 begin
  perform public.cardforge_claim_pipeline_upload_cleanup('upload-proof',cleanup_path); raise exception 'lease_reissued';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_cleanup_blocked' then raise; end if; end;
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('upload-proof',cleanup_path,descriptor,pg_temp.upload_request('upload-proof',cleanup_path),true); raise exception 'cleanup_source_reused';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_cleanup_committed' then raise; end if; end;
 perform public.cardforge_finalize_pipeline_upload_cleanup(cleanup_path,cleanup_token);
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('upload-proof',cleanup_path,descriptor,pg_temp.upload_request('upload-proof',cleanup_path),true); raise exception 'late_signed_upload_recycled_path';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_cleanup_committed' then raise; end if; end;
 begin
  delete from public.cardforge_pipeline_asset_lineages where upload_source_path=cleanup_path; raise exception 'commitment_erased';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_history_retained' then raise; end if; end;

 second_path:=public.cardforge_reserve_pipeline_upload('upload-proof',descriptor)->>'storagePath';
 request:=pg_temp.upload_request('upload-proof',second_path);
 token:=(public.cardforge_prepare_pipeline_upload_submission('upload-proof',second_path,descriptor,request,true)->>'token')::uuid;
 second_id:=public.cardforge_commit_pipeline_upload_submission(second_path,token,request);
 update public.cardforge_contributor_asset_submissions set status='archived',trashed_at=now()-interval '32 days',purge_after=now()-interval '1 day',trash_reason='expired' where id=second_id;
 select claim_token into claim from public.cardforge_claim_pipeline_revision_purge_target(second_id);
 if claim is null then raise exception 'existing_revision_claim_disabled'; end if;
 begin
  perform public.cardforge_prepare_pipeline_upload_submission('upload-proof',second_path,descriptor,request,false); raise exception 'prior_worker_ignored';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_prior_commitment' then raise; end if; end;
 begin
  perform public.cardforge_claim_pipeline_upload_cleanup('upload-proof',second_path); raise exception 'prior_worker_cleanup';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_cleanup_blocked' then raise; end if; end;
 if not public.cardforge_finalize_pipeline_revision_purge(second_id,claim) then raise exception 'owned_source_finalizer_failed'; end if;
 if exists(select 1 from public.cardforge_contributor_asset_submissions where id=second_id)
   or not exists(select 1 from public.cardforge_pipeline_asset_lineages where upload_source_path=second_path
     and upload_submission_id=second_id and catalog_destructive_uncertainty='revision_purge_committed') then
   raise exception 'finalizer_erased_durable_source_history'; end if;
 insert into public.cardforge_pipeline_asset_lineages(id,catalog_destructive_uncertainty) values(legacy_line,'legacy_destructive_history_unverified');
 begin
  update public.cardforge_pipeline_asset_lineages set upload_source_path='pipeline-owned-v1/'||legacy_line::text||'/source.cfsvg',
   upload_contributor_id='upload-proof',upload_descriptor=descriptor,upload_state='pending' where id=legacy_line; raise exception 'legacy_cohort_fabricated';
 exception when raise_exception then if sqlerrm<>'pipeline_upload_legacy_uncertainty' then raise; end if; end;
 raise notice 'PASS exact-source upload reservation, response-loss receipt, cleanup commitment, shared source retention, positive new cohort, legacy and prior worker fences';
end $$;
rollback;
