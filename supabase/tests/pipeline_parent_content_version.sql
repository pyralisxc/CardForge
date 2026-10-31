-- Rollback-only native proof, called exclusively by the guarded disposable
-- local Supabase runner. The cooperative GUC does not replace Docker identity.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
  if current_setting('cardforge.fixture_disposable',true) is distinct from 'parent-content-version'
    then raise exception 'parent_version_fixture_local_guard_required'; end if;
end $$;
set local role service_role;
do $$
declare
  asset text := 'parent-version-proof-' || gen_random_uuid()::text;
  actor text := 'parent-version-fixture-' || gen_random_uuid()::text;
  parent_id uuid; candidate_id uuid; original_hash text; historical_hash text;
  pins jsonb; stored_context jsonb; live_base jsonb;
  original_description text; i integer;
begin
  if has_function_privilege('anon','public.cardforge_media_parent_content_version(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.cardforge_media_parent_content_version(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.cardforge_media_parent_content_version(uuid)','EXECUTE')
    then raise exception 'parent_version_grants_changed'; end if;
  parent_id := public.cardforge_submit_template_revision(asset,'Isolated hash parent','Original authored description',
    actor,'',jsonb_build_object('id',asset,'name','Isolated hash parent'),0,
    'parent-' || replace(gen_random_uuid()::text,'-',''));
  update public.cardforge_contributor_asset_submissions set specialty_tags=array['games'],
    use_case_tags=array['tcg'],semantic_role='template-front' where id=parent_id;
  perform public.cardforge_set_contributor_asset_owner_override(parent_id,true,'published',true,'free','Disposable hash proof',actor);
  pins := public.cardforge_read_template_review_base(asset)->'expectedBase';
  original_hash := pins->>'parentContentVersion';
  -- Reproduce the historical row shape before the two October25 additive columns.
  -- The remaining exclusion list is the unchanged October17 canonical contract.
  select md5(((to_jsonb(s)-array['owner_purge_requested_at','purge_claim_token','catalog_dependencies','source_content_sha256','revision_recovery_version','revision_trash_actor_id','revision_trash_actor_role','revision_publication_retained'])-array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence'])::text), s.description
    into historical_hash, original_description from public.cardforge_contributor_asset_submissions s where id=parent_id;
  if original_hash is distinct from historical_hash then raise exception 'historical_hash_not_preserved'; end if;
  candidate_id := public.cardforge_create_template_review_revision(asset,pins,
    jsonb_build_object('id',asset,'name','Isolated pending correction'),actor,
    'review-' || replace(gen_random_uuid()::text,'-',''),repeat('a',64));
  select template_review_context into stored_context from public.cardforge_contributor_asset_submissions where id=candidate_id;
  for i in 1..3 loop
    update public.cardforge_contributor_asset_submissions
      set owner_purge_requested_at=case when i=2 then null else now() end,
          purge_claim_token=case when i=1 then null else gen_random_uuid() end
      where id=parent_id;
    live_base := public.cardforge_read_template_review_base(asset)->'expectedBase';
    if live_base->>'parentContentVersion' is distinct from original_hash
      or live_base->>'registryContentVersion' is distinct from pins->>'registryContentVersion'
      or (live_base->>'revisionHighWater')::integer <> 2
      then raise exception 'operational_fields_staled_original_pin'; end if;
    if (select template_review_context from public.cardforge_contributor_asset_submissions where id=candidate_id) is distinct from stored_context
      then raise exception 'stored_candidate_pin_rewritten'; end if;
  end loop;
  update public.cardforge_contributor_asset_submissions set description='Changed authored description' where id=parent_id;
  if public.cardforge_media_parent_content_version(parent_id) is not distinct from original_hash
    then raise exception 'authored_change_not_detected'; end if;
  if (select template_review_context from public.cardforge_contributor_asset_submissions where id=candidate_id) is distinct from stored_context
    then raise exception 'authored_change_rewrote_candidate_pin'; end if;
  begin
    perform public.cardforge_create_template_review_revision(asset,pins,
      jsonb_build_object('id',asset,'name','Must reject stale base'),actor,
      'stale-' || replace(gen_random_uuid()::text,'-',''),repeat('b',64));
    raise exception 'stale_original_pin_accepted';
  exception when raise_exception then
    if sqlerrm <> 'template_review_conflict' then raise; end if;
  end;
  update public.cardforge_contributor_asset_submissions set description=original_description where id=parent_id;
  if public.cardforge_media_parent_content_version(parent_id) is distinct from original_hash
    then raise exception 'restored_authored_content_does_not_match_original_pin'; end if;
  raise notice 'PASS historical parent hash, operational stability, authored sensitivity, unchanged stored pins and stale-base rejection';
end $$;
rollback;
