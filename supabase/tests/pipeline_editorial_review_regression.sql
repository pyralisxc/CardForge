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
  owner_id text := 'pipeline-regression-' || gen_random_uuid()::text;
  live_asset text;
  retired_asset text;
  sibling_before public.cardforge_contributor_asset_submissions%rowtype;
  sibling_after public.cardforge_contributor_asset_submissions%rowtype;
begin
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,source_url,
     source_mime_type,revision_number,specialty_tags,use_case_tags)
  values
    (a,owner_id,'templates','Isolated live','published','free','https://example.invalid/live','image/png',1,array['games'],array['tcg']);
  live_asset := public.cardforge_sync_contributor_asset_registry(a);
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,source_url,
     source_mime_type,registry_asset_id,target_registry_asset_id,revision_number,
     specialty_tags,use_case_tags,source_notes,preview_url,
     template_review_context,source_review_evidence)
  values
    (b,owner_id,'templates','Isolated replacement','submitted','contributor',
     'https://example.invalid/new','image/png',live_asset,live_asset,2,
     array['games'],array['tcg'],'Source/rights reviewed','https://example.invalid/preview',
     '{}'::jsonb,'{"version":2}'::jsonb);
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,
     source_url,source_mime_type,revision_number,specialty_tags,use_case_tags)
  values
    (sibling,owner_id,'templates','Unrelated pending','submitted','contributor',
     'https://example.invalid/sibling','image/png',1,array['games'],array['tcg']),
    (retire_id,owner_id,'templates','Disposable retiring live','published','free',
     'https://example.invalid/retire','image/png',1,array['games'],array['tcg']);
  retired_asset := public.cardforge_sync_contributor_asset_registry(retire_id);

  perform public.cardforge_rebalance_contributor_asset_pipeline(null);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='publish_candidate' and decision_reason='revision_ready_for_owner')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=a and status='published')
  then raise exception 'replacement eligibility or live pin failed'; end if;

  select * into sibling_before from public.cardforge_contributor_asset_submissions where id=sibling;
  perform public.cardforge_set_contributor_asset_editorial_review(b,'approved','Verified source, style and fit',owner_id,2);
  select * into sibling_after from public.cardforge_contributor_asset_submissions where id=sibling;
  if to_jsonb(sibling_before) is distinct from to_jsonb(sibling_after)
    or not exists(select 1 from public.cardforge_contributor_asset_submissions
       where id=b and editorial_review_status='approved' and status='publish_candidate')
  then raise exception 'editorial approval touched sibling or lost candidate'; end if;

  begin
    perform public.cardforge_set_contributor_asset_editorial_review(b,'approved','Stale',owner_id,1);
    raise exception 'stale evidence unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'editorial_review_evidence_conflict' then raise; end if;
  end;

  perform public.cardforge_set_contributor_asset_editorial_review(b,'quarantine','Quarantine test',owner_id,2);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='archived' and calculated_access_tier='hidden'
        and trashed_at is not null)
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=a and status='published')
  then raise exception 'candidate quarantine or protected live pointer failed'; end if;

  perform public.cardforge_set_contributor_asset_editorial_review(retire_id,'retire','Retire test',owner_id,null);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=retire_id and status='archived' and calculated_access_tier='hidden')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=retired_asset and status='archived' and access_tier='hidden')
  then raise exception 'live retirement exposure failed'; end if;
  select * into sibling_after from public.cardforge_contributor_asset_submissions where id=sibling;
  if to_jsonb(sibling_before) is distinct from to_jsonb(sibling_after)
  then raise exception 'quarantine/retire touched sibling'; end if;
end
$fixture$;
rollback;
