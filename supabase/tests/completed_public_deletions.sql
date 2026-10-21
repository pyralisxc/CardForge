-- Isolated Preview proof only, after its migration. Never run against production.
-- No Storage API calls or existing rows. All generated metadata is rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local role postgres;

do $$
declare
  suffix text := gen_random_uuid()::text;
  bucket text := 'completed-deletion-proof-' || suffix;
  lineage uuid := gen_random_uuid();
  submission uuid := gen_random_uuid();
  asset text := 'completed-deletion-proof-' || suffix;
  source text;
  fingerprint text;
  private_fingerprint text;
begin
  if has_function_privilege('anon', 'public.cardforge_completed_public_deletions(text[])', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.cardforge_completed_public_deletions(text[])', 'EXECUTE')
  then raise exception 'Browser roles can query private evidence storage'; end if;
  insert into storage.buckets(id, name, public) values (bucket, bucket, true);
  insert into storage.objects(bucket_id, name) values (bucket, 'source.svg');
  source := 'https://example.invalid/storage/v1/object/public/' || bucket || '/source.svg';
  fingerprint := encode(extensions.digest(convert_to(source, 'UTF8'), 'sha256'), 'hex');
  private_fingerprint := encode(extensions.digest(convert_to('https://example.invalid/private-preview', 'UTF8'), 'sha256'), 'hex');
  insert into public.cardforge_pipeline_asset_lineages(id, registry_asset_id) values (lineage, asset);
  -- The registry's contributor pointer stays NULL until its FK target exists.
  insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,preview_url,status,access_tier,library_source)
  values (asset,'Completion fixture','icon',source,'https://example.invalid/private-preview','published','free','contributor');
  insert into public.cardforge_contributor_asset_submissions
    (id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,calculated_access_tier,
      registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url,source_storage_bucket,source_storage_path)
  values (submission,lineage,'completion-fixture-' || suffix,'icons','Completion fixture','published','approved','free',
    asset,asset,1,now(),source,bucket,'source.svg');
  update public.cardforge_asset_registry set contributor_submission_id = submission where asset_id = asset;

  execute 'set local role service_role';
  perform public.cardforge_prepare_contributor_asset_purge(submission, 'Completion fixture');
  if exists(select 1 from public.cardforge_completed_public_deletions(array[fingerprint, private_fingerprint]))
  then raise exception 'Prepare was mistaken for completed deletion'; end if;
  -- Retry after registry hiding must preserve the already-captured public fact.
  perform public.cardforge_prepare_contributor_asset_purge(submission, 'Completion fixture');
  begin
    perform public.cardforge_finalize_contributor_asset_purge(submission);
    raise exception 'Finalizer accepted an existing managed object';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_storage_not_removed' then raise; end if;
  end;
  -- Fixture metadata only: no uploaded object or bytes exist. This SQL fixture
  -- is unrun; environments that prohibit SQL deletion need a separately
  -- authorized Storage-backed proof, never a bypass of their deletion guard.
  execute 'set local role postgres';
  delete from storage.objects where bucket_id = bucket and name = 'source.svg';
  execute 'set local role service_role';
  if not public.cardforge_finalize_contributor_asset_purge(submission)
  then raise exception 'Finalization failed'; end if;
  if (select count(*) from public.cardforge_completed_public_deletions(array[fingerprint, private_fingerprint])) <> 1
    or not exists(select 1 from public.cardforge_completed_public_deletions(array[fingerprint]))
  then raise exception 'Completed public proof missing or private URL exposed'; end if;
  execute 'set local role postgres';
end; $$;
rollback;
