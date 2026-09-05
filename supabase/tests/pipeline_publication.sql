-- Run inside a transaction after applying the candidate migration; roll back
-- afterward. Uses temporary fixture identities with the native lineage triggers.
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
  select contributor_id into author_id from public.cardforge_contributor_asset_submissions limit 1;
  if author_id is null then raise exception 'Publication test requires a seeded contributor'; end if;
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
  end loop;
end;
$$;
