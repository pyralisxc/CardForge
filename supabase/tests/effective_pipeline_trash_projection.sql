-- Disposable native replay only. No Storage, hosted rows or permanent cleanup.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $$
declare
 catalog_l uuid:=gen_random_uuid(); revision_l uuid:=gen_random_uuid(); active_l uuid:=gen_random_uuid(); history_l uuid:=gen_random_uuid();
 current_id uuid:=gen_random_uuid(); historical_id uuid:=gen_random_uuid(); draft_id uuid:=gen_random_uuid(); private_id uuid:=gen_random_uuid();
 shared_id uuid:=gen_random_uuid(); revision_id uuid:=gen_random_uuid(); active_id uuid:=gen_random_uuid(); history_id uuid:=gen_random_uuid();
 asset text:='effective-trash-'||catalog_l; active_asset text:='active-'||active_l;
 snapshot jsonb; before_history timestamptz; receipt record; metadata jsonb; n bigint;
begin
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'effective_trash_fixture_requires_isolated_empty_catalog'; end if;
 if has_table_privilege('anon','public.cardforge_pipeline_submission_recovery_projection','select')
 or has_table_privilege('authenticated','public.cardforge_pipeline_submission_recovery_projection','select')
 or not has_table_privilege('service_role','public.cardforge_pipeline_submission_recovery_projection','select')
 then raise exception 'recovery_projection_has_incorrect_privileges'; end if;
 if not exists(select 1 from pg_class where oid='public.cardforge_pipeline_submission_recovery_projection'::regclass and reloptions @> array['security_invoker=true']) then raise exception 'recovery_projection_bypasses_source_rls'; end if;
 insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water)
 values(catalog_l,asset,2),(revision_l,'revision-'||revision_l,1),(active_l,active_asset,1),(history_l,'history-'||history_l,1);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
 values(asset,'Catalog recovery source','icon','https://example.invalid/catalog.svg','published','free','contributor'),
 (active_asset,'Active source','icon','https://example.invalid/active.svg','published','free','contributor');
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,contributor_email,asset_type,name,status,
 owner_status_override,owner_access_tier_override,calculated_access_tier,editorial_review_status,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url,submitted_at)
 values(current_id,catalog_l,'author','author@example.invalid','icons','Catalog current','published','published','free','free','approved',asset,asset,2,now(),'https://example.invalid/catalog.svg',now()),
 (active_id,active_l,'author','author@example.invalid','icons','Active control','published','published','free','free','approved',active_asset,active_asset,1,now(),'https://example.invalid/active.svg',now()-interval '3 days'),
 (history_id,history_l,'author','author@example.invalid','icons','Archive is not Trash','archived','archived','hidden','hidden','approved',null,'history-'||history_l,1,now()-interval '5 days',null,now()-interval '5 days');
 update public.cardforge_asset_registry set contributor_submission_id=current_id where asset_id=asset;
 update public.cardforge_asset_registry set contributor_submission_id=active_id where asset_id=active_asset;
 -- A revision already in recoverable Trash can share a lineage with catalog
 -- Trash. Restoring one owner must never clear the other owner's clock.
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,owner_status_override,
 registry_asset_id,target_registry_asset_id,revision_number,published_at,trashed_at,purge_after,trash_reason,
 revision_trash_actor_role,revision_trash_actor_id,revision_trash_previous_status,revision_publication_retained,submitted_at)
 values(historical_id,catalog_l,'author','icons','Catalog history','archived','archived',asset,asset,1,now()-interval '1 day',now()-interval '1 hour',now()+interval '29 days','withdrawn','contributor','author','published',true,now()-interval '1 day'),
 (revision_id,revision_l,'author','textures','Revision-only recovery','archived','archived',null,'revision-'||revision_l,1,now()-interval '2 days',now()-interval '2 hours',now()+interval '29 days','withdrawn','contributor','author','published',true,now()-interval '2 days');
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,contributor_email,asset_type,name,status,owner_status_override,submitted_at)
 values(draft_id,catalog_l,'private-author','private-only@example.invalid','icons','Private sibling draft','draft','draft',now()),
 (private_id,catalog_l,'private-author','private-only@example.invalid','icons','Private unknown archive','archived','archived',now()),
 (shared_id,catalog_l,'sibling-author','sibling@example.invalid','icons','Shared submitted sibling','submitted','submitted',now());
 select trashed_at into before_history from public.cardforge_contributor_asset_submissions where id=historical_id;
 snapshot:=public.cardforge_read_catalog_trash(current_id);
 snapshot:=public.cardforge_change_catalog_trash('owner','trash',snapshot->'state',null,snapshot->'impact'->>'fingerprint');
 if snapshot->'state'->>'trashedAt' is null then raise exception 'catalog_trash_did_not_commit'; end if;
 if exists(select 1 from public.cardforge_discoverable_asset_registry where asset_id=asset) then raise exception 'catalog_trash_still_discoverable'; end if;
 if (select status from public.cardforge_contributor_asset_submissions where id=current_id)<>'published' then raise exception 'effective_trash_rewrote_authored_status'; end if;
 -- Free shared readers receive exactly metadata for public current/history
 -- and revision Trash, never private siblings even on a public lineage.
 select count(*) into n from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared',p_trash_state=>'trashed');
 if n<>4 then raise exception 'mixed_shared_trash_count_wrong: %',n; end if;
 for receipt in select * from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared',p_trash_state=>'trashed') loop
  if receipt.total_count<>4 or receipt.submission_id in(draft_id,private_id) then raise exception 'shared_trash_leaked_private_sibling_or_bad_total'; end if;
  metadata:=receipt.shared_metadata;
  if metadata ?| array['contributorEmail','contributorId','sourcePayload','sourceUrl','previewUrl'] then raise exception 'shared_trash_exposed_private_fields'; end if;
  if receipt.submission_id=current_id and (metadata->>'trashedAt' is not null or metadata->>'catalogTrashedAt' is null or metadata->>'catalogSubmissionId'<>current_id::text) then raise exception 'catalog_trash_scope_or_exact_current_pointer_lost: %',metadata; end if;
  if receipt.submission_id=historical_id and (metadata->>'trashedAt' is null or metadata->>'catalogTrashedAt' is null or metadata->>'catalogSubmissionId'<>current_id::text) then raise exception 'dual_scope_history_identity_lost'; end if;
  if receipt.submission_id=shared_id and (metadata->>'status'<>'submitted' or (metadata->>'publicationRetained')::boolean or metadata->>'catalogTrashedAt' is null) then raise exception 'shared_unpublished_sibling_visibility_or_publication_fact_lost'; end if;
  if receipt.submission_id=revision_id and (metadata->>'trashedAt' is null or metadata->>'catalogTrashedAt' is not null) then raise exception 'revision_restore_scope_lost'; end if;
 end loop;
 select count(*) into n from public.cardforge_list_contributor_asset_submission_ids('owner','all',p_trash_state=>'active') where submission_id is not null;
 if n<>2 then raise exception 'catalog_trash_not_excluded_before_active_count: %',n; end if;
 select * into receipt from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared',p_page=>99,p_page_size=>1,p_trash_state=>'trashed');
 if receipt.total_count<>4 or receipt.submission_id is not null or receipt.shared_metadata is not null then raise exception 'empty_page_lost_filtered_total'; end if;
 select * into receipt from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared',p_asset_type=>'textures',p_page_size=>1,p_trash_state=>'trashed');
 if receipt.total_count<>1 or receipt.submission_id<>revision_id then raise exception 'type_filter_applied_after_slice'; end if;
 select * into receipt from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared',p_query=>'private-only@example.invalid',p_trash_state=>'trashed');
 if receipt.total_count<>0 or receipt.submission_id is not null then raise exception 'shared_search_exposed_private_identity'; end if;
 select * into receipt from public.cardforge_list_contributor_asset_submission_ids('owner','all',p_status=>'published',p_trash_state=>'trashed');
 if receipt.total_count<>1 or receipt.submission_id<>current_id then raise exception 'status_and_effective_trash_not_independent'; end if;
 -- Existing catalog Restore remains the sole command for catalog Trash. It
 -- keeps the exact current pointer and the independent historical revision Trash.
 snapshot:=public.cardforge_read_catalog_trash(current_id);
 perform public.cardforge_change_catalog_trash('owner','restore',snapshot->'state');
 if (select contributor_submission_id from public.cardforge_asset_registry where asset_id=asset) is distinct from current_id
 or (select trashed_at from public.cardforge_contributor_asset_submissions where id=historical_id) is distinct from before_history
 then raise exception 'catalog_restore_rewrote_revision_history_or_pointer'; end if;
 select * into receipt from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared',p_query=>'Catalog history',p_trash_state=>'trashed');
 if receipt.total_count<>1 or receipt.submission_id<>historical_id or receipt.shared_metadata->>'catalogTrashedAt' is not null or receipt.shared_metadata->>'trashedAt' is null then raise exception 'catalog_restore_cleared_independent_revision_trash'; end if;
 raise notice 'PASS effective Trash: mixed catalog/revision/history, active exclusion, native totals/paging/type/status/search, shared privacy, service-only projection and independent Restore owners';
end $$;
rollback;
