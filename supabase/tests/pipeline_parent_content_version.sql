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
  select md5(((to_jsonb(s)-array['owner_purge_requested_at','purge_claim_token','catalog_dependencies','source_content_sha256','revision_recovery_version','revision_trash_actor_id','revision_trash_actor_role','revision_publication_retained','revision_trash_previous_status','revision_vote_trash_fingerprint','author_review_note','author_review_history','author_resubmission_parent_id','author_resubmission_fingerprint','author_resubmission_parent_reviewed_at','author_resubmission_parent_version'])-array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence'])::text), s.description
    into historical_hash, original_description from public.cardforge_contributor_asset_submissions s where id=parent_id;
  if original_hash is distinct from historical_hash then raise exception 'historical_hash_not_preserved'; end if;
  update public.cardforge_contributor_asset_submissions set author_review_note='Fixture author feedback' where id=parent_id;
  if public.cardforge_media_parent_content_version(parent_id) is distinct from original_hash
    then raise exception 'author_feedback_changed_content_version'; end if;
  update public.cardforge_contributor_asset_submissions set author_review_note='' where id=parent_id;
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
-- Ordinary unpublished assets share this author-note and snapshot boundary,
-- including writes from the browser and Studio command owners.
do $$
declare
  fixture_id uuid := gen_random_uuid();
  actor text := 'review-snapshot-fixture-' || gen_random_uuid()::text;
  baseline text;
begin
  insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,source_url)
    values(fixture_id,actor,'icons','Exact review fixture','voting','https://example.invalid/review-fixture.svg');
  baseline := public.cardforge_media_parent_content_version(fixture_id);
  perform public.cardforge_review_with_author_note(fixture_id,'revise','Private reviewer reason',actor,null,'Author direction');
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=fixture_id
    and s.editorial_review_status='revise' and s.author_review_note='Author direction')
    or public.cardforge_media_parent_content_version(fixture_id) is distinct from baseline
  then raise exception 'author_feedback_not_exact_or_content_version_changed'; end if;
  begin
    update public.cardforge_contributor_asset_submissions s set name='Changed after review' where s.id=fixture_id;
    raise exception 'reviewed_snapshot_mutation_accepted';
  exception when raise_exception then
    if sqlerrm <> 'reviewed_revision_immutable' then raise; end if;
  end;
  perform public.cardforge_review_with_author_note(fixture_id,'pending','',actor,null,'');
  if exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=fixture_id and s.author_review_note<>'')
    then raise exception 'stale_author_feedback_retained'; end if;
  update public.cardforge_contributor_asset_submissions s set name='Changed after reset' where s.id=fixture_id;
  raise notice 'PASS exact author feedback, review snapshot guard and stale feedback reset';
end $$;
do $$
declare
  asset text := 'author-review-history-' || replace(gen_random_uuid()::text,'-','');
  actor text := 'author-history-fixture-' || gen_random_uuid()::text;
  parent_id uuid; next_id uuid; duplicate_id uuid; parent_lineage uuid;
  version text; reviewed timestamptz; payload jsonb;
