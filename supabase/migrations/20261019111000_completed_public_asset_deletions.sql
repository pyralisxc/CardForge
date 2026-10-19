begin;
set local lock_timeout = '5s';

-- Prepared intent and historical private hashes are never completed public proof.
-- Deliberately no backfill: older hidden/pending rows cannot prove past publicity.
alter table public.cardforge_pipeline_asset_tombstones
  add column public_source_url_fingerprints text[] not null default '{}',
  add column completed_at timestamptz;

create or replace function public.cardforge_prepare_contributor_asset_purge(p_submission_id uuid, p_expected_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  lineage_uuid uuid;
  lineage_asset_id text;
  fingerprints text[];
  public_fingerprints text[];
  storage_objects jsonb;
begin
  select candidate.lineage_id into lineage_uuid
  from public.cardforge_contributor_asset_submissions as candidate where candidate.id = p_submission_id;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  select lineage.registry_asset_id into lineage_asset_id
  from public.cardforge_pipeline_asset_lineages as lineage where lineage.id = lineage_uuid for update;
  if not found then raise exception 'contributor_asset_lineage_not_found'; end if;

  select * into submission from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and lineage_id = lineage_uuid for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;
  if nullif(pg_catalog.btrim(p_expected_name), '') is null
    or pg_catalog.btrim(p_expected_name) <> submission.name
  then raise exception 'contributor_asset_purge_confirmation_mismatch'; end if;

  if exists (select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id = lineage_uuid
    and ((s.source_storage_bucket is null) <> (s.source_storage_path is null)))
  then raise exception 'contributor_asset_storage_reference_incomplete'; end if;

  update public.cardforge_pipeline_asset_lineages
  set purge_state = 'pending', updated_at = pg_catalog.now() where id = lineage_uuid;

  if lineage_asset_id is not null then
    perform 1 from public.cardforge_asset_registry where asset_id = lineage_asset_id for update;
    -- Only currently published free registry references in a public managed
    -- bucket with an existing object, whose exact tuple belongs to this purge, qualify.
    select coalesce(array_agg(distinct encode(extensions.digest(convert_to(reference.url, 'UTF8'), 'sha256'), 'hex')), '{}'::text[])
    into public_fingerprints
    from public.cardforge_asset_registry r
    cross join lateral (values (r.url), (r.preview_url)) reference(url)
    where r.asset_id = lineage_asset_id and r.status = 'published' and r.access_tier = 'free'
      and exists (
        select 1 from public.cardforge_contributor_asset_submissions s
        join storage.buckets b on b.id = s.source_storage_bucket and b.public
        join storage.objects o on o.bucket_id = s.source_storage_bucket and o.name = s.source_storage_path
        where s.lineage_id = lineage_uuid
          and right(reference.url, length('/storage/v1/object/public/' || s.source_storage_bucket || '/' || s.source_storage_path))
            = '/storage/v1/object/public/' || s.source_storage_bucket || '/' || s.source_storage_path
      );
    -- Exact URL-string identity, not a content digest or normalized URL. Include
    -- every retained revision plus both current registry references before files
    -- disappear. Pending submissions are immutable under the existing trigger.
    select coalesce(pg_catalog.array_agg(distinct pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(reference.url, 'UTF8'), 'sha256'), 'hex')), '{}'::text[])
    into fingerprints
    from (
      select s.source_url as url from public.cardforge_contributor_asset_submissions s where s.lineage_id = lineage_uuid
      union select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id = lineage_uuid
      union select r.url from public.cardforge_asset_registry r where r.asset_id = lineage_asset_id
      union select r.preview_url from public.cardforge_asset_registry r where r.asset_id = lineage_asset_id
    ) reference where reference.url is not null and reference.url <> '';

    insert into public.cardforge_pipeline_asset_tombstones as tombstone
      (asset_id, asset_name, deleted_submission_id, deleted_at, lineage_id,
       source_url_fingerprints, public_source_url_fingerprints, identity_captured_at, deletion_reason)
    values (lineage_asset_id, submission.name, submission.id, pg_catalog.now(), lineage_uuid,
      fingerprints, public_fingerprints, pg_catalog.now(), 'owner_permanent_deletion')
    on conflict (asset_id) do update set
      lineage_id = excluded.lineage_id,
      source_url_fingerprints = array(select distinct fingerprint
        from pg_catalog.unnest(tombstone.source_url_fingerprints || excluded.source_url_fingerprints) fingerprint
        order by fingerprint),
      public_source_url_fingerprints = array(select distinct fingerprint
        from pg_catalog.unnest(tombstone.public_source_url_fingerprints || excluded.public_source_url_fingerprints) fingerprint
        order by fingerprint),
      identity_captured_at = coalesce(tombstone.identity_captured_at, excluded.identity_captured_at),
      deletion_reason = coalesce(tombstone.deletion_reason, excluded.deletion_reason)
    where tombstone.lineage_id = excluded.lineage_id
      or (tombstone.lineage_id is null and exists (
        select 1 from public.cardforge_contributor_asset_submissions anchor
        where anchor.id = tombstone.deleted_submission_id and anchor.lineage_id = excluded.lineage_id));
    if not found then raise exception 'contributor_asset_purge_identity_conflict'; end if;

    -- Never archive a registry pointer which has escaped this locked lineage.
    if exists (select 1 from public.cardforge_asset_registry r where r.asset_id = lineage_asset_id
      and r.contributor_submission_id is not null and not exists (
        select 1 from public.cardforge_contributor_asset_submissions s
        where s.id = r.contributor_submission_id and s.lineage_id = lineage_uuid))
    then raise exception 'contributor_asset_purge_identity_conflict'; end if;
    update public.cardforge_asset_registry set status = 'archived', access_tier = 'hidden'
    where asset_id = lineage_asset_id;
  end if;

  select coalesce(pg_catalog.jsonb_agg(object_reference), '[]'::jsonb) into storage_objects
  from (select distinct pg_catalog.jsonb_build_object(
    'storageBucket', s.source_storage_bucket, 'storagePath', s.source_storage_path) as object_reference
    from public.cardforge_contributor_asset_submissions s where s.lineage_id = lineage_uuid
      and s.source_storage_bucket is not null and s.source_storage_path is not null) objects;

  update public.cardforge_contributor_asset_submissions set purge_state = 'pending'
  where lineage_id = lineage_uuid and purge_state is null;
  return pg_catalog.jsonb_build_object('lineageId', lineage_uuid,
    'registryAssetId', lineage_asset_id, 'storageObjects', storage_objects);
