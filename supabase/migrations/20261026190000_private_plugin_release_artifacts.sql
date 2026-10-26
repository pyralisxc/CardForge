-- Proposal only: #407 immutable plugin release binaries (not applied by this PR).
-- Storage is private; package admission and authorized download remain server-owned.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardforge-plugin-releases', 'cardforge-plugin-releases', false, 16777216, array['application/zip'])
on conflict (id) do nothing;

-- Fail closed rather than quietly use a preexisting public/misconfigured bucket.
do $$
begin
  if not exists (
    select 1 from storage.buckets where id='cardforge-plugin-releases'
      and public is false
      and allowed_mime_types = array['application/zip']::text[]
      and file_size_limit = 16777216
  ) then raise exception 'plugin_release_bucket_contract_conflict'; end if;
end $$;

-- A forward-only migration refuses an existing relation until independently reconciled.
do $$
begin
  if to_regclass('public.cardforge_plugin_releases') is not null then
    raise exception 'plugin_release_existing_table_requires_review';
  end if;
end $$;

create table public.cardforge_plugin_releases (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product in ('studio','owner')),
  environment text not null check (environment in ('production','preview')),
  package_version text not null check (package_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([-+][A-Za-z0-9.-]+)?$'),
  source_sha text not null check (source_sha ~ '^[a-f0-9]{40}$'),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  byte_length bigint not null check (byte_length > 0 and byte_length <= 16777216),
  released_at timestamptz not null default now(),
  changes text not null check (length(btrim(changes)) between 1 and 1000),
  compatible_hosts jsonb not null default '[]'::jsonb check (jsonb_typeof(compatible_hosts) = 'array'),
  unique (product, environment, package_version),
  unique (product, environment, checksum_sha256),
  check (storage_path = product || '/' || environment || '/' || package_version || '/' || checksum_sha256 || '.zip')
);

alter table public.cardforge_plugin_releases enable row level security;
revoke all privileges on public.cardforge_plugin_releases from public, anon, authenticated, service_role;
grant select, insert on public.cardforge_plugin_releases to service_role;
-- Owner/superuser DDL and external membership grants remain separately privileged.
do $
begin
  if has_table_privilege('service_role','public.cardforge_plugin_releases','UPDATE')
    or has_table_privilege('service_role','public.cardforge_plugin_releases','DELETE')
    or has_table_privilege('service_role','public.cardforge_plugin_releases','TRUNCATE') then
    raise exception 'plugin_release_mutation_grant_conflict';
  end if;
end $;

-- No automatic deletion, expiry, archival, or replacement is authorized.
create or replace function public.cardforge_reject_plugin_release_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception 'plugin_release_immutable'; end $$;
create trigger cardforge_plugin_releases_no_mutation
before update or delete on public.cardforge_plugin_releases
for each row execute function public.cardforge_reject_plugin_release_mutation();
create trigger cardforge_plugin_releases_no_truncate
before truncate on public.cardforge_plugin_releases
for each statement execute function public.cardforge_reject_plugin_release_mutation();
revoke all on function public.cardforge_reject_plugin_release_mutation() from public, anon, authenticated;

-- NOT end-to-end byte immutability: trusted Storage service authority can still
-- overwrite/delete objects. No constrained admission writer exists yet.
-- Required disposable proof before provider application: run migration in a
-- fresh isolated Postgres/Supabase fixture, assert bucket/table shape and RLS,
-- effective role grants, refused UPDATE/DELETE/TRUNCATE and incompatible
-- preexisting bucket/table, without writing real Staging or Production.
-- Future admission must use upsert:false, download/readback original stored
-- bytes, verify ZIP layout/manifest/source/sha/size, and then insert metadata.
-- Conflict/lost response: reconcile exact object; do not delete orphan bytes
-- or advance release pointer. Historical downloads must reverify digest/size.
-- No public/signed URL, automatic cleanup, expiry, or previous-release rebuild.
