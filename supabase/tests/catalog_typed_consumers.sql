-- Rollback-only; the existing runner verifies disposable local Docker identity
-- and empty catalog before this fixture. Never clear shared/hosted inventory.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
declare
 l uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid();
 asset text:='typed-target-'||l::text; style_id text:='typed-style-'||l::text;
 style jsonb:='{"id":"unrelated-style","name":"Unrelated","kind":"material","targets":["shape"],"appearance":{"material":{"baseColor":"#ffcc00","texture":{"kind":"parchment","intensity":55}}}}';
 template jsonb:='{"id":"unrelated-template","name":"Unrelated","aspectRatio":"2:3","freeformCanvas":{"width":300,"height":450,"elements":[]}}';
 payload jsonb; reasons jsonb; snapshot jsonb; next_state jsonb; document_id uuid:=gen_random_uuid();
 key text;
begin
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'typed_fixture_requires_isolated_empty_catalog'; end if;
 if has_function_privilege('anon','public.cardforge_catalog_consumer_inspectable(jsonb,text,integer)','EXECUTE')
   or has_function_privilege('authenticated','public.cardforge_catalog_consumer_mentions(jsonb,text[],text[],text,integer)','EXECUTE') then
   raise exception 'typed_inspection_browser_privileges'; end if;
 if not public.cardforge_catalog_consumer_inspectable(style,'style') or not public.cardforge_catalog_consumer_inspectable(template,'template') then
   raise exception 'supported_source_contained_payload_rejected'; end if;
 foreach key in array array['updates','templateUpdates'] loop
   payload:=style||jsonb_build_object(key,jsonb_build_object('backgroundImageUrl','https://example.invalid/retained.svg'));
   if not public.cardforge_catalog_consumer_mentions(payload,array[asset],array['https://example.invalid/retained.svg']) then
     raise exception 'recipe_reference_missed: %',key; end if;
   if public.cardforge_catalog_consumer_inspectable(payload,'style') then raise exception 'external_recipe_cleared: %',key; end if;
 end loop;
 for payload in select value from jsonb_array_elements(jsonb_build_array(
   style||'{"updates":{"shapeKind":"not-a-shape"}}',
   style||'{"templateUpdates":{"unknownRendererExtension":true}}',
   style||'{"appearance":{"material":{"texture":{"kind":"uploaded","imageSource":"data:image/svg+xml;base64,AAAA"}}}}',
   style||'{"appearance":{"rawCss":{"backgroundImage":"var(--external-art)"}}}',
   style||'{"appearance":{"rawCss":{"backgroundImage":"url(https://example.invalid/retained.svg)"}}}',
   template||'{"freeformCanvas":{"width":300,"height":450,"elements":[null]}}',
   template||'{"fieldContracts":[{"id":"art","defaultValue":"./art.png"}]}',
   '{}'::jsonb, 'null'::jsonb
 )) loop
   if public.cardforge_catalog_consumer_inspectable(payload,case when payload?'targets' then 'style' else 'template' end) then
     raise exception 'opaque_or_malformed_payload_cleared: %',payload; end if;
 end loop;
 if not public.cardforge_catalog_consumer_mentions('{"appearance":{"rawCss":{"backgroundImage":"url(https://example.invalid/retained.svg)"}}}',array[asset],array['https://example.invalid/retained.svg']) then
   raise exception 'css_reference_not_recognized'; end if;
 if public.cardforge_catalog_consumer_mentions(jsonb_build_object('name',asset,'description',asset),array[asset],'{}') then raise exception 'display_name_is_not_dependency'; end if;

 insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water) values(l,asset,1);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
   values(asset,'Typed target','icon','https://example.invalid/retained.svg','published','free','contributor');
 insert into public.cardforge_contributor_asset_submissions
   (id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,calculated_access_tier,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url)
   values(target,l,'typed-proof','icons','Typed target','published','approved','free',asset,asset,1,now(),'https://example.invalid/retained.svg');
 update public.cardforge_asset_registry set contributor_submission_id=target where asset_id=asset;
 insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,calculated_access_tier,source_payload)
   values(legacy,'typed-proof','elementPresets','Legacy NULL style','published','free',null);
 insert into public.cardforge_asset_registry(asset_id,contributor_submission_id,name,asset_type,url,status,access_tier,library_source,metadata)
   values(style_id,legacy,'Legacy NULL style','elementPreset','https://example.invalid/not-fetched.json','published','free','official',jsonb_build_object('style',style));
 snapshot:=public.cardforge_read_catalog_trash(target);
 if snapshot->'entryReasons'<>'[]'::jsonb then raise exception 'unrelated_legacy_style_blocked: %',snapshot; end if;
 if (select source_payload from public.cardforge_contributor_asset_submissions where id=legacy) is not null then raise exception 'legacy_history_invented'; end if;
 -- The first runtime-valid metadata owner wins; later aliases cannot replace it.
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style,'elementPreset',style||jsonb_build_object('appearance',jsonb_build_object('assetSource',asset))) where asset_id=style_id;
 if public.cardforge_read_catalog_trash(target)->'entryReasons'<>'[]'::jsonb then raise exception 'unused_alias_substituted_for_style'; end if;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style||jsonb_build_object('appearance',jsonb_build_object('assetSource',asset))) where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'pipeline_identity_consumer_requires_resolution') then raise exception 'actual_identity_not_blocked'; end if;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style||'{"appearance":{"material":{"texture":{"kind":"uploaded","imageSource":"https://example.invalid/retained.svg"}}}}') where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'pipeline_identity_consumer_requires_resolution') then raise exception 'actual_source_not_blocked'; end if;
 update public.cardforge_asset_registry set metadata='{}' where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'external_fallback_cleared'; end if;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style) where asset_id=style_id;
 -- Runtime whitespace validity must not let native scan skip a real fallback.
 update public.cardforge_asset_registry set metadata=jsonb_build_object(
   'style',style||jsonb_build_object('id',E'\t'),
   'elementPreset',style||jsonb_build_object('appearance',jsonb_build_object('assetSource',asset))) where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'whitespace_alias_false_negative'; end if;
 update public.cardforge_contributor_asset_submissions set source_payload=style||jsonb_build_object('id',E'\t') where id=legacy;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style||jsonb_build_object('appearance',jsonb_build_object('assetSource',asset))) where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'whitespace_source_false_negative'; end if;

 for payload in select value from jsonb_array_elements(jsonb_build_array(
   style||jsonb_build_object('name',E'\n'),
   style||jsonb_build_object('id',chr(160)),
   style||jsonb_build_object('appearance',jsonb_build_object('material',jsonb_build_object('gradient',
     jsonb_build_object('type','linear','stops',jsonb_build_array(jsonb_build_object('id',E'\t','color','#fff','position',0))))))
 )) loop
   update public.cardforge_contributor_asset_submissions set source_payload=payload where id=legacy;
   if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then
     raise exception 'runtime_invalid_identity_or_stop_cleared_dependent_fallback'; end if;
 end loop;
 update public.cardforge_contributor_asset_submissions set source_payload=null where id=legacy;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style) where asset_id=style_id;

 insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,calculated_access_tier,source_payload)
   values(gen_random_uuid(),'typed-proof','templates','Unrelated native template','submitted','hidden',template);
 if public.cardforge_read_catalog_trash(target)->'entryReasons'<>'[]'::jsonb then raise exception 'unrelated_template_blocked'; end if;
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,metadata)
   values('opaque-set','Set','set','https://example.invalid/inaccessible.cardforge','published','free','contributor',jsonb_build_object('template',template));
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'set_summary_used_as_decoded_package'; end if;
 delete from public.cardforge_asset_registry where asset_id='opaque-set';
 insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload)
   values(document_id,'typed-proof','Independent',jsonb_build_object('assetId',asset));
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'studio_identity_consumer_requires_resolution') then raise exception 'independent_studio_reference_missed'; end if;
 delete from public.cardforge_studio_documents where id=document_id;
 -- Positive admission still does not authorize expiry or skip exact-state CAS.
 next_state:=public.cardforge_change_catalog_trash('typed-owner','trash',snapshot->'state');
 if next_state->'reasons'='[]'::jsonb then raise exception 'typed_scan_enabled_physical_expiry'; end if;
 begin
   perform public.cardforge_change_catalog_trash('typed-owner','restore',snapshot->'state');
   raise exception 'stale_state_allowed';
 exception when raise_exception then if sqlerrm<>'catalog_trash_state_changed' then raise; end if; end;
 perform public.cardforge_change_catalog_trash('typed-owner','restore',next_state->'state');
 update public.cardforge_contributor_asset_submissions set source_storage_bucket='test',source_storage_path='retained.svg' where id=target;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'upload_cleanup_commitment_unverified') then raise exception 'upload_worker_boundary_cleared'; end if;
 update public.cardforge_pipeline_asset_lineages set catalog_destructive_uncertainty='legacy_destructive_history_unverified' where id=l;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'legacy_destructive_history_unverified') then raise exception 'legacy_uncertainty_cleared'; end if;
 raise notice 'PASS typed native consumers: unrelated Style/Template, legacy NULL, precedence, identity/source, opaque Set/extensions, Studio, CAS, expiry and worker uncertainty';
end $$;
rollback;
