begin;

create or replace function public.cardforge_publish_official_starter_set(
  p_asset_id text,
  p_name text,
  p_description text,
  p_package_url text,
  p_preview_url text,
  p_storage_bucket text,
  p_storage_path text,
  p_file_size_bytes bigint,
  p_package_sha256 text,
  p_contributor_id text,
  p_contributor_email text,
  p_specialty_tags text[],
  p_use_case_tags text[],
  p_source_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission_id uuid;
  previous_revision integer;
  stable_submission_key text;
begin
  if p_asset_id !~ '^[a-z0-9][a-z0-9-]{2,119}$'
    or nullif(pg_catalog.btrim(p_name), '') is null
    or nullif(pg_catalog.btrim(p_description), '') is null
    or p_package_url !~ '^https://'
    or nullif(pg_catalog.btrim(p_storage_bucket), '') is null
    or nullif(pg_catalog.btrim(p_storage_path), '') is null
    or p_file_size_bytes <= 0
    or p_package_sha256 !~ '^[a-f0-9]{64}$'
    or nullif(pg_catalog.btrim(p_contributor_id), '') is null
    or pg_catalog.cardinality(coalesce(p_specialty_tags, '{}'::text[])) = 0
    or pg_catalog.cardinality(coalesce(p_use_case_tags, '{}'::text[])) = 0
    or not public.cardforge_content_tags_are_valid(p_specialty_tags)
    or not public.cardforge_content_tags_are_valid(p_use_case_tags)
  then
    raise exception 'official_starter_set_invalid';
  end if;

  if not exists (
    select 1 from public.cardforge_contributor_profiles
    where clerk_user_id = p_contributor_id and status = 'active'
  ) then
    raise exception 'official_starter_set_contributor_required';
  end if;

  stable_submission_key := 'official-starter-set:' || p_asset_id || ':' || p_package_sha256;

  select id
  into submission_id
  from public.cardforge_contributor_asset_submissions
  where submission_key = stable_submission_key
  limit 1
  for update;

  if submission_id is null then
    select coalesce(max(revision_number), 0)
    into previous_revision
    from public.cardforge_contributor_asset_submissions
    where asset_type = 'sets'
      and (target_registry_asset_id = p_asset_id or registry_asset_id = p_asset_id);

    update public.cardforge_contributor_asset_submissions
    set
      status = 'archived',
      automated_status = 'archived',
      owner_status_override = 'archived',
      decision_reason = 'superseded_revision'
    where asset_type = 'sets'
      and status = 'published'
      and (target_registry_asset_id = p_asset_id or registry_asset_id = p_asset_id);

    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
      asset_type,
      name,
      description,
      preview_url,
      source_url,
      status,
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      quality_score,
      tier_decision_reason,
      decision_reason,
      source_file_size_bytes,
      source_mime_type,
      source_storage_bucket,
      source_storage_path,
      source_payload,
      target_registry_asset_id,
      base_revision_number,
      revision_number,
      submission_key,
      published_at,
      specialty_tags,
      use_case_tags,
      source_notes
    ) values (
      p_contributor_id,
      nullif(pg_catalog.btrim(p_contributor_email), ''),
      'sets',
      pg_catalog.btrim(p_name),
      pg_catalog.btrim(p_description),
      coalesce(nullif(pg_catalog.btrim(p_preview_url), ''), ''),
      p_package_url,
      'published',
      'published',
      'published',
      'free',
      'free',
      'free',
      100,
      'owner_forced_free',
      'published',
      p_file_size_bytes,
      'application/vnd.cardforge.project+zip',
      p_storage_bucket,
      p_storage_path,
      pg_catalog.jsonb_build_object('packageSha256', p_package_sha256, 'portableProject', true),
      p_asset_id,
      previous_revision,
      previous_revision + 1,
      stable_submission_key,
      pg_catalog.now(),
      p_specialty_tags,
      p_use_case_tags,
      pg_catalog.btrim(p_source_notes)
    ) returning id into submission_id;
  else
    update public.cardforge_contributor_asset_submissions
    set
      source_url = p_package_url,
      source_file_size_bytes = p_file_size_bytes,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path,
      preview_url = coalesce(nullif(pg_catalog.btrim(p_preview_url), ''), preview_url),
      updated_at = pg_catalog.now()
    where id = submission_id;
  end if;

  perform public.cardforge_sync_contributor_asset_registry(submission_id);
  return submission_id;
end;
$$;

revoke all on function public.cardforge_publish_official_starter_set(
  text, text, text, text, text, text, text, bigint, text, text, text, text[], text[], text
) from public, anon, authenticated;
grant execute on function public.cardforge_publish_official_starter_set(
  text, text, text, text, text, text, text, bigint, text, text, text, text[], text[], text
) to service_role;

comment on function public.cardforge_publish_official_starter_set(
  text, text, text, text, text, text, text, bigint, text, text, text, text[], text[], text
) is 'Publishes a repository-authored portable starter Set through the same immutable Pipeline revision and registry owners used by Contributor Sets.';

commit;
