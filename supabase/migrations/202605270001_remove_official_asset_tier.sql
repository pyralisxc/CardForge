-- Asset visibility now uses Starter Library (free), Creator Pass (paid),
-- Forge Review (developer), or Hidden. CardForge-owned source rows remain
-- identified by library_source = 'official'; access_tier no longer uses it.

update cardforge_asset_registry
set access_tier = 'free'
where access_tier = 'official';

update cardforge_developer_asset_submissions
set calculated_access_tier = 'free'
where calculated_access_tier = 'official';

update cardforge_developer_asset_submissions
set owner_access_tier_override = 'free'
where owner_access_tier_override = 'official';

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'cardforge_asset_registry'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%access_tier%'
  loop
    execute format('alter table cardforge_asset_registry drop constraint %I', constraint_record.conname);
  end loop;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'cardforge_developer_asset_submissions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%calculated_access_tier%'
  loop
    execute format('alter table cardforge_developer_asset_submissions drop constraint %I', constraint_record.conname);
  end loop;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'cardforge_developer_asset_submissions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%owner_access_tier_override%'
  loop
    execute format('alter table cardforge_developer_asset_submissions drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table cardforge_asset_registry
  add constraint cardforge_asset_registry_access_tier_check
  check (access_tier in ('hidden', 'free', 'paid', 'developer'));

alter table cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_submissions_calculated_access_tier_check
  check (calculated_access_tier in ('hidden', 'free', 'paid', 'developer'));

alter table cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_submissions_owner_access_tier_override_check
  check (owner_access_tier_override is null or owner_access_tier_override in ('hidden', 'free', 'paid'));
