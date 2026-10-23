-- Native nonproduction acceptance fixture. Apply forward migration before running.
-- Single transaction, disposable identities, unconditional rollback; never real candidates.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
set local role service_role;
do $fixture$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  sibling uuid := gen_random_uuid();
  retire_id uuid := gen_random_uuid();
  reject_id uuid := gen_random_uuid();
  owner_id text := 'pipeline-regression-' || gen_random_uuid()::text;
  live_asset text := 'pipeline-proof-live-' || gen_random_uuid()::text;
  retired_asset text := 'pipeline-proof-retire-' || gen_random_uuid()::text;
  fresh_asset text := 'pipeline-proof-fresh-' || gen_random_uuid()::text;
  fresh_id uuid;
  expected_base jsonb;
  evidence jsonb;
  evidence_facts jsonb := '{"technicalTrace":"Disposable regression proof","creatorFacts":"Fixture author","rightsFacts":"Fixture rights","aiFacts":null,"aiDisclosurePublic":false}'::jsonb;
  sibling_before public.cardforge_contributor_asset_submissions%rowtype;
  sibling_after public.cardforge_contributor_asset_submissions%rowtype;
  live_tier text;
  live_pointer uuid;
begin
  -- Native first Template submission, then the actual owner publication command.
  a := public.cardforge_submit_template_revision(live_asset,'Isolated live','Disposable fixture parent',
    owner_id,'',pg_catalog.jsonb_build_object('id',live_asset,'name','Isolated live'),
    0,'parent-' || replace(gen_random_uuid()::text,'-',''));

  update public.cardforge_contributor_asset_submissions set specialty_tags=array['games'],
    use_case_tags=array['tcg'], semantic_role='template-front' where id=a;
  perform public.cardforge_set_contributor_asset_owner_override(a,true,'published',true,'free','Disposable parent approval',owner_id);
  if not exists(select 1 from public.cardforge_asset_registry where asset_id=live_asset and contributor_submission_id=a and status='published') then raise exception 'native parent pin missing'; end if;

  expected_base := public.cardforge_read_template_review_base(live_asset)->'expectedBase';
  b := public.cardforge_create_template_review_revision(
    live_asset,expected_base,pg_catalog.jsonb_build_object('id',live_asset,'name','Isolated replacement'),
    owner_id,'review-' || replace(gen_random_uuid()::text,'-',''),
    repeat('a',64));
  evidence := public.cardforge_record_source_review_evidence(
    b,evidence_facts,public.cardforge_media_parent_content_version(b),0,owner_id);
  if (evidence->'evidence'->>'version')::integer <> 1 then raise exception 'evidence admission failed'; end if;
  begin
    perform public.cardforge_record_source_review_evidence(
      b,pg_catalog.jsonb_set(evidence_facts,'{technicalTrace}','"Stale distinct evidence"'::jsonb),
      public.cardforge_media_parent_content_version(b),0,owner_id);
    raise exception 'stale evidence unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'source_evidence_conflict' then raise; end if;
  end;
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,
     source_url,source_mime_type,revision_number,specialty_tags,use_case_tags)
  values
    (sibling,owner_id,'templates','Unrelated pending','submitted','contributor',
     'https://example.invalid/sibling','image/png',1,array['games'],array['tcg']);
  retire_id := public.cardforge_submit_template_revision(retired_asset,'Disposable retiring live',
    'Disposable retirement parent',owner_id,'',
    pg_catalog.jsonb_build_object('id',retired_asset,'name','Disposable retiring live'),
    0,'retire-' || replace(gen_random_uuid()::text,'-',''));
  fresh_id := public.cardforge_create_template_pipeline_draft(fresh_asset,'New direct Template',owner_id,'',
    pg_catalog.jsonb_build_object('id',fresh_asset,'name','New direct Template'),
    'fresh-' || replace(gen_random_uuid()::text,'-',''));
  perform public.cardforge_submit_template_pipeline_draft(fresh_id,owner_id,'New direct Template',
    'New Template review proof','https://example.invalid/fresh','Authored fixture evidence',
    array['games'],array['tcg'],'template.front');
  perform public.cardforge_set_contributor_asset_owner_override(retire_id,true,'published',true,'free','Disposable retirement baseline',owner_id);
  if not exists(select 1 from public.cardforge_asset_registry where asset_id=retired_asset and contributor_submission_id=retire_id and status='published') then raise exception 'retirement pin missing'; end if;


  perform public.cardforge_rebalance_contributor_asset_pipeline(null);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='publish_candidate' and decision_reason='revision_ready_for_owner')
    or not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=fresh_id and base_revision_number=0 and status='publish_candidate')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=a and status='published')
  then raise exception 'replacement eligibility or live pin failed'; end if;

  -- An unapproved correction must not be publishable through Owner override.
  begin
    perform public.cardforge_set_contributor_asset_owner_override(
      b,true,'published',true,'free','Premature correction',owner_id);
    raise exception 'unapproved correction unexpectedly published';
  exception when raise_exception then
    if sqlerrm = 'unapproved correction unexpectedly published' then raise; end if;
    if sqlerrm not like '%editorial%' and sqlerrm not like '%review%' then raise; end if;
  end;

  select * into sibling_before from public.cardforge_contributor_asset_submissions where id=sibling;
  perform public.cardforge_set_contributor_asset_editorial_review(b,'approved','Verified source, style and fit',owner_id,1);
  select * into sibling_after from public.cardforge_contributor_asset_submissions where id=sibling;
  if to_jsonb(sibling_before) is distinct from to_jsonb(sibling_after)
    or not exists(select 1 from public.cardforge_contributor_asset_submissions
       where id=b and editorial_review_status='approved' and status='publish_candidate')
  then raise exception 'editorial approval touched sibling or lost candidate'; end if;

  -- Transactional native Owner publication (not merely an approval projection).
  perform public.cardforge_set_contributor_asset_owner_override(
    b,true,'published',true,'free','Disposable exact replacement publication',owner_id);
  if not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=b and status='published')
    or not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=a and source_payload->>'id'=live_asset)
    or (select count(*) from public.cardforge_pipeline_publication_events
      where published_submission_id=b) <> 1
  then raise exception 'replacement pointer or immutable publication history failed'; end if;
  if (select status from public.cardforge_contributor_asset_submissions where id=sibling)
       is distinct from sibling_before.status
  then raise exception 'native publication changed sibling'; end if;

  -- Reset status to Automatic while the scoring projection still lags.
  select contributor_submission_id,access_tier into live_pointer,live_tier
    from public.cardforge_asset_registry where asset_id=live_asset;
  perform public.cardforge_set_contributor_asset_owner_override(
    b,true,null,false,null,'Reset status to Automatic',owner_id);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='published' and owner_status_override is null
        and decision_reason='current_publication_protected')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=live_pointer and status='published'
        and access_tier=live_tier)
  then raise exception 'Automatic reset lost current publication'; end if;

  perform public.cardforge_set_contributor_asset_owner_override(
    b,false,null,true,'paid','Disposable paid tier',owner_id);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='published' and calculated_access_tier='paid'
        and tier_decision_reason='owner_forced_paid')
  then raise exception 'explicit tier update failed'; end if;
  perform public.cardforge_set_contributor_asset_owner_override(
    b,false,null,true,null,'Reset tier to Automatic',owner_id);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='published' and owner_access_tier_override is null
        and calculated_access_tier=live_tier
        and tier_decision_reason is distinct from 'owner_forced_paid')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=b and status='published')
  then raise exception 'Automatic tier reset lost current tier/pointer'; end if;
  select * into sibling_after from public.cardforge_contributor_asset_submissions where id=sibling;
  if to_jsonb(sibling_before) is distinct from to_jsonb(sibling_after)
  then raise exception 'Owner publication/reset changed unrelated sibling'; end if;

  perform public.cardforge_set_contributor_asset_editorial_review(b,'quarantine','Quarantine test',owner_id,1);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='archived' and calculated_access_tier='hidden'
        and published_at is not null and trashed_at is null and purge_after is null)
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and status='archived' and access_tier='hidden')
  then raise exception 'published replacement quarantine exposure failed'; end if;

  perform public.cardforge_set_contributor_asset_editorial_review(retire_id,'retire','Retire test',owner_id,null);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=retire_id and status='archived' and calculated_access_tier='hidden')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=retired_asset and status='archived' and access_tier='hidden')
    or not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=retire_id and published_at is not null and trashed_at is null)
  then raise exception 'live retirement exposure failed'; end if;
  select * into sibling_after from public.cardforge_contributor_asset_submissions where id=sibling;
  if to_jsonb(sibling_before) is distinct from to_jsonb(sibling_after)
  then raise exception 'quarantine/retire touched sibling'; end if;
  -- Archive retention belongs only to an unpublished archived submission.
  perform public.cardforge_set_contributor_asset_owner_override(
    sibling,true,'archived',false,null,'Disposable unpublished archive',owner_id);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=sibling and status='archived' and calculated_access_tier='hidden'
        and trashed_at is not null
        and purge_after >= trashed_at
        and purge_after <= trashed_at + (
          select pg_catalog.make_interval(days => trash_retention_days)
          from public.cardforge_contributor_program_settings where id='default')
          + interval '1 minute')
  then raise exception 'unpublished archive retention mismatch'; end if;

  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,
     source_url,source_mime_type,revision_number,specialty_tags,use_case_tags)
  values (reject_id,owner_id,'templates','Unpublished rejection','submitted','contributor',
     'https://example.invalid/rejection','image/png',1,array['games'],array['tcg']);
  perform public.cardforge_set_contributor_asset_owner_override(
    reject_id,true,'rejected',false,null,'Disposable unpublished rejection',owner_id);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=reject_id and status='rejected' and calculated_access_tier='hidden'
        and trashed_at is null and purge_after is null)
  then raise exception 'rejection gained unintended purge schedule'; end if;
end
$fixture$;
rollback;