begin
  payload:=jsonb_build_object('id',asset,'name','Original Template','templateSource','default','templateLibrarySource','pipeline','templateRegistryStatus','draft');
  parent_id:=public.cardforge_create_template_pipeline_draft(asset,'Original Template',actor,'',payload,'initial-history-fixture');
  perform public.cardforge_submit_template_pipeline_draft(parent_id,actor,'Original Template','First authored candidate',
    'https://example.invalid/template-preview','Fixture rights',array['games'],array['tcg'],'template.front');
  perform public.cardforge_review_with_author_note(parent_id,'revise','Private review',actor,null,'Please improve the title');
  select s.lineage_id,s.editorial_reviewed_at into parent_lineage,reviewed from public.cardforge_contributor_asset_submissions s where s.id=parent_id;
  version:=public.cardforge_media_parent_content_version(parent_id);
  payload:=jsonb_set(payload,'{name}',to_jsonb('Updated Template'::text));
  if public.cardforge_read_template_author_revision_attempt(parent_id,actor,'revision-history-fixture',repeat('a',64)) is not null
    then raise exception 'author_review_history_unstarted_attempt_found'; end if;
  begin
    perform public.cardforge_create_template_author_revision_draft(parent_id,reviewed,repeat('f',32),actor,'','Updated Template',payload,'stale-history-fixture',repeat('a',64));
    raise exception 'author_review_history_accepted_stale_base';
  exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=parent_id and s.status='submitted' and s.trashed_at is null)
    then raise exception 'author_review_history_stale_attempt_mutated_parent'; end if;
  begin
    update public.cardforge_pipeline_asset_lineages set revision_high_water=revision_high_water+1 where id=parent_lineage;
    begin
      perform public.cardforge_create_template_author_revision_draft(parent_id,reviewed,version,actor,'','Updated Template',payload,'old-parent-fixture',repeat('a',64));
      raise exception 'author_review_history_accepted_old_highwater';
    exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
    raise exception 'rollback_old_highwater_fixture';
  exception when raise_exception then if sqlerrm<>'rollback_old_highwater_fixture' then raise; end if; end;
  next_id:=public.cardforge_create_template_author_revision_draft(parent_id,reviewed,version,actor,'','Updated Template',payload,'revision-history-fixture',repeat('a',64));
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=parent_id and s.lineage_id=parent_lineage
      and s.status='archived' and s.decision_reason='superseded_revision' and s.trashed_at is null and s.purge_after is null
      and s.editorial_review_status='revise' and s.author_review_note='Please improve the title'
      and s.author_review_history->>'reviewStatus'='revise'
      and s.author_review_history->>'authorNote'='Please improve the title')
    or not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=next_id and s.lineage_id=parent_lineage
      and s.status='draft' and s.revision_number=2 and s.author_resubmission_parent_id=parent_id
      and s.description='First authored candidate' and s.source_notes='Fixture rights'
      and s.specialty_tags=array['games'] and s.use_case_tags=array['tcg'])
  then raise exception 'author_review_history_transition_failed'; end if;
  duplicate_id:=public.cardforge_create_template_author_revision_draft(parent_id,reviewed,version,actor,'','Updated Template',payload,'revision-history-fixture',repeat('a',64));
  if duplicate_id is distinct from next_id then raise exception 'author_review_history_retry_created_sibling'; end if;
  if public.cardforge_read_template_author_revision_attempt(parent_id,actor,'revision-history-fixture',repeat('a',64)) is distinct from next_id
    then raise exception 'author_review_history_receipt_unavailable'; end if;
  begin
    perform public.cardforge_read_template_author_revision_attempt(parent_id,actor,'revision-history-fixture',repeat('b',64));
    raise exception 'author_review_history_accepted_different_receipt';
  exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
  begin
    perform public.cardforge_create_template_author_revision_draft(parent_id,reviewed,version,'another-author','','Updated Template',payload,'forged-history-fixture',repeat('a',64));
    raise exception 'author_review_history_accepted_peer';
  exception when raise_exception then if sqlerrm<>'template_author_revision_not_found' then raise; end if; end;
  begin
    perform public.cardforge_create_template_author_revision_draft(parent_id,reviewed,version,actor,'','Changed',payload,'revision-history-fixture',repeat('a',64));
    raise exception 'author_review_history_accepted_changed_attempt';
  exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
  -- An Owner decision made after draft creation must hold at submission.
  begin
    update public.cardforge_contributor_asset_submissions s set editorial_review_status='approved' where s.id=parent_id;
    if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=parent_id
      and s.author_review_note='' and s.author_review_history->>'authorNote'='Please improve the title')
      then raise exception 'original_author_feedback_not_retained'; end if;
    begin
      perform public.cardforge_submit_template_pipeline_draft_checked(next_id,actor,'Updated Template','Ready candidate',
        'https://example.invalid/template-preview','Fixture rights',array['games'],array['tcg'],'template.front');
      raise exception 'author_review_history_accepted_changed_parent';
    exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
    raise exception 'rollback_changed_parent_fixture';
  exception when raise_exception then if sqlerrm<>'rollback_changed_parent_fixture' then raise; end if; end;
  begin
    update public.cardforge_contributor_asset_submissions s set owner_status_override='rejected' where s.id=parent_id;
    begin
      perform public.cardforge_submit_template_pipeline_draft_checked(next_id,actor,'Updated Template','Ready candidate',
        'https://example.invalid/template-preview','Fixture rights',array['games'],array['tcg'],'template.front');
      raise exception 'author_review_history_accepted_owner_override';
    exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
    raise exception 'rollback_owner_override_fixture';
  exception when raise_exception then if sqlerrm<>'rollback_owner_override_fixture' then raise; end if; end;
  begin
    update public.cardforge_contributor_asset_submissions s set author_review_history='{}'::jsonb where s.id=parent_id;
    raise exception 'author_review_history_mutation_accepted';
  exception when raise_exception then if sqlerrm<>'author_review_history_immutable' then raise; end if; end;
  perform public.cardforge_submit_template_pipeline_draft_checked(next_id,actor,'Updated Template','Ready candidate',
    'https://example.invalid/template-preview','Fixture rights',array['games'],array['tcg'],'template.front');
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=next_id and s.status='submitted')
    then raise exception 'author_review_history_draft_not_submitted'; end if;
  delete from public.cardforge_contributor_asset_submissions s where s.id=next_id;
  begin
    perform public.cardforge_read_template_author_revision_attempt(parent_id,actor,'revision-history-fixture',repeat('a',64));
    raise exception 'author_review_history_falsely_reported_absent_receipt';
  exception when raise_exception then if sqlerrm<>'template_author_revision_conflict' then raise; end if; end;
  raise notice 'PASS exact author resubmission preserves History and allocates one same-lineage draft';
