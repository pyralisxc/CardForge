-- Requires the normal migrated disposable Supabase database after the guarded
-- CI-only setup in scripts/verify-catalog-trash-local.sh. --no-seed alone does
-- NOT remove catalog INSERTs executed inside historical migrations.
-- Deliberately refuses an existing catalog: do not erase production/shared
-- Staging consumers to make a positive admission fixture pass. No Storage I/O.
-- Single-session guard tests do NOT prove lock races; additionally use two
-- supported sessions for Move/claim ordering and worker interruption proof.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local role service_role;
do $$
begin
  if exists(select 1 from public.cardforge_asset_registry) then
    raise exception 'catalog_trash_fixture_requires_isolated_empty_catalog';
  end if;
  if has_function_privilege('authenticated','public.cardforge_change_catalog_trash(text,text,jsonb,boolean)','EXECUTE')
    or has_function_privilege('anon','public.cardforge_read_catalog_trash(uuid)','EXECUTE') then
    raise exception 'browser_roles_must_not_manage_catalog_trash';
  end if;
end $$;


-- A full protected prefix must not starve a later eligible revision. Each
-- group fills p_limit=2 by itself: catalog Trash, whole-lineage pending, and
-- uncertain prior revision claims. IDs guarantee that all six sort first.
-- These are rollback-only state fixtures, not claims of successful Move entry.
do $$
declare
  lineage uuid; submission uuid; eligible uuid; claimed uuid[]; i integer;
  protected_ids uuid[]:='{}';
begin
  for i in 1..7 loop
    lineage:=((case when i=7 then 'ffffffff' else '0000000'||i::text end)||substr(gen_random_uuid()::text,9))::uuid;
    submission:=gen_random_uuid();
    insert into public.cardforge_pipeline_asset_lineages(id) values(lineage);
    insert into public.cardforge_contributor_asset_submissions
      (id,lineage_id,contributor_id,asset_type,name,status,calculated_access_tier,
        trashed_at,purge_after,trash_reason,purge_claim_token,purge_claimed_at)
      values(submission,lineage,'isolated-batch-proof','icons','Bounded expiry fixture','archived','hidden',
        now()-interval '32 days',now()-interval '2 days','expired',
        case when i in (5,6) then gen_random_uuid() else null end,
        case when i in (5,6) then now()-interval '1 day' else null end);
    if i in (1,2) then
      update public.cardforge_pipeline_asset_lineages
        set catalog_trashed_at=now(),catalog_purge_after=now()+interval '30 days' where id=lineage;
    elsif i in (3,4) then
      update public.cardforge_pipeline_asset_lineages set purge_state='pending' where id=lineage;
    end if;
    if i=7 then eligible:=submission; else protected_ids:=array_append(protected_ids,submission); end if;
  end loop;
  select array_agg(submission_id) into claimed from public.cardforge_claim_pipeline_revision_purges(2);
  if claimed is distinct from array[eligible] then
    raise exception 'blocked_prefix_starved_eligible_revision: %',claimed;
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions
    where id=any(protected_ids) and purge_state is not null) then
    raise exception 'batch_claimed_a_protected_revision';
  end if;
  if (select count(*) from public.cardforge_contributor_asset_submissions
    where id=any(protected_ids) and purge_claim_token is not null and purge_claimed_at<now()-interval '15 minutes')<>2 then
    raise exception 'batch_erased_or_recycled_prior_claim_uncertainty';
  end if;
end $$;

do $$
declare
  lineage uuid:=gen_random_uuid(); current_id uuid:=gen_random_uuid(); old_id uuid:=gen_random_uuid();
  stale_id uuid:=gen_random_uuid(); document_id uuid:=gen_random_uuid(); opaque_id text:='opaque-'||gen_random_uuid()::text;
  asset text:='trash-proof-'||lineage::text; snapshot jsonb; initial jsonb; held jsonb; token uuid;
  expected_name text:='Recoverable catalog fixture';