end; $$;

-- The existing trusted backend finalizer needs no table-wide DELETE grant.
-- Its only extra authority is removal of the verified prepared lineage's own
-- publication receipts, in the same transaction as native cleanup triggers.
create or replace function public.cardforge_finalize_contributor_asset_purge(p_submission_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  lineage_uuid uuid;
  lineage_asset_id text;
  lineage_purge_state text;
begin
  -- current_user is the definer here. The outer SET ROLE identity is the
  -- PostgREST caller; JWT claims alone must never authorize this function.
  if coalesce(nullif(pg_catalog.current_setting('role', true), 'none'), session_user::text)
    is distinct from 'service_role'
  then raise exception 'contributor_asset_purge_not_permitted' using errcode = '42501'; end if;

  select candidate.lineage_id into lineage_uuid
  from public.cardforge_contributor_asset_submissions candidate
  where candidate.id = p_submission_id and candidate.purge_state = 'pending';
  if not found then raise exception 'contributor_asset_purge_not_prepared'; end if;

  select lineage.registry_asset_id, lineage.purge_state into lineage_asset_id, lineage_purge_state
  from public.cardforge_pipeline_asset_lineages lineage where lineage.id = lineage_uuid for update;
  if not found or lineage_purge_state is distinct from 'pending'
  then raise exception 'contributor_asset_purge_not_prepared'; end if;

  select * into submission from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and lineage_id = lineage_uuid and purge_state = 'pending' for update;
  if not found or exists (select 1 from public.cardforge_contributor_asset_submissions s
    where s.lineage_id = lineage_uuid and s.purge_state is distinct from 'pending')
  then raise exception 'contributor_asset_purge_not_prepared'; end if;

  if lineage_asset_id is not null then
    perform 1 from public.cardforge_pipeline_asset_tombstones t
    where t.asset_id = lineage_asset_id and t.lineage_id = lineage_uuid
      and t.identity_captured_at is not null and t.deletion_reason = 'owner_permanent_deletion'
    for update;
    if not found then raise exception 'contributor_asset_purge_identity_conflict'; end if;
    if exists (select 1 from public.cardforge_asset_registry r where r.asset_id = lineage_asset_id
      and r.contributor_submission_id is not null and not exists (
        select 1 from public.cardforge_contributor_asset_submissions s
        where s.id = r.contributor_submission_id and s.lineage_id = lineage_uuid))
    then raise exception 'contributor_asset_purge_identity_conflict'; end if;
  elsif exists (select 1 from public.cardforge_pipeline_publication_events e where e.lineage_id = lineage_uuid) then
    raise exception 'contributor_asset_purge_identity_conflict';
  end if;

  -- Even a trusted finalizer may not publish completion while managed objects
  -- still exist. Storage removal remains owned by the existing backend sequence.
  if exists (select 1 from public.cardforge_contributor_asset_submissions s
    join storage.objects o on o.bucket_id = s.source_storage_bucket and o.name = s.source_storage_path
    where s.lineage_id = lineage_uuid)
  then raise exception 'contributor_asset_purge_storage_not_removed'; end if;

  -- Must precede submission deletion: its cleanup trigger can delete an empty
  -- lineage when the registry is already absent. The RESTRICT FK stays intact.
  delete from public.cardforge_pipeline_publication_events where lineage_id = lineage_uuid;
  delete from public.cardforge_contributor_asset_submissions
  where lineage_id = lineage_uuid and purge_state = 'pending';
  if not found then raise exception 'contributor_asset_purge_not_prepared'; end if;
  if lineage_asset_id is not null then
    delete from public.cardforge_asset_registry where asset_id = lineage_asset_id;
    update public.cardforge_pipeline_asset_tombstones set completed_at = pg_catalog.now()
    where asset_id = lineage_asset_id and lineage_id = lineage_uuid;

  end if;
  return true;
end; $$;

revoke all on function public.cardforge_prepare_contributor_asset_purge(uuid, text) from public, anon, authenticated;
revoke all on function public.cardforge_finalize_contributor_asset_purge(uuid) from public, anon, authenticated;
grant execute on function public.cardforge_prepare_contributor_asset_purge(uuid, text) to service_role;
grant execute on function public.cardforge_finalize_contributor_asset_purge(uuid) to service_role;

-- Service-only lookup of caller-supplied exact URL digests. No private records,
-- prepared intentions, source URLs, or identities are exposed by this interface.
create function public.cardforge_completed_public_deletions(p_fingerprints text[])
returns setof text language plpgsql stable security invoker set search_path = '' as $$
begin
  if coalesce(cardinality(p_fingerprints), 0) > 256 then
    raise exception 'too_many_deletion_fingerprints';
  end if;
  return query select distinct fingerprint
    from public.cardforge_pipeline_asset_tombstones t
    cross join lateral unnest(t.public_source_url_fingerprints) fingerprint
    where t.completed_at is not null and fingerprint = any(p_fingerprints);
end; $$;
revoke all on function public.cardforge_completed_public_deletions(text[]) from public, anon, authenticated;
grant execute on function public.cardforge_completed_public_deletions(text[]) to service_role;

commit;
