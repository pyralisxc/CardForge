-- Review-only disposable native acceptance. Run under ONE outer BEGIN/ROLLBACK
-- with the exact forward-only function definition loaded transaction-locally.
-- Never invoke the Edge worker or remove Storage bytes from this fixture.
do $fixture$
declare
  v_owner text := 'pipeline-target-test-'||pg_catalog.gen_random_uuid()::text;
  v_target uuid := pg_catalog.gen_random_uuid();
  v_sibling uuid := pg_catalog.gen_random_uuid();
  v_held uuid := pg_catalog.gen_random_uuid();
  v_not_due uuid := pg_catalog.gen_random_uuid();
  v_published uuid := pg_catalog.gen_random_uuid();
  v_referenced uuid := pg_catalog.gen_random_uuid();
  v_claim uuid;
  v_sibling_before public.cardforge_contributor_asset_submissions%rowtype;
begin
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,
     source_url,source_mime_type,revision_number,specialty_tags,use_case_tags,
     trashed_at,purge_after,retention_hold)
  values
    (v_target,v_owner,'templates','Disposable eligible target','archived','hidden',
      'https://example.invalid/target','image/png',1,array['games'],array['tcg'],
      now()-interval '2 days',now()-interval '1 day',false),
    (v_sibling,v_owner,'templates','Disposable unrelated due','archived','hidden',
      'https://example.invalid/sibling','image/png',1,array['games'],array['tcg'],
      now()-interval '2 days',now()-interval '1 day',false),
    (v_held,v_owner,'templates','Disposable held due','archived','hidden',
      'https://example.invalid/held','image/png',1,array['games'],array['tcg'],
      now()-interval '2 days',now()-interval '1 day',true),
    (v_not_due,v_owner,'templates','Disposable not yet due','archived','hidden',
      'https://example.invalid/future','image/png',1,array['games'],array['tcg'],
      now()-interval '1 hour',now()+interval '1 day',false);
  insert into public.cardforge_contributor_asset_submissions
    (id,contributor_id,asset_type,name,status,calculated_access_tier,
     source_url,source_mime_type,revision_number,specialty_tags,use_case_tags,
     trashed_at,purge_after,retention_hold,published_at)
  values
    (v_published,v_owner,'templates','Previously published target','archived','hidden',
     'https://example.invalid/published','image/png',1,array['games'],array['tcg'],
     now()-interval '2 days',now()-interval '1 day',false,now()-interval '3 days'),
    (v_referenced,v_owner,'templates','Registry referenced target','archived','hidden',
     'https://example.invalid/referenced','image/png',1,array['games'],array['tcg'],
     now()-interval '2 days',now()-interval '1 day',false,null);
  insert into public.cardforge_asset_registry
    (asset_id,name,asset_type,url,status,access_tier,library_source,contributor_submission_id)
  values ('pipeline-target-proof-'||replace(v_referenced::text,'-',''),
    'Disposable registry pin','template','https://example.invalid/referenced',
    'archived','hidden','developer',v_referenced);

  select * into v_sibling_before from public.cardforge_contributor_asset_submissions where id=v_sibling;
  select submission_id into v_claim from public.cardforge_claim_pipeline_revision_purge_target(v_target);
  if v_claim is distinct from v_target then raise exception 'exact target not claimed'; end if;
  if (select pg_catalog.to_jsonb(submission) from public.cardforge_contributor_asset_submissions submission
      where id=v_sibling) is distinct from pg_catalog.to_jsonb(v_sibling_before)
  then raise exception 'unrelated due sibling mutated'; end if;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=v_target and purge_state='pending')
  then raise exception 'target claim was not retained'; end if;
  if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_held))
    or exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_not_due))
    or exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_published))
    or exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_referenced))
  then raise exception 'protected target was claimed'; end if;
  begin
    perform public.cardforge_claim_pipeline_revision_purge_target(null);
    raise exception 'null target accepted';
  exception when raise_exception then
    if sqlerrm <> 'pipeline_retention_target_invalid' then raise; end if;
  end;
end
$fixture$;
