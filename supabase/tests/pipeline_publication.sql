-- Run against staging after applying the candidate migrations. Every fixture
-- is rolled back; no existing publication or contributor data is modified.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare
  lineage uuid := gen_random_uuid();
  first_revision uuid := gen_random_uuid();
  second_revision uuid := gen_random_uuid();
  author_id text := 'governance-author-' || gen_random_uuid()::text;
  reviewer_id text := 'governance-reviewer-' || gen_random_uuid()::text;
begin
  insert into public.cardforge_pipeline_asset_lineages(id) values (lineage);
  insert into public.cardforge_contributor_asset_submissions
    (id,lineage_id,contributor_id,asset_type,name,status,revision_number,submitted_at)
  values
    (first_revision,lineage,author_id,'icons','Preference one','voting',1,pg_catalog.now()),
    (second_revision,lineage,author_id,'icons','Preference two','voting',2,pg_catalog.now());

  perform public.cardforge_cast_contributor_asset_vote(first_revision, reviewer_id, 'positive', null);
  perform public.cardforge_cast_contributor_asset_vote(second_revision, reviewer_id, 'positive', null);
  if (select count(*) from public.cardforge_contributor_asset_votes
      where lineage_id=lineage and contributor_id=reviewer_id and vote_value='positive') <> 1
    or not exists (select 1 from public.cardforge_contributor_asset_votes
      where submission_id=second_revision and contributor_id=reviewer_id and vote_value='positive') then
    raise exception 'positive revision preference did not move atomically';
  end if;

  perform public.cardforge_cast_contributor_asset_vote(first_revision, reviewer_id, 'negative', null);
  if not exists (select 1 from public.cardforge_contributor_asset_votes
      where submission_id=first_revision and contributor_id=reviewer_id and vote_value='negative')
    or not exists (select 1 from public.cardforge_contributor_asset_votes
      where submission_id=second_revision and contributor_id=reviewer_id and vote_value='positive') then
    raise exception 'revision objection incorrectly replaced the lineage preference';
  end if;

  perform public.cardforge_cast_contributor_asset_vote(first_revision, author_id, 'positive', null);
  if not exists (select 1 from public.cardforge_contributor_asset_votes
      where submission_id=first_revision and contributor_id=author_id
        and vote_value='positive' and vote_weight=1) then
    raise exception 'author self vote was not recorded as one unweighted vote';
  end if;

  insert into public.cardforge_contributor_asset_votes
    (submission_id,lineage_id,contributor_id,vote_value,vote_weight)
  values (second_revision,lineage,author_id,'negative',99);
  if not exists (select 1 from public.cardforge_contributor_asset_votes
      where submission_id=second_revision and contributor_id=author_id
        and vote_value='negative' and vote_weight=1) then
    raise exception 'direct author vote did not normalize to one unweighted vote';
  end if;

  update public.cardforge_contributor_asset_submissions
  set status='archived',automated_status='archived',calculated_access_tier='hidden',
      automated_access_tier='hidden',trashed_at=pg_catalog.now(),
      purge_after=pg_catalog.now()+interval '30 days',trash_reason='declined'
  where id=first_revision;
  begin
    perform public.cardforge_cast_contributor_asset_vote(first_revision, reviewer_id, 'negative', null);
    raise exception 'Trash vote unexpectedly accepted';
  exception when others then
    if sqlerrm <> 'contributor_asset_vote_not_permitted' then raise; end if;
  end;
end;
$$;

do $$
declare
  kind text;
  expected_kind text;
  registry_id text;
  first_id uuid;
  second_id uuid;
  author_id text;
  old_pointer uuid;
