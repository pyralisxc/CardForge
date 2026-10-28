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
   or has_function_privilege('authenticated','public.cardforge_catalog_consumer_inspectable(jsonb,text,integer)','EXECUTE')
   or has_function_privilege('anon','public.cardforge_catalog_consumer_mentions(jsonb,text[],text[],text,integer)','EXECUTE')
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
 -- Literal none is still a relative URL in typed source owners; CSS none is
 -- reserved for raw CSS properties that the renderer applies without url().
 for payload in select value from jsonb_array_elements(jsonb_build_array(
   style||'{"appearance":{"assetSource":"none"}}',
   style||'{"appearance":{"dividerAsset":"none"}}',
   style||'{"appearance":{"material":{"texture":{"kind":"parchment","assetSource":"none"}}}}',
   style||'{"appearance":{"material":{"texture":{"kind":"uploaded","imageSource":"none"}}}}',
   style||'{"updates":{"imageSource":"none"}}',
   style||'{"updates":{"iconImageSource":"none"}}',
   style||'{"updates":{"backgroundImageUrl":"none"}}',
   template||'{"cardBackgroundImageUrl":"none"}',
   template||'{"cardBorderImageSource":"none"}',
   style||'{"appearance":{"rawCss":{"borderImageSource":"none"}}}'
 )) loop
   if public.cardforge_catalog_consumer_inspectable(payload,case when payload?'targets' then 'style' else 'template' end)
     or public.cardforge_catalog_consumer_inspectable(jsonb_build_object('version',1,'userTemplates','[]'::jsonb,
       'appearanceStyles',jsonb_build_array(payload)),'studio') then raise exception 'typed_none_source_cleared'; end if;
 end loop;
 if not public.cardforge_catalog_consumer_inspectable(style||'{"appearance":{"rawCss":{"backgroundImage":"none"}}}','style') then raise exception 'raw_css_none_rejected'; end if;
 -- Border thickness has different dimensional semantics from canvas/elements.
 if not public.cardforge_catalog_consumer_inspectable(style||'{"appearance":{"border":{"kind":"none","width":0}}}', 'style')
   or not public.cardforge_catalog_consumer_inspectable(template||'{"appearance":{"border":{"kind":"none","width":0}}}', 'template') then
   raise exception 'native_zero_border_rejected'; end if;
 if public.cardforge_catalog_consumer_inspectable(style||'{"appearance":{"border":{"kind":"none","width":-1}}}', 'style')
   or public.cardforge_catalog_consumer_inspectable(template||'{"freeformCanvas":{"width":0,"height":450,"elements":[]}}','template')
   or public.cardforge_catalog_consumer_inspectable('{"id":"shape","name":"Shape","type":"shape","x":0,"y":0,"width":0,"height":10,"zIndex":0}','element')
   or public.cardforge_catalog_consumer_inspectable(template-'freeformCanvas','template') then
   raise exception 'invalid_geometry_or_implicit_canvas_cleared'; end if;
 if public.cardforge_catalog_consumer_inspectable('{"id":"i","name":"Image","type":"image","x":0,"y":0,"width":10,"height":10,"zIndex":0}', 'element') then
   raise exception 'implicit_image_binding_cleared'; end if;
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
 if has_function_privilege('anon','public.cardforge_catalog_trash_inventory_details(uuid)','EXECUTE')
   or has_function_privilege('authenticated','public.cardforge_catalog_trash_inventory_details(uuid)','EXECUTE')
   or not has_function_privilege('service_role','public.cardforge_catalog_trash_inventory_details(uuid)','EXECUTE') then
   raise exception 'diagnostic_execute_privileges_regressed'; end if;
 snapshot:=public.cardforge_read_catalog_trash(target);
 if snapshot->'entryReasons'<>'[]'::jsonb then raise exception 'unrelated_legacy_style_blocked: %',snapshot; end if;
 if snapshot->'inventoryDetails' is distinct from '[]'::jsonb then raise exception 'unrelated_consumer_diagnostic'; end if;
 if (select source_payload from public.cardforge_contributor_asset_submissions where id=legacy) is not null then raise exception 'legacy_history_invented'; end if;
 -- The first runtime-valid metadata owner wins; later aliases cannot replace it.
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style,'elementPreset',style||jsonb_build_object('appearance',jsonb_build_object('assetSource',asset))) where asset_id=style_id;
 if public.cardforge_read_catalog_trash(target)->'entryReasons'<>'[]'::jsonb then raise exception 'unused_alias_substituted_for_style'; end if;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style||jsonb_build_object('appearance',jsonb_build_object('assetSource',asset))) where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'pipeline_identity_consumer_requires_resolution') then raise exception 'actual_identity_not_blocked'; end if;
 if not exists(select 1 from jsonb_array_elements(public.cardforge_read_catalog_trash(target)->'inventoryDetails') d
 where d->>'origin'='registry' and d->>'recordId'=style_id and d->'conditions' ? 'target_identity_or_source_reference') then raise exception 'referenced_identity_diagnostic_missing'; end if;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style||'{"appearance":{"material":{"texture":{"kind":"uploaded","imageSource":"https://example.invalid/retained.svg"}}}}') where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'pipeline_identity_consumer_requires_resolution') then raise exception 'actual_source_not_blocked'; end if;
 -- Diagnostics disclose exact record identity and classifications, not payloads,
 -- private document content, asset bodies, source/preview URLs or credentials.
 if exists(select 1 from jsonb_array_elements(public.cardforge_catalog_trash_inventory_details(l)) d
   where not (d ?& array['origin','recordId','payloadKind','conditions'])
      or d-array['origin','recordId','payloadKind','conditions']<>'{}'::jsonb
      or jsonb_typeof(d->'conditions')<>'array'
      or jsonb_array_length(d->'conditions')=0) then raise exception 'diagnostic_output_keys_regressed'; end if;
 if public.cardforge_catalog_trash_inventory_details(l)::text like '%https://example.invalid/%'
   or public.cardforge_catalog_trash_inventory_details(l)::text like '%uploaded%'
   then raise exception 'diagnostic_payload_or_url_leaked'; end if;


 update public.cardforge_asset_registry set preview_url='https://example.invalid/registry-preview.svg' where asset_id=asset;
 update public.cardforge_contributor_asset_submissions set preview_url='https://example.invalid/submission-preview.svg' where id=target;
 foreach key in array array['https://example.invalid/registry-preview.svg','https://example.invalid/submission-preview.svg'] loop
   update public.cardforge_asset_registry set metadata=jsonb_build_object('style',style||jsonb_build_object('updates',jsonb_build_object('imageSource',key))) where asset_id=style_id;
   if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'pipeline_identity_consumer_requires_resolution') then
     raise exception 'authoritative_preview_dependency_missed: %',key; end if;
 end loop;
 update public.cardforge_asset_registry set metadata='{}' where asset_id=style_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'external_fallback_cleared'; end if;
 if not exists(select 1 from jsonb_array_elements(public.cardforge_read_catalog_trash(target)->'inventoryDetails') d
 where d->>'recordId'=style_id and d->'conditions' ? 'missing_native_payload_external_fallback_possible') then raise exception 'external_fallback_diagnostic_missing'; end if;
 update public.cardforge_asset_registry set metadata=jsonb_build_object('style',jsonb_build_array('invalid')) where asset_id=style_id;
 if not exists(select 1 from jsonb_array_elements(public.cardforge_read_catalog_trash(target)->'inventoryDetails') d
 where d->>'recordId'=style_id and d->'conditions' ? 'non_object_payload') then raise exception 'malformed_payload_diagnostic_missing'; end if;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'malformed_diagnostics_cleared_fence'; end if;
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
 -- Exact source-contained Studio project; canonical parser requires version1.
 payload:=jsonb_build_object('version',1,'userTemplates',jsonb_build_array(template||'{"appearance":{"border":{"kind":"none","width":0}}}'),
   'storedCards','[]'::jsonb,'cardSets','[]'::jsonb,'appearanceStyles',jsonb_build_array(style),
   'exportSettings','{}'::jsonb,'customAssets',jsonb_build_object('cardforge-maker-custom-images','[]'::jsonb));
 if not public.cardforge_catalog_consumer_inspectable(payload,'studio') then raise exception 'literal_studio_rejected'; end if;
 insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload)
   values(document_id,'typed-proof','Literal source-contained project',payload);
 if public.cardforge_read_catalog_trash(target)->'entryReasons'<>'[]'::jsonb
   or public.cardforge_catalog_trash_inventory_details(l)<>'[]'::jsonb then raise exception 'unrelated_literal_studio_blocked'; end if;
 -- Known source/identity remains blocking even when the rest is unsupported.
 update public.cardforge_studio_documents set document_payload=jsonb_set(payload,'{userTemplates,0,cardBackgroundImageUrl}',to_jsonb('https://example.invalid/retained.svg'::text)) where id=document_id;
 if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'studio_identity_consumer_requires_resolution') then raise exception 'studio_template_reference_missed'; end if;
 for payload in select value from jsonb_array_elements(jsonb_build_array(
   '{"version":1,"userTemplates":[],"unknownOwner":{}}'::jsonb,
   '{"version":1,"userTemplates":[],"storedCards":[{"templateId":"unresolved","data":{}}]}'::jsonb,
   '{"version":1,"userTemplates":[],"customAssets":{"cardforge-maker-custom-images":[{"url":"data:image/png;base64,AAAA"}]}}'::jsonb,
   '{"version":1,"userTemplates":[],"productionPlan":{"assets":[{"assetId":"unresolved"}]}}'::jsonb,
   jsonb_build_object('version',1,'userTemplates',jsonb_build_array(template-'freeformCanvas')),
   jsonb_build_object('version',1,'userTemplates',jsonb_build_array(template||'{"cardBackgroundImageUrl":"https://example.invalid/unknown.svg"}')),
   '{"version":1,"state":{"userTemplates":[]}}'::jsonb,
   '{"version":1,"userTemplates":null}'::jsonb
 )) loop
   if public.cardforge_catalog_consumer_inspectable(payload,'studio') then raise exception 'unproved_studio_cleared: %',payload; end if;
   update public.cardforge_studio_documents set document_payload=payload where id=document_id;
   if not (public.cardforge_read_catalog_trash(target)->'entryReasons' ? 'json_consumer_inventory_unverified') then raise exception 'opaque_studio_admitted'; end if;
   if not exists(select 1 from jsonb_array_elements(public.cardforge_catalog_trash_inventory_details(l)) d
     where d->>'recordId'=document_id::text and d->'conditions' ? 'outside_supported_native_payload_subset') then raise exception 'opaque_studio_diagnostic_missing'; end if;
 end loop;
 delete from public.cardforge_studio_documents where id=document_id;
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
 raise notice 'PASS typed native consumers: zero border/positive geometry, literal Studio, reference/opaque Studio, unrelated Style/Template, legacy NULL, precedence, identity/source, opaque Set/extensions, CAS, expiry and worker uncertainty';
end $$;
rollback;
