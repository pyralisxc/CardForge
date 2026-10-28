-- Rollback-only in the existing verified disposable native runner.
begin;
set local role service_role;
set local lock_timeout='5s';
do $$
declare document_id uuid:=gen_random_uuid(); payload jsonb:='{"version":1,"userTemplates":[],"storedCards":[],"cardSets":[]}';
 proof jsonb; stored jsonb; changed jsonb; signature text;
begin
 if exists(select 1 from public.cardforge_asset_registry) or exists(select 1 from public.cardforge_studio_documents) then
   raise exception 'studio_dependency_fixture_requires_empty_disposable_database'; end if;
 foreach signature in array array[
   'public.cardforge_studio_dependency_binding_valid(jsonb,integer,jsonb)',
   'public.cardforge_guard_studio_catalog_dependencies()',
   'public.cardforge_reconcile_studio_catalog_dependencies(text,uuid,integer,jsonb,jsonb)',
   'public.cardforge_source_contained_css_image(text)'
 ] loop
   if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') then
     raise exception 'studio_dependency_browser_privilege: %',signature; end if;
 end loop;
 proof:=jsonb_build_object('contractVersion',1,'complete',true,'references','[]'::jsonb,'opaqueReasons','[]'::jsonb,'sourcePayload',payload);
 insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies)
 values(document_id,'source-proof','Literal',payload,proof);
 select catalog_dependencies into stored from public.cardforge_studio_documents where id=document_id;
 if stored ? 'sourcePayload' or not public.cardforge_studio_dependency_binding_valid(payload,1,stored) then raise exception 'native_binding_invalid'; end if;
 if stored->>'payloadDigest'<>encode(extensions.digest(payload::text,'sha256'),'hex') then raise exception 'digest_canonicalization_mismatch'; end if;
 if public.cardforge_studio_dependency_binding_valid(payload,2,stored)
   or public.cardforge_studio_dependency_binding_valid(payload,1,stored||'{"contractVersion":2}')
   or public.cardforge_studio_dependency_binding_valid(payload,1,stored||'{"payloadDigest":"wrong"}')
   or public.cardforge_studio_dependency_binding_valid(payload,1,null) then raise exception 'stale_binding_accepted'; end if;
 -- Metadata-only activity preserves the same exact source binding.
 update public.cardforge_studio_documents set title='Renamed' where id=document_id;
 if (select catalog_dependencies from public.cardforge_studio_documents where id=document_id)<>stored then raise exception 'metadata_lost_binding'; end if;
 -- Unknown/direct payload writer cannot carry forward a previously complete proof.
 changed:=payload||'{"activeCardSetId":"new"}';
 update public.cardforge_studio_documents set document_payload=changed,revision=2 where id=document_id;
 if (select catalog_dependencies from public.cardforge_studio_documents where id=document_id) is not null then raise exception 'stale_proof_survived_direct_writer'; end if;
 if public.cardforge_reconcile_studio_catalog_dependencies('source-proof',document_id,1,payload,proof) then raise exception 'stale_reconciliation_succeeded'; end if;
 proof:=proof||jsonb_build_object('sourcePayload',changed);
 if public.cardforge_reconcile_studio_catalog_dependencies('another-owner',document_id,2,changed,proof) then raise exception 'cross_owner_reconciliation_succeeded'; end if;
 if not public.cardforge_reconcile_studio_catalog_dependencies('source-proof',document_id,2,changed,proof) then raise exception 'exact_reconciliation_failed'; end if;
 if not (select public.cardforge_studio_dependency_binding_valid(document_payload,revision,catalog_dependencies) from public.cardforge_studio_documents where id=document_id) then raise exception 'reconciled_binding_invalid'; end if;
 -- Trusted interpreter version transition cannot silently reuse an old complete result.
 update public.cardforge_studio_documents set catalog_dependencies=proof||'{"contractVersion":2}' where id=document_id;
 if (select catalog_dependencies from public.cardforge_studio_documents where id=document_id) is not null then raise exception 'unknown_interpreter_version_accepted'; end if;
 if not public.cardforge_source_contained_css_image('linear-gradient(90deg, #fff, rgba(0,0,0,0.2)), radial-gradient(circle, gold, transparent)') then raise exception 'literal_css_rejected'; end if;
 if public.cardforge_source_contained_css_image('linear-gradient(red), image-set(''relative.png'' 1x), linear-gradient(red, blue)')
   or public.cardforge_source_contained_css_image('linear-gradient(var(--source), blue)')
   or public.cardforge_source_contained_css_image('linear-gradient(red, blue),url(target)') then raise exception 'indirect_css_cleared'; end if;
 raise notice 'PASS Studio native binding: source digest/revision/version, direct invalidation, metadata preservation, exact CAS and restricted privileges';
end $$;
rollback;
