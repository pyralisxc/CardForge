-- Existing disposable CI runner only; rollback records, no Storage or hosted targets.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $$
declare
 l uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); consumer_l uuid:=gen_random_uuid(); consumer uuid:=gen_random_uuid();
 other_l uuid:=gen_random_uuid(); other_consumer uuid:=gen_random_uuid(); corrected uuid:=gen_random_uuid();
 private_doc uuid:=gen_random_uuid(); unrelated uuid:=gen_random_uuid(); extra_doc uuid:=gen_random_uuid();
 other_asset text:='other-impact-'||other_l::text; asset text:='impact-'||l::text; consumer_asset text:='impact-template-'||consumer_l::text;
 source text:='https://example.invalid/'||l::text||'.svg'; payload jsonb; template jsonb; proof jsonb; snap jsonb; changed jsonb; before_payload jsonb;
 initial_version bigint; initial_updated timestamptz; draft uuid; document_revision integer;
begin
 -- Non-rendering canonical metadata never becomes an exact affected object.
 if public.cardforge_catalog_known_reference(jsonb_build_object('metadata',jsonb_build_object('url',source,'src',source,'source',source),'mcpOperationReceipts',jsonb_build_array(jsonb_build_object('url',source))),array[asset],array[source])
 then raise exception 'nonrendering_metadata_became_exact_dependency'; end if;
 if not public.cardforge_catalog_known_reference(jsonb_build_object('appearance',jsonb_build_object('rawCss',jsonb_build_object('backgroundImage','url('||chr(39)||source||chr(39)||')'))),array[asset],array[source])
 then raise exception 'single_quoted_css_image_not_recognized'; end if;
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'impact_fixture_requires_isolated_empty_catalog'; end if;
 insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water) values(l,asset,1),(consumer_l,consumer_asset,1),(other_l,other_asset,1);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
 values(asset,'Impact source','icon',source,'published','free','contributor');
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,
 owner_status_override,owner_access_tier_override,calculated_access_tier,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url)
 values(target,l,'source-author','icons','Impact source','published','approved','published','free','free',asset,asset,1,now(),source);
 update public.cardforge_asset_registry set contributor_submission_id=target where asset_id=asset;
 select revision_recovery_version,updated_at into initial_version,initial_updated from public.cardforge_contributor_asset_submissions where id=target;
 -- Actual private draft recovery invokes global rebalance. Unrelated automatic
 -- bookkeeping must not change the observed state of an unchanged live source.
 draft:=public.cardforge_create_template_pipeline_draft('no-churn-'||l::text,'No churn','draft-author','',jsonb_build_object('id','no-churn-'||l::text,'name','No churn'),'draft-'||l::text);
 snap:=public.cardforge_read_revision_recovery(draft,'draft-author',false);
 snap:=public.cardforge_change_revision_recovery('draft-author',false,'trash',snap->'state');
 perform public.cardforge_change_revision_recovery('draft-author',false,'restore',snap->'state');
 if (select revision_recovery_version from public.cardforge_contributor_asset_submissions where id=target) is distinct from initial_version
 or (select updated_at from public.cardforge_contributor_asset_submissions where id=target) is distinct from initial_updated
 then raise exception 'global_restore_churned_unrelated_recovery_state'; end if;
 -- Keep unrelated dynamic/external data: its coverage is not target dependence.
 payload:=jsonb_build_object('version',1,'userTemplates',jsonb_build_array(jsonb_build_object('id','unrelated','name','Unrelated','aspectRatio','2:3','templatePreviewData',jsonb_build_object('title','{{name}}'),'cardBackgroundImageUrl',source||'.other')));
 proof:=jsonb_build_object('contractVersion',1,'sourcePayload',payload,'complete',false,'references',jsonb_build_object('identities','[]'::jsonb,'sources',jsonb_build_array(source||'.other')),'opaqueReasons',jsonb_build_array('dynamic_binding','external_or_unbound_source'));
 insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values(unrelated,'private-other','Private unrelated',payload,proof);
 snap:=public.cardforge_read_catalog_trash(target);
 if jsonb_array_length(snap->'recoveryReasons')<>0 or (snap->'impact'->>'affectedCount')::int<>0
 or (snap->'impact'->>'coverageWarningCount')::int<1 then raise exception 'unrelated_opaque_document_globally_vetoed_reversible_trash: %',snap; end if;
 -- A literal in printable text is not artwork, even if legacy diagnostics
 -- conservatively report it. Source owner interpretation supplies typed refs.
 template:=jsonb_build_object('id','impact-consumer','name','Consumer','aspectRatio','2:3','freeformCanvas',jsonb_build_object('width',300,'height',450,'elements',jsonb_build_array(jsonb_build_object('id','image','name','Image','type','image','x',0,'y',0,'width',100,'height',100,'zIndex',0,'imageSource',source))));
 payload:=jsonb_build_object('version',1,'userTemplates',jsonb_build_array(template));
 proof:=jsonb_build_object('contractVersion',1,'sourcePayload',payload,'complete',false,'references',jsonb_build_object('identities','[]'::jsonb,'sources',jsonb_build_array(source)),'opaqueReasons',jsonb_build_array('external_or_unbound_source'));
 insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values(private_doc,'private-other','Private dependent',payload,proof);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source) values(consumer_asset,'Affected Template','template','https://example.invalid/template.json','published','free','contributor');
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_payload)
 values(consumer,consumer_l,'consumer-author','templates','Affected Template','published',consumer_asset,consumer_asset,1,now(),template);
 update public.cardforge_asset_registry set contributor_submission_id=consumer where asset_id=consumer_asset;
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source) values(other_asset,'Other affected Template','template','https://example.invalid/other-template.json','published','free','contributor');
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_payload)
 values(other_consumer,other_l,'other-author','templates','Other affected Template','published',other_asset,other_asset,1,now(),jsonb_set(template,'{id}','"other-consumer"'));
 update public.cardforge_asset_registry set contributor_submission_id=other_consumer where asset_id=other_asset;

 before_payload:=template;
 snap:=public.cardforge_read_revision_recovery(target,'source-author',false);
 if (snap->'impact'->>'privateAffectedCount')::int<>1 or (snap->'impact'->>'affectedCount')::int<>3
 or (snap->'impact')::text like '%'||private_doc::text||'%' or (snap->'impact')::text like '%Private dependent%'
 then raise exception 'private_dependency_identity_leaked_or_counts_wrong: %',snap->'impact'; end if;
 snap:=public.cardforge_read_catalog_trash(target);
 begin
 perform public.cardforge_change_catalog_trash('owner','trash',snap->'state');
 raise exception 'known_impacts_moved_without_confirmation';
 exception when raise_exception then if sqlerrm<>'catalog_trash_dependency_blocked' then raise; end if; end;
 -- A new committed exact dependency changes the native digest and rejects
 -- the old confirmation, even though target pointer/high-water stayed equal.
 insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values(extra_doc,'owner','Own dependent',payload,proof);
 begin
 perform public.cardforge_change_catalog_trash('owner','trash',snap->'state',null,snap->'impact'->>'fingerprint');
 raise exception 'stale_impact_confirmed';
 exception when raise_exception then if sqlerrm<>'catalog_trash_state_changed' then raise; end if; end;
 snap:=public.cardforge_read_catalog_trash(target);
 changed:=public.cardforge_change_catalog_trash('owner','trash',snap->'state',null,snap->'impact'->>'fingerprint');
 if changed->'state'->>'trashedAt' is null then raise exception 'confirmed_trash_not_committed'; end if;
 if exists(select 1 from public.cardforge_discoverable_asset_registry where asset_id=asset) then raise exception 'trashed_source_still_discoverable'; end if;
 if (select source_payload from public.cardforge_contributor_asset_submissions where id=consumer) is distinct from before_payload
 then raise exception 'trash_rewrote_authored_consumer'; end if;
 if not exists(select 1 from jsonb_array_elements(public.cardforge_pipeline_dependency_health()) f where f->>'submissionId'=consumer::text and f->>'objectId'=consumer_l::text and f->>'sourceAssetId'=asset)
 then raise exception 'affected_current_exact_object_missing_content_health'; end if;
 -- Bound incomplete unrelated updates remain usable; source bytes and old
 -- references can remain while a creator prepares an ordinary repair.
 update public.cardforge_studio_documents set revision=revision+1,catalog_dependencies=proof where id=private_doc;
 select revision into document_revision from public.cardforge_studio_documents where id=unrelated;
 select document_payload into payload from public.cardforge_studio_documents where id=unrelated;
 proof:=jsonb_build_object('contractVersion',1,'sourcePayload',payload,'complete',false,'references',jsonb_build_object('identities','[]'::jsonb,'sources',jsonb_build_array(source||'.other')),'opaqueReasons',jsonb_build_array('dynamic_binding','external_or_unbound_source'));
 update public.cardforge_studio_documents set revision=document_revision+1,catalog_dependencies=proof where id=unrelated;
 -- Removing one retained reference remains possible even while unrelated
 -- external content keeps the document interpretation incomplete.
 payload:=jsonb_build_object('version',1,'userTemplates',jsonb_build_array(jsonb_set(template,'{freeformCanvas,elements,0,imageSource}','"https://example.invalid/replacement.svg"')));
 proof:=jsonb_build_object('contractVersion',1,'sourcePayload',payload,'complete',false,'references',jsonb_build_object('identities','[]'::jsonb,'sources',jsonb_build_array('https://example.invalid/replacement.svg')),'opaqueReasons',jsonb_build_array('external_or_unbound_source'));
 update public.cardforge_studio_documents set document_payload=payload,revision=revision+1,catalog_dependencies=proof where id=private_doc;
 if exists(select 1 from public.cardforge_catalog_impact_rows(l) where record_id=private_doc::text and known) then raise exception 'repaired_private_reference_still_counted'; end if;
 -- A newly introduced exact source remains prohibited beside recoverable Trash.
 payload:=jsonb_build_object('version',1,'userTemplates',jsonb_build_array(template));
 proof:=jsonb_build_object('contractVersion',1,'sourcePayload',payload,'complete',false,'references',jsonb_build_object('identities','[]'::jsonb,'sources',jsonb_build_array(source)),'opaqueReasons',jsonb_build_array('external_or_unbound_source'));
 begin
 insert into public.cardforge_studio_documents(owner_user_id,title,document_payload,catalog_dependencies) values('owner','New reference prohibited',payload,proof);
 raise exception 'new_dependency_inserted_after_trash';
 exception when raise_exception then if sqlerrm<>'studio_catalog_reference_unavailable' then raise; end if; end;
 begin
 update public.cardforge_studio_documents set revision=revision+1,catalog_dependencies=null where id=private_doc;
 raise exception 'invalid_binding_inherited';
 exception when raise_exception then if sqlerrm<>'studio_catalog_dependency_unverified' then raise; end if; end;
 -- A corrected current immutable revision clears its own exact finding, not
 -- another object's dependency or the old revision's retained source bytes.
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_payload)
 values(corrected,consumer_l,'consumer-author','templates','Corrected Template','published',consumer_asset,consumer_asset,2,now(),jsonb_set(template,'{freeformCanvas,elements,0,imageSource}','"https://example.invalid/replacement.svg"'));
 update public.cardforge_asset_registry set contributor_submission_id=corrected where asset_id=consumer_asset;
 if exists(select 1 from jsonb_array_elements(public.cardforge_pipeline_dependency_health()) f where f->>'objectId'=consumer_l::text)
 or not exists(select 1 from jsonb_array_elements(public.cardforge_pipeline_dependency_health()) f where f->>'submissionId'=other_consumer::text)
 then raise exception 'repair_cleared_wrong_health_or_retained_old_pointer_finding'; end if;
 -- Restoration is a fresh read-through evaluation, not a blanket finding clear.
 snap:=public.cardforge_read_catalog_trash(target);
 perform public.cardforge_change_catalog_trash('owner','restore',snap->'state');
 if exists(select 1 from jsonb_array_elements(public.cardforge_pipeline_dependency_health()) f where f->>'sourceAssetId'=asset) then raise exception 'restore_did_not_reevaluate_available_source'; end if;
 -- The exact revision path uses the same fresh private-safe confirmation.
 snap:=public.cardforge_read_revision_recovery(target,'source-author',false);
 changed:=public.cardforge_change_revision_recovery('source-author',false,'trash',snap->'state',null,snap->'impact'->>'fingerprint');
 if changed->'state'->>'trashedAt' is null then raise exception 'confirmed_revision_trash_not_committed'; end if;
 begin
 insert into public.cardforge_studio_documents(owner_user_id,title,document_payload,catalog_dependencies) values('owner','New revision-trash reference prohibited',payload,proof);
 raise exception 'new_reference_inserted_after_revision_trash';
 exception when raise_exception then if sqlerrm<>'studio_catalog_reference_unavailable' then raise; end if; end;
 update public.cardforge_asset_registry set status='archived',access_tier='hidden' where asset_id=asset;
 if not exists(select 1 from jsonb_array_elements(public.cardforge_pipeline_dependency_health()) f where f->>'sourceAssetId'=asset) then raise exception 'nonpublished_source_blindly_cleared_health'; end if;
 if (select source_payload from public.cardforge_contributor_asset_submissions where id=consumer) is distinct from before_payload then raise exception 'health_projection_mutated_source'; end if;
 raise notice 'PASS dependency-aware recovery: private redaction, exact fresh impact confirmation, unrelated coverage, discoverability, retained references, repair saves, native insertion denial, read-through health and no-op history';
end $$;
rollback;
