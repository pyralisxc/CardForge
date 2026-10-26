-- #407 local-only rollback fixture. Run on a disposable Supabase CLI database.
-- Required sequence: the guarded verify-catalog-trash-local.sh native replay;
-- psql against the LOCAL CLI database only, with:
-- BEGIN; SET LOCAL cardforge.fixture_disposable = 'plugin-releases';
-- \i supabase/tests/plugin_release_retention.sql
-- ROLLBACK;
-- The orchestrating PR551 runner must enforce local connection identity and
-- migration freshness before invocation; DO NOT execute against hosted projects.
-- The migration is applied by local CLI replay; this file NEVER applies it.
do $$
declare
  v_path text;
  v_id uuid;
  v_bucket record;
begin
  if current_setting('cardforge.fixture_disposable', true) is distinct from 'plugin-releases'
    then raise exception 'plugin_fixture_local_guard_required'; end if;
  -- Caller MUST additionally prove local Docker CLI identity, not only this
  -- cooperative GUC. Never treat this check as a hosted-target safety fence.
  select id, public, allowed_mime_types, file_size_limit into v_bucket
    from storage.buckets where id='cardforge-plugin-releases';
  if not found or v_bucket.public is distinct from false
    or v_bucket.allowed_mime_types is distinct from array['application/zip']::text[]
    or v_bucket.file_size_limit is distinct from 16777216
    then raise exception 'plugin_fixture_bucket_contract'; end if;
  if to_regclass('public.cardforge_plugin_releases') is null
    then raise exception 'plugin_fixture_missing_table'; end if;
  if not (select relrowsecurity from pg_class
      where oid='public.cardforge_plugin_releases'::regclass)
    then raise exception 'plugin_fixture_rls_disabled'; end if;
  if has_table_privilege('anon','public.cardforge_plugin_releases','SELECT')
    or has_table_privilege('authenticated','public.cardforge_plugin_releases','INSERT')
    or not has_table_privilege('service_role','public.cardforge_plugin_releases','SELECT')
    or not has_table_privilege('service_role','public.cardforge_plugin_releases','INSERT')
    or has_table_privilege('service_role','public.cardforge_plugin_releases','UPDATE')
    or has_table_privilege('service_role','public.cardforge_plugin_releases','DELETE')
    or has_table_privilege('service_role','public.cardforge_plugin_releases','TRUNCATE')
    then raise exception 'plugin_fixture_grant_mismatch'; end if;
  if not exists (
    select 1 from pg_trigger where tgrelid='public.cardforge_plugin_releases'::regclass
      and tgname='cardforge_plugin_releases_no_truncate' and not tgisinternal
  ) then raise exception 'plugin_fixture_truncate_trigger_missing'; end if;
  v_path := 'studio/preview/1.0.3/'||repeat('a',64)||'.zip';
  insert into public.cardforge_plugin_releases
    (product,environment,package_version,source_sha,checksum_sha256,
     storage_path,byte_length,changes)
  values ('studio','preview','1.0.3',repeat('b',40),repeat('a',64),
    v_path,100,'disposable fixture') returning id into v_id;
  begin
    update public.cardforge_plugin_releases set changes='bad' where id=v_id;
    raise exception 'plugin_fixture_update_allowed';
  exception when raise_exception then
    if sqlerrm <> 'plugin_release_immutable' then raise; end if;
  end;
  begin
    delete from public.cardforge_plugin_releases where id=v_id;
    raise exception 'plugin_fixture_delete_allowed';
  exception when raise_exception then
    if sqlerrm <> 'plugin_release_immutable' then raise; end if;
  end;
  begin
    truncate public.cardforge_plugin_releases;
    raise exception 'plugin_fixture_truncate_allowed';
  exception when raise_exception then
    if sqlerrm <> 'plugin_release_immutable' then raise; end if;
  end;
  begin
    insert into public.cardforge_plugin_releases
      (product,environment,package_version,source_sha,checksum_sha256,
       storage_path,byte_length,changes)
    values ('studio','preview','1.0.3',repeat('c',40),repeat('d',64),
      'studio/preview/1.0.3/'||repeat('d',64)||'.zip',101,'collision');
    raise exception 'plugin_fixture_duplicate_version_allowed';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.cardforge_plugin_releases where id=v_id) <> 1
    then raise exception 'plugin_fixture_row_lost'; end if;
end $$;
-- Incompatible preexisting state and failed-migration rollback are exercised by
-- plugin_release_migration_conflicts.sql BEFORE ordinary CLI migration up.
-- No Storage object upload/readback or durable release-admission writer is tested.