begin
  author_id := 'publication-proof-' || gen_random_uuid()::text;
  foreach kind in array array['templates','elementPresets','textures','dividers','icons','imageAssets','fonts','sets'] loop
    first_id := gen_random_uuid();
    second_id := gen_random_uuid();
    registry_id := 'publication-test-' || first_id::text;
    expected_kind := case kind when 'templates' then 'template' when 'elementPresets' then 'elementPreset'
      when 'textures' then 'texture' when 'dividers' then 'divider' when 'icons' then 'icon'
      when 'imageAssets' then 'image' when 'fonts' then 'font' when 'sets' then 'set' end;
    insert into public.cardforge_contributor_asset_submissions
      (id,contributor_id,asset_type,name,status,calculated_access_tier,source_url,source_mime_type,
       registry_asset_id,target_registry_asset_id,revision_number,specialty_tags,use_case_tags)
    values
      (first_id,author_id,kind,'Publication test','published','free','https://example.invalid/test',
       case kind when 'sets' then 'application/vnd.cardforge.project+zip' when 'fonts' then 'font/woff2' else 'image/png' end,
       null,null,1,array['games'],array['tcg']);
    registry_id := public.cardforge_sync_contributor_asset_registry(first_id);
    if not exists(select 1 from public.cardforge_asset_registry where asset_id=registry_id and asset_type=expected_kind
      and contributor_submission_id=first_id and status='published' and access_tier='free') then
      raise exception '% first publication failed', kind;
    end if;
    insert into public.cardforge_contributor_asset_submissions
      (id,contributor_id,asset_type,name,status,calculated_access_tier,source_url,source_mime_type,
       registry_asset_id,target_registry_asset_id,revision_number,specialty_tags,use_case_tags)
    values
      (second_id,author_id,kind,'Publication revision','voting','contributor','https://example.invalid/revision',
       case kind when 'sets' then 'application/vnd.cardforge.project+zip' when 'fonts' then 'font/woff2' else 'image/png' end,
       registry_id,registry_id,2,array['games'],array['tcg']);
    perform public.cardforge_sync_contributor_asset_registry(second_id);
    select contributor_submission_id into old_pointer from public.cardforge_asset_registry where asset_id=registry_id;
    if old_pointer <> first_id then raise exception '% candidate replaced publication', kind; end if;
    update public.cardforge_contributor_asset_submissions set status='published',calculated_access_tier='free' where id=second_id;
    perform public.cardforge_sync_contributor_asset_registry(second_id);
    -- Both stale published and subsequently archived revisions must be harmless.
    perform public.cardforge_sync_contributor_asset_registry(first_id);
    update public.cardforge_contributor_asset_submissions set status='archived' where id=first_id;
    perform public.cardforge_sync_contributor_asset_registry(first_id);
    if not exists(select 1 from public.cardforge_asset_registry where asset_id=registry_id
      and contributor_submission_id=second_id and status='published' and access_tier='free'
      and (metadata->>'revisionNumber')::integer=2) then
      raise exception '% stale revision hid or replaced the current publication', kind;
    end if;
    update public.cardforge_contributor_asset_submissions set status='archived' where id=second_id;
    perform public.cardforge_sync_contributor_asset_registry(second_id);
    if not exists(select 1 from public.cardforge_asset_registry where asset_id=registry_id and status='archived' and access_tier='hidden') then
      raise exception '% current publication could not be retired', kind;
    end if;
    if not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=first_id and source_url='https://example.invalid/test' and revision_number=1)
      or not exists(select 1 from public.cardforge_contributor_asset_submissions
      where id=second_id and source_url='https://example.invalid/revision' and revision_number=2) then
      raise exception '% retirement changed or deleted immutable revision sources', kind;
    end if;
  end loop;
end;
$$;

do $$
begin
  execute 'set local role anon';
  begin
    perform public.cardforge_sync_contributor_asset_registry(gen_random_uuid());
    raise exception 'Anonymous publication unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute 'set local role authenticated';
  begin
    perform public.cardforge_sync_contributor_asset_registry(gen_random_uuid());
    raise exception 'Authenticated direct publication unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$$;

rollback;

-- Concurrency acceptance needs TWO independent staging database connections.
-- Session A: BEGIN; SELECT pg_advisory_xact_lock(hashtextextended(
--   'hardening-publication-lock-proof',0));
-- Session B: in a rolled-back transaction create a fixture submission with
-- target_registry_asset_id='hardening-publication-lock-proof' and call the
-- native publication function. It must raise SQLSTATE 55P03 without moving
-- the active registry pointer. Then ROLLBACK both sessions.
-- Check pg_locks in B first to prove A still holds the competing lock. A tool
-- transport that serializes execute_sql requests cannot certify concurrency.