begin
  insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water) values(lineage,asset,2);
  insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
    values(asset,expected_name,'icon','https://example.invalid/retained.svg','published','free','contributor');
  insert into public.cardforge_contributor_asset_submissions
    (id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,calculated_access_tier,
      registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url,trashed_at,purge_after,trash_reason)
    values(current_id,lineage,'isolated-trash-proof','icons',expected_name,'published','approved','free',asset,asset,2,now(),
      'https://example.invalid/retained.svg',null,null,null),
    (old_id,lineage,'isolated-trash-proof','icons',expected_name,'archived','approved','hidden',asset,asset,1,null,
      'https://example.invalid/old.svg',now()-interval '31 days',now()-interval '1 day','expired');
  update public.cardforge_asset_registry set contributor_submission_id=current_id where asset_id=asset;
  initial:=public.cardforge_read_catalog_trash(current_id);
  if initial->'entryReasons'<>'[]'::jsonb then raise exception 'fresh_direct_media_fixture_not_eligible: %',initial; end if;
  if initial->'reasons'='[]'::jsonb then raise exception 'physical_expiry_must_remain_explicitly_blocked'; end if;

  -- Independent Studio identities are not inferred from Pipeline publication.
  insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload)
    values(document_id,'isolated-trash-proof','Synthetic consumer',jsonb_build_object('version',1,'assetId',asset));
  if not (public.cardforge_read_catalog_trash(current_id)->'entryReasons' ? 'studio_identity_consumer_requires_resolution') then
    raise exception 'independent_studio_consumer_missed'; end if;
  delete from public.cardforge_studio_documents where id=document_id;
  -- An invalid object payload still takes the external JSON fallback. The URL
  -- is deliberately inaccessible and must never be fetched as negative proof.
  insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,metadata)
    values(opaque_id,'Opaque fixture','template','https://example.invalid/inaccessible.json','published','free','contributor','{"template":{}}');
  if not (public.cardforge_read_catalog_trash(current_id)->'entryReasons' ? 'json_consumer_inventory_unverified') then
    raise exception 'opaque_external_consumer_missed'; end if;
  delete from public.cardforge_asset_registry where asset_id=opaque_id;

  begin
    update public.cardforge_pipeline_asset_lineages set catalog_trashed_at=now(),catalog_purge_after='infinity' where id=lineage;
    raise exception 'invalid_date_admitted';
  exception when raise_exception then if sqlerrm<>'catalog_trash_state_changed' then raise; end if; end;
  begin
    update public.cardforge_pipeline_asset_lineages set catalog_trashed_at=now(),catalog_purge_after=now()+interval '30 days',purge_state='pending' where id=lineage;
    raise exception 'trash_and_commitment_admitted';
  exception when raise_exception then if sqlerrm<>'catalog_trash_already_claimed' then raise; end if; end;

  snapshot:=public.cardforge_change_catalog_trash('isolated-owner','trash',initial->'state');
  if exists(select 1 from public.cardforge_discoverable_asset_registry where asset_id=asset)
    or not exists(select 1 from public.cardforge_asset_registry where asset_id=asset and url='https://example.invalid/retained.svg') then
    raise exception 'discovery_and_retained_resolution_not_separated'; end if;
  if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(old_id)) then raise exception 'claim_bypassed_catalog_trash'; end if;
  begin
    perform public.cardforge_prepare_contributor_asset_purge(current_id,expected_name);
    raise exception 'whole_lineage_prepare_bypassed_trash';
  exception when raise_exception then if sqlerrm<>'catalog_trash_state_changed' then raise; end if; end;
  begin
    perform public.cardforge_change_catalog_trash('isolated-owner','restore',initial->'state');
    raise exception 'stale_expected_state_admitted';
  exception when raise_exception then if sqlerrm<>'catalog_trash_state_changed' then raise; end if; end;
  begin
    update public.cardforge_pipeline_asset_lineages set revision_high_water=3 where id=lineage;
    raise exception 'new_revision_bypassed_trash';
  exception when raise_exception then if sqlerrm<>'catalog_trash_state_changed' then raise; end if; end;
  held:=public.cardforge_change_catalog_trash('isolated-owner','hold',snapshot->'state',true);
  if held->'state'->>'held'<>'true' or held->'state'->'purgeAfter' is distinct from snapshot->'state'->'purgeAfter' then
    raise exception 'hold_changed_deadline_or_failed'; end if;
  snapshot:=public.cardforge_change_catalog_trash('isolated-owner','restore',held->'state');
  if snapshot->'state'->'trashedAt'<>'null'::jsonb then raise exception 'restore_failed'; end if;

  -- Commitment persists even when release is called by an old worker.
  select claim_token into token from public.cardforge_claim_pipeline_revision_purge_target(old_id);
  if token is null then raise exception 'expected_revision_claim_missing'; end if;
  if public.cardforge_release_pipeline_revision_purge(old_id,token) then raise exception 'uncertain_claim_released'; end if;
  if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(old_id)) then raise exception 'pending_claim_recycled'; end if;
  begin
    perform public.cardforge_change_catalog_trash('isolated-owner','trash',snapshot->'state');
    raise exception 'move_after_commitment_admitted';
  exception when raise_exception then if sqlerrm<>'catalog_trash_already_claimed' then raise; end if; end;
  -- Seed an already-stale attempt; the existing pending-row guard correctly
  -- forbids rewriting an active claim's timestamp just to simulate expiry.
  insert into public.cardforge_contributor_asset_submissions
    (id,lineage_id,contributor_id,asset_type,name,status,calculated_access_tier,registry_asset_id,target_registry_asset_id,
      revision_number,trashed_at,purge_after,trash_reason,purge_state,purge_claimed_at,purge_claim_token)
    values(stale_id,lineage,'isolated-trash-proof','icons','Stale worker','archived','hidden',asset,asset,3,
      now()-interval '32 days',now()-interval '2 days','expired','pending',now()-interval '1 day',gen_random_uuid());
  if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(stale_id)) then raise exception 'expired_lease_recycled'; end if;
  if public.cardforge_finalize_pipeline_revision_purge(old_id,gen_random_uuid()) then raise exception 'wrong_worker_finalized'; end if;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions where id=old_id and purge_claim_token=token) then
    raise exception 'failed_finalizer_lost_claim'; end if;
end $$;
rollback;
