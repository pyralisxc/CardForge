-- Local disposable native runner only, rollback-only. No Storage operation.
begin;
set local role service_role;
set local lock_timeout='5s';
do $$
declare actor text:='set-source-native'; asset text:='set-source-proof'; package_hash text:=repeat('a',64);
 source_path text; source_url text; proof jsonb; row_value jsonb; altered jsonb; candidate uuid; again uuid; dependent uuid; pin text;
 target uuid:=gen_random_uuid(); target_asset text:='set-source-target'; reasons text[]; signature text;
begin
 if exists(select 1 from public.cardforge_asset_registry) or exists(select 1 from public.cardforge_studio_documents) then
   raise exception 'set_dependency_fixture_requires_empty_disposable_database'; end if;
 foreach signature in array array['public.cardforge_set_source_identity(jsonb)',
  'public.cardforge_set_dependency_binding_valid(jsonb)','public.cardforge_check_set_dependency_write(jsonb,jsonb)',
  'public.cardforge_guard_set_package_source()','public.cardforge_guard_set_registry_source()',
  'public.cardforge_publish_official_starter_set(text,text,text,text,text,text,text,bigint,text,text,text,text[],text[],text,jsonb)'] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
    then raise exception 'set_source_browser_privilege'; end if;
 end loop;
 insert into public.cardforge_contributor_profiles(clerk_user_id,status) values(actor,'active');
 source_path:='owner-defaults/sets/'||asset||'/'||package_hash||'.cardforge';
 source_url:='https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/'||source_path;
 proof:=jsonb_build_object('contractVersion',1,'packageSha256',package_hash,'fileSizeBytes',42,
  'projectRevision',repeat('b',64),'sourceManifest',jsonb_build_object('cardforgeProject',2,'projectRevision',repeat('b',64),'project','{}'::jsonb),
  'complete',true,'references','{"identities":[],"sources":[]}'::jsonb,'opaqueReasons','[]'::jsonb);
 candidate:=public.cardforge_publish_official_starter_set(asset,'Synthetic Set','Local source fixture',source_url,'',
 'cardforge-contributor-assets',source_path,42,package_hash,actor,'',array['games'],array['playing-cards'],'Synthetic',proof);
 -- Editorial readiness deliberately leaves bootstrap publication as a candidate.
 -- Use the existing native Owner command to publish this synthetic row before
 -- asserting registry-trigger safety; an UPDATE of zero rows proves nothing.
 if (select status from public.cardforge_contributor_asset_submissions where id=candidate) is distinct from 'publish_candidate'
 then raise exception 'set_fixture_expected_editorial_candidate'; end if;
 perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',true,'free','Synthetic Set native proof',actor);
 if (select status from public.cardforge_contributor_asset_submissions where id=candidate) is distinct from 'published'
 then raise exception 'set_fixture_owner_publication_missing'; end if;
 if not exists(select 1 from public.cardforge_asset_registry
   where asset_id=asset and asset_type='set' and contributor_submission_id=candidate)
 then raise exception 'set_fixture_registry_publication_missing'; end if;
 select to_jsonb(s) into row_value from public.cardforge_contributor_asset_submissions s where id=candidate;
 if not public.cardforge_set_dependency_binding_valid(row_value) then raise exception 'set_binding_not_created'; end if;
 again:=public.cardforge_publish_official_starter_set(asset,'Synthetic Set','Local source fixture',source_url,'',
 'cardforge-contributor-assets',source_path,42,package_hash,actor,'',array['games'],array['playing-cards'],'Synthetic',proof);
 if again<>candidate then raise exception 'set_retry_allocated_revision'; end if;
 foreach signature in array array['id','lineage_id','revision_number','source_url','source_storage_bucket','source_storage_path','source_file_size_bytes'] loop
  altered:=jsonb_set(row_value,array[signature],'"changed"');
  if public.cardforge_set_dependency_binding_valid(altered) then raise exception 'set_binding_ignored_identity: %',signature; end if;
 end loop;
 if public.cardforge_set_dependency_binding_valid(jsonb_set(row_value,'{catalog_dependencies,contractVersion}','2'))
   or public.cardforge_set_dependency_binding_valid(jsonb_set(row_value,'{catalog_dependencies,sourceManifest,project}','{"unknown":true}'))
   or public.cardforge_set_dependency_binding_valid(jsonb_set(row_value,'{catalog_dependencies,references,sources}','42'))
   or public.cardforge_set_dependency_binding_valid(jsonb_set(row_value,'{catalog_dependencies}', 'null'))
 then raise exception 'set_binding_ignored_interpretation'; end if;
 begin
  update public.cardforge_contributor_asset_submissions set source_url='https://example.invalid/mutable.cardforge' where id=candidate;
  raise exception 'set_source_mutated';
 exception when raise_exception then if sqlerrm<>'set_source_binding_immutable' then raise; end if; end;
 begin
  perform public.cardforge_publish_official_starter_set(asset,'Synthetic Set','Local source fixture',source_url,'',
   'cardforge-contributor-assets',source_path,42,package_hash,actor,'',array['games'],array['playing-cards'],'Synthetic',proof||'{"complete":false}');
  raise exception 'set_changed_retry_accepted';
 exception when raise_exception then if sqlerrm<>'set_package_retry_conflict' then raise; end if; end;
 begin
  update public.cardforge_contributor_asset_submissions set asset_type='icons',catalog_dependencies=null where id=candidate;
  raise exception 'bound_set_kind_erased';
 exception when raise_exception then if sqlerrm<>'set_source_binding_immutable' then raise; end if; end;
 begin
  update public.cardforge_asset_registry set asset_type='icon' where asset_id=asset;
  raise exception 'set_registry_kind_erased';
 exception when raise_exception then if sqlerrm<>'set_registry_kind_immutable' then raise; end if; end;
 -- A complete unrelated Set is not opaque solely because it is a Set.
 insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id) values(target,target_asset);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
 values(target_asset,'Target','icon','https://example.invalid/target.svg','published','free','contributor');
 reasons:=public.cardforge_catalog_trash_entry_reasons(target);
 if 'json_consumer_inventory_unverified'=any(reasons) then raise exception 'bound_unrelated_set_opaque'; end if;
 -- The same bound references are recognized without scanning arbitrary prose.
 if not public.cardforge_studio_dependencies_mention(jsonb_build_object('identities',jsonb_build_array(target_asset),'sources','[]'::jsonb),array[target_asset],'{}') then
  raise exception 'set_identity_reference_lost'; end if;
 -- An actual dependent bound publication blocks, then rolls back its isolated subcase.
 begin
  altered:=jsonb_set(proof,'{references,identities}',jsonb_build_array(target_asset));
  dependent:=public.cardforge_publish_official_starter_set('dependent-set','Dependent','Synthetic dependency',
   'https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/owner-defaults/sets/dependent-set/'||package_hash||'.cardforge','',
   'cardforge-contributor-assets','owner-defaults/sets/dependent-set/'||package_hash||'.cardforge',42,package_hash,actor,'',array['games'],array['playing-cards'],'Synthetic',altered);
  if (select status from public.cardforge_contributor_asset_submissions where id=dependent) is distinct from 'publish_candidate'
   then raise exception 'dependent_set_editorial_candidate_expected'; end if;
  perform public.cardforge_set_contributor_asset_owner_override(dependent,true,'published',true,'free','Synthetic dependent Set native proof',actor);
  if (select status from public.cardforge_contributor_asset_submissions where id=dependent) is distinct from 'published'
   then raise exception 'dependent_set_owner_publication_missing'; end if;
  if not exists(select 1 from public.cardforge_asset_registry
    where asset_id='dependent-set' and asset_type='set' and contributor_submission_id=dependent)
   then raise exception 'dependent_set_registry_pointer_missing'; end if;
  reasons:=public.cardforge_catalog_trash_entry_reasons(target);
  if not ('pipeline_identity_consumer_requires_resolution'=any(reasons)) then raise exception 'bound_set_reference_not_blocked'; end if;
  if not exists(select 1 from jsonb_array_elements(public.cardforge_catalog_trash_inventory_details(target)) detail
    where detail->>'payloadKind'='set' and detail->'conditions' ? 'target_identity_or_source_reference') then raise exception 'set_reference_diagnostic_lost'; end if;
  raise exception 'rollback_dependent_set_subcase';
 exception when raise_exception then if sqlerrm<>'rollback_dependent_set_subcase' then raise; end if; end;
 begin
  altered:=proof||'{"complete":false,"opaqueReasons":["external_or_unbound_source"]}';
  perform public.cardforge_publish_official_starter_set('opaque-set','Opaque','Synthetic opaque source',
   'https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/owner-defaults/sets/opaque-set/'||package_hash||'.cardforge','',
   'cardforge-contributor-assets','owner-defaults/sets/opaque-set/'||package_hash||'.cardforge',42,package_hash,actor,'',array['games'],array['playing-cards'],'Synthetic',altered);
  if not ('json_consumer_inventory_unverified'=any(public.cardforge_catalog_trash_entry_reasons(target))) then raise exception 'opaque_bound_set_admitted'; end if;
  raise exception 'rollback_opaque_set_subcase';
 exception when raise_exception then if sqlerrm<>'rollback_opaque_set_subcase' then raise; end if; end;
 begin
  update public.cardforge_contributor_asset_submissions set preview_url='https://example.invalid/target.svg' where id=candidate;
  -- Detach current registry pointer so this is the actual historical scan.
  update public.cardforge_asset_registry set contributor_submission_id=null where asset_id=asset;
  reasons:=public.cardforge_catalog_trash_entry_reasons(target);
  if not ('pipeline_identity_consumer_requires_resolution'=any(reasons)) then raise exception 'historical_set_preview_reference_lost'; end if;
  if not exists(select 1 from jsonb_array_elements(public.cardforge_catalog_trash_inventory_details(target)) detail
    where detail->>'recordId'=candidate::text and detail->'conditions' ? 'target_identity_or_source_reference') then raise exception 'historical_preview_diagnostic_lost'; end if;
  raise exception 'rollback_historical_preview_subcase';
 exception when raise_exception then if sqlerrm<>'rollback_historical_preview_subcase' then raise; end if; end;
 -- Legacy hash-only payload remains opaque and cannot be upgraded in place.
 insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,revision_number,source_payload)
 values(gen_random_uuid(),actor,'sets','Legacy mutable','submitted',1,'{"packageSha256":"old"}') returning id into again;
 reasons:=public.cardforge_catalog_trash_entry_reasons(target);
 if not ('json_consumer_inventory_unverified'=any(reasons)) then raise exception 'legacy_set_became_trusted'; end if;
 begin
  update public.cardforge_contributor_asset_submissions set catalog_dependencies=proof where id=again;
  raise exception 'legacy_set_proof_backfilled';
 exception when raise_exception then if sqlerrm<>'set_source_new_revision_required' then raise; end if; end;
 pin:=public.cardforge_media_parent_content_version(candidate);
 update public.cardforge_contributor_asset_submissions set owner_note='Metadata only' where id=candidate;
 if pin<>public.cardforge_media_parent_content_version(candidate) then raise exception 'operational_metadata_changed_parent_pin'; end if;
 raise notice 'PASS exact Set source binding, native retry, identity/manifest tamper, immutable source, unrelated inspection, legacy refusal and parent pin';
end $$;
rollback;
