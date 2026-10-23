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
    (a,owner_id,'templates','Isolated live','submitted','contributor','https://example.invalid/live','image/png',1,array['games'],array['tcg']);
  perform public.cardforge_set_contributor_asset_owner_override(a,true,'published',true,'free','Disposable parent approval',owner_id);
  select asset_id into live_asset from public.cardforge_asset_registry where contributor_submission_id=a and status='published';
  if live_asset is null then raise exception 'fixture parent publication failed'; end if;
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,source_url,
     source_mime_type,registry_asset_id,target_registry_asset_id,revision_number,
     specialty_tags,use_case_tags,source_notes,preview_url,
     template_review_context)
  values
    (b,owner_id,'templates','Isolated replacement','submitted','contributor',
     'https://example.invalid/new','image/png',live_asset,live_asset,2,
     array['games'],array['tcg'],'Source/rights reviewed','https://example.invalid/preview',
     null);
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,
     source_url,source_mime_type,revision_number,specialty_tags,use_case_tags)
  values
    (sibling,owner_id,'templates','Unrelated pending','submitted','contributor',
     'https://example.invalid/sibling','image/png',1,array['games'],array['tcg']),
    (retire_id,owner_id,'templates','Disposable retiring live','submitted','contributor',
     'https://example.invalid/retire','image/png',1,array['games'],array['tcg']);
  perform public.cardforge_set_contributor_asset_owner_override(retire_id,true,'published',true,'free','Disposable retirement baseline',owner_id);
  select asset_id into retired_asset from public.cardforge_asset_registry where contributor_submission_id=retire_id and status='published';
  if retired_asset is null then raise exception 'fixture retirement publication failed'; end if;

  perform public.cardforge_rebalance_contributor_asset_pipeline(null);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=b and status='publish_candidate' and decision_reason='revision_ready_for_owner')
    or not exists(select 1 from public.cardforge_asset_registry
      where asset_id=live_asset and contributor_submission_id=a and status='published')
  then raise exception 'replacement eligibility or live pin failed'; end if;

  select * into sibling_before from public.cardforge_contributor_asset_submissions where id=sibling;
  perform public.cardforge_set_contributor_asset_editorial_review(b,'approved','Verified source, style and fit',owner_id,null);
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
      where id=a and source_url='https://example.invalid/live')
    or (select count(*) from public.cardforge_pipeline_publication_events
      where published_submission_id=b) <> 1
  then raise exception 'replacement pointer or immutable publication history failed'; end if;
  if (select status from public.cardforge_contributor_asset_submissions where id=sibling)
       is distinct from sibling_before.status
  then raise exception 'native publication changed sibling'; end if;

  perform public.cardforge_set_contributor_asset_editorial_review(b,'quarantine','Quarantine test',owner_id,null);
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
end
$fixture$;
rollback;