end $$;
-- A live correction retains its governed published-base lease and never moves
-- the live pointer when the author begins or submits a replacement draft.
do $$
declare
  asset text := 'author-live-review-' || replace(gen_random_uuid()::text,'-','');
  actor text := 'author-live-fixture-' || gen_random_uuid()::text;
  live_id uuid; reviewed_id uuid; next_id uuid; pins jsonb; current_pins jsonb;
  reviewed timestamptz; version text; child public.cardforge_contributor_asset_submissions%rowtype;
begin
  live_id:=public.cardforge_submit_template_revision(asset,'Live Template','Live description',actor,'',
    jsonb_build_object('id',asset,'name','Live Template'),0,'live-' || replace(gen_random_uuid()::text,'-',''));
  update public.cardforge_contributor_asset_submissions set source_notes='Original rights',specialty_tags=array['games'],
    use_case_tags=array['tcg'],requested_studio_destination='template.front' where id=live_id;
  perform public.cardforge_set_contributor_asset_owner_override(live_id,true,'published',true,'free','Fixture',actor);
  pins:=public.cardforge_read_template_review_base(asset)->'expectedBase';
  reviewed_id:=public.cardforge_create_template_review_revision(asset,pins,
    jsonb_build_object('id',asset,'name','Reviewed correction'),actor,'review-' || replace(gen_random_uuid()::text,'-',''),repeat('a',64));
  perform public.cardforge_review_with_author_note(reviewed_id,'revise','Private review',actor,null,'Please correct the title');
  select editorial_reviewed_at into reviewed from public.cardforge_contributor_asset_submissions where id=reviewed_id;
  version:=public.cardforge_media_parent_content_version(reviewed_id);
  current_pins:=public.cardforge_read_template_review_base(asset)->'expectedBase';
  next_id:=public.cardforge_create_template_author_revision_draft(reviewed_id,reviewed,version,actor,'','Corrected title',
    jsonb_build_object('id',asset,'name','Corrected title'),'author-' || replace(gen_random_uuid()::text,'-',''),repeat('b',64),current_pins);
  select * into child from public.cardforge_contributor_asset_submissions where id=next_id;
  if child.status<>'draft' or child.template_review_context is null or child.source_review_evidence is not null
    or not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=reviewed_id
      and s.status='archived' and s.author_review_history->>'authorNote'='Please correct the title')
    or not exists(select 1 from public.cardforge_asset_registry r where r.asset_id=asset and r.contributor_submission_id=live_id and r.status='published')
    then raise exception 'governed_author_draft_not_isolated'; end if;
  perform public.cardforge_submit_template_pipeline_draft_checked(next_id,actor,child.name,child.description,child.preview_url,
    child.source_notes,child.specialty_tags,child.use_case_tags,child.requested_studio_destination);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=next_id and s.status='submitted'
      and s.template_review_context is not null and s.source_review_evidence is null)
    or not exists(select 1 from public.cardforge_asset_registry r where r.asset_id=asset and r.contributor_submission_id=live_id and r.status='published')
    then raise exception 'governed_author_submission_changed_live'; end if;
  raise notice 'PASS governed author correction retains live revision and requires fresh evidence';
end $$;
rollback;
