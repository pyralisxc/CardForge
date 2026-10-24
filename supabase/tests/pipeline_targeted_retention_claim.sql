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
  select * into v_sibling_before from public.cardforge_contributor_asset_submissions where id=v_sibling;
  select submission_id into v_claim from public.cardforge_claim_pipeline_revision_purge_target(v_target);
  if v_claim is distinct from v_target then raise exception 'exact target not claimed'; end if;
  if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_sibling)
    where submission_id<>v_sibling) then raise exception 'claim escaped exact target'; end if;
  -- The sibling claim above is intentionally a valid explicit target; release
  -- it and assert the original sibling was not modified by the first claim.
  perform public.cardforge_release_pipeline_revision_purge(v_sibling);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=v_target and purge_state='pending')
     or not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=v_sibling and purge_state is null)
  then raise exception 'target claim unexpectedly touched sibling'; end if;
  if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_held))
    or exists(select 1 from public.cardforge_claim_pipeline_revision_purge_target(v_not_due))
  then raise exception 'protected target was claimed'; end if;
  begin
    perform public.cardforge_claim_pipeline_revision_purge_target(null);
    raise exception 'null target accepted';
  exception when raise_exception then
    if sqlerrm <> 'pipeline_retention_target_invalid' then raise; end if;
  end;
end
$fixture$;
