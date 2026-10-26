-- Only the existing uniquely identified Docker/loopback runner invokes this.
-- Exact migration execution is deliberately expected to fail inside a savepoint.
-- No existing hosted relation or bucket may be used as a test sentinel.
begin;
set local lock_timeout='2s';
do $$begin
  if to_regclass('public.cardforge_plugin_releases') is not null
    or exists(select 1 from storage.buckets where id='cardforge-plugin-releases')
    or to_regprocedure('public.cardforge_reject_plugin_release_mutation()') is not null
  then raise exception 'plugin_conflict_fixture_requires_absent_proposal'; end if;
end $$;
\if :table_conflict
create table public.cardforge_plugin_releases (sentinel text);
insert into public.cardforge_plugin_releases values ('preserve-existing-table');
\else
insert into storage.buckets(id,name,public,allowed_mime_types,file_size_limit)
values('cardforge-plugin-releases','cardforge-plugin-releases',true,array['image/png'],123);
\endif
savepoint migration_attempt;
-- ON_ERROR_STOP is disabled only for the deliberately failing migration. The
-- runner additionally requires its exact expected native error in the log.
\set ON_ERROR_STOP off
\i :plugin_migration
\set ON_ERROR_STOP on
rollback to savepoint migration_attempt;
\if :table_conflict
do $$begin
  if (select array_agg(sentinel) from public.cardforge_plugin_releases)
      is distinct from array['preserve-existing-table']::text[]
    or exists(select 1 from storage.buckets where id='cardforge-plugin-releases')
    or to_regprocedure('public.cardforge_reject_plugin_release_mutation()') is not null
  then raise exception 'plugin_failed_migration_leaked_state'; end if;
end $$;
\else
do $$begin
  if not exists(select 1 from storage.buckets where id='cardforge-plugin-releases'
    and public is true and allowed_mime_types=array['image/png']::text[] and file_size_limit=123)
    or to_regclass('public.cardforge_plugin_releases') is not null
    or to_regprocedure('public.cardforge_reject_plugin_release_mutation()') is not null
  then raise exception 'plugin_failed_migration_changed_existing_bucket'; end if;
end $$;
\endif
rollback;
do $$begin
  if to_regclass('public.cardforge_plugin_releases') is not null
    or exists(select 1 from storage.buckets where id='cardforge-plugin-releases')
    or to_regprocedure('public.cardforge_reject_plugin_release_mutation()') is not null
  then raise exception 'plugin_conflict_fixture_did_not_rollback'; end if;
end $$;
\echo PASS: incompatible proposal rejected; existing sentinel preserved; migration and fixture rolled back
